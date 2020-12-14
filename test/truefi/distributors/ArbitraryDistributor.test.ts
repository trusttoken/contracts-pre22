import { expect } from 'chai'
import { Wallet } from 'ethers'
import { parseEth } from 'utils/parseEth'

import { beforeEachWithFixture } from 'utils'

import {
  MockErc20Token,
  MockErc20TokenFactory,
  ArbitraryDistributor,
  ArbitraryDistributorFactory,
} from 'contracts'

describe('ArbitraryDistributor', () => {
  let trustToken: MockErc20Token
  let distributor: ArbitraryDistributor
  let owner: Wallet
  let otherWallet: Wallet

  const totalAmount = parseEth(1000)

  beforeEachWithFixture(async (wallets) => {
    [owner, otherWallet] = wallets

    trustToken = await new MockErc20TokenFactory(owner).deploy()
    distributor = await new ArbitraryDistributorFactory(owner).deploy()

    await trustToken.mint(distributor.address, totalAmount)
    await distributor.initialize(owner.address, trustToken.address, totalAmount)
  })

  describe('initialize', () => {
    it('properly saves beneficiary address', async () => {
      expect(await distributor.beneficiary()).to.equal(owner.address)
    })

    it('properly saves trustToken address', async () => {
      expect(await distributor.trustToken()).to.equal(trustToken.address)
    })

    it('properly saves amount to distribute', async () => {
      expect(await distributor.amount()).to.equal(totalAmount)
    })

    it('properly saves remaining amount to distribute', async () => {
      expect(await distributor.remaining()).to.equal(totalAmount)
    })
  })

  describe('distribute', () => {
    const distributedAmount = 100

    it('only predefined beneficiary can call it', async () => {
      await expect(distributor.connect(otherWallet).distribute(distributedAmount))
        .to.be.revertedWith('ArbitraryDistributor: Only beneficiary can receive tokens')
    })

    it('properly sends tokens', async () => {
      await expect(() => distributor.distribute(distributedAmount))
        .to.changeTokenBalances(trustToken, [distributor, owner], [-distributedAmount, distributedAmount])
    })

    it('properly updates remaining tokens value', async () => {
      await distributor.distribute(distributedAmount)
      expect(await distributor.remaining()).to.equal(totalAmount.sub(distributedAmount))
    })

    it('emits event', async () => {
      await expect(distributor.distribute(distributedAmount)).to.emit(distributor, 'Distributed').withArgs(distributedAmount)
    })
  })

  describe('empty', () => {
    it('only owner can empty', async () => {
      await expect(distributor.connect(otherWallet).empty())
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('transfer total balance to sender', async () => {
      const totalBalance = await trustToken.balanceOf(distributor.address)
      await expect(() => distributor.empty())
        .to.changeTokenBalance(trustToken, owner, totalBalance)
    })

    it('sets remaining to 0', async () => {
      await distributor.empty()
      expect(await distributor.remaining()).to.equal(0)
    })
  })
})
