import { utils, Wallet } from 'ethers'
import { loadFixture } from 'ethereum-waffle'
import { expect } from 'chai'

import { setupTrueGold } from 'fixtures/trueGold'
import { toAddress, WalletOrAddress } from 'utils'

import {
  TrueGold,
  Erc20Mock,
  Erc20MockFactory,
  OwnableMock,
  OwnableMockFactory,
} from 'contracts'

describe('TrueGold - Reclaimable', () => {
  const tokenEthBalance = utils.parseEther('1')

  let owner: Wallet
  let otherAccount: Wallet

  let token: TrueGold
  let otherToken: Erc20Mock
  let ownableContract: OwnableMock

  async function fixture ([ethSender, deployer, ...wallets]: Wallet[]) {
    const futureTokenAddress = utils.getContractAddress({ from: deployer.address, nonce: 0 })
    await ethSender.sendTransaction({ to: futureTokenAddress, value: tokenEthBalance })

    const { secondAccount, token } = await setupTrueGold([deployer, ...wallets])

    const erc20MockFactory = new Erc20MockFactory(deployer)
    const otherToken = await erc20MockFactory.deploy(token.address, 1000)

    const ownableMockFactory = new OwnableMockFactory(deployer)
    const ownableContract = await ownableMockFactory.deploy()
    await ownableContract.transferOwnership(token.address)

    return { deployer, secondAccount, token, otherToken, ownableContract }
  }

  beforeEach(async () => {
    ({ deployer: owner, secondAccount: otherAccount, token, otherToken, ownableContract } = await loadFixture(fixture))
  })

  describe('reclaimEther', () => {
    function reclaimEther (caller: Wallet, to: WalletOrAddress) {
      return token.connect(caller).reclaimEther(toAddress(to))
    }

    describe('when the caller is the contract owner', () => {
      it('transfers all Ether balance in the contract to the requested address', async () => {
        const initialBalance = await otherAccount.getBalance()
        await reclaimEther(owner, otherAccount)
        expect(await otherAccount.getBalance()).to.eq(initialBalance.add(tokenEthBalance))
      })
    })

    describe('when the caller is not the contract owner', () => {
      it('reverts', async () => {
        await expect(reclaimEther(otherAccount, otherAccount))
          .to.be.revertedWith('Ownable: caller is not the owner')
      })
    })
  })

  describe('reclaimToken', () => {
    function reclaimToken (caller: Wallet, tokenToReclaim: WalletOrAddress, to: WalletOrAddress) {
      return token.connect(caller).reclaimToken(toAddress(tokenToReclaim), toAddress(to))
    }

    describe('when the caller is the contract owner', () => {
      it('transfer all requested token balance in the contract to the requested address', async () => {
        await reclaimToken(owner, otherToken.address, otherAccount)
        expect(await otherToken.balanceOf(otherAccount.address)).to.eq(1000)
      })
    })

    describe('when the caller is not the contract owner', () => {
      it('reverts', async () => {
        await expect(reclaimToken(otherAccount, otherToken.address, otherAccount))
          .to.be.revertedWith('Ownable: caller is not the owner')
      })
    })
  })

  describe('reclaimContract', () => {
    function reclaimContract (caller: Wallet, contractToReclaim: WalletOrAddress) {
      return token.connect(caller).reclaimContract(toAddress(contractToReclaim))
    }

    describe('when the caller is the contract owner', () => {
      it('transfers the ownership of the requested contract to the TrueGold owner address', async () => {
        await expect(reclaimContract(owner, ownableContract.address))
          .to.emit(ownableContract, 'OwnershipTransferred')
          .withArgs(token.address, owner.address)
      })
    })

    describe('when the caller is not the contract owner', () => {
      it('reverts', async () => {
        await expect(reclaimContract(otherAccount, ownableContract.address))
          .to.be.revertedWith('Ownable: caller is not the owner')
      })
    })
  })
})
