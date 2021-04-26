import { expect, use } from 'chai'
import { deployMockContract, MockProvider, solidity } from 'ethereum-waffle'
import { Contract, Wallet } from 'ethers'
import { beforeEachWithFixture, parseTRU, timeTravel } from 'utils'

import {
  TrueFiVault,
  TrueFiVault__factory,
} from 'contracts'
import {
  IERC20Json,
  StkTruTokenJson,
} from 'build'

use(solidity)

describe('TrueFiVault', () => {
  let owner: Wallet
  let beneficiary: Wallet
  let provider: MockProvider

  let tru: Contract
  let stkTru: Contract

  let trueFiVault: TrueFiVault

  const AMOUNT = parseTRU(1000)
  const dayInSeconds = 60 * 60 * 24
  const DURATION = 180 * dayInSeconds

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner, beneficiary] = wallets
    provider = _provider

    tru = await deployMockContract(owner, IERC20Json.abi)
    await tru.mock.transferFrom.returns(true)
    stkTru = await deployMockContract(owner, StkTruTokenJson.abi)
    await stkTru.mock.delegate.withArgs(beneficiary.address).returns()

    trueFiVault = await new TrueFiVault__factory(owner).deploy(
      beneficiary.address,
      AMOUNT,
      DURATION,
      tru.address,
      stkTru.address,
    )
  })

  describe('Withdraw to owner', () => {
    beforeEach(async () => {
      await tru.mock.balanceOf.withArgs(trueFiVault.address).returns(parseTRU(1000))
      await tru.mock.transfer.withArgs(owner.address, parseTRU(1000)).returns(true)
      await stkTru.mock.balanceOf.withArgs(trueFiVault.address).returns(parseTRU(2000))
      await stkTru.mock.transfer.withArgs(owner.address, parseTRU(2000)).returns(true)
    })

    it('reverts with wrong caller', async () => {
      await expect(trueFiVault.connect(beneficiary).withdrawToOwner()).to.be.revertedWith('only owner')
    })

    xit('transfers TRU to owner', async () => {
      await trueFiVault.connect(owner).withdrawToOwner()
      expect('transfer').to.be.calledOnContractWith(tru, [owner.address, parseTRU(1000)])
    })

    xit('transfers stkTRU to owner', async () => {
      await trueFiVault.connect(owner).withdrawToOwner()
      expect('transfer').to.be.calledOnContractWith(stkTru, [owner.address, parseTRU(2000)])
    })

    it('emits event', async () => {
      await expect(trueFiVault.connect(owner).withdrawToOwner()).to.emit(trueFiVault, 'WithdrawTo').withArgs(owner.address)
    })
  })

  describe('Withdraw to beneficiary', () => {
    beforeEach(async () => {
      await tru.mock.balanceOf.withArgs(trueFiVault.address).returns(parseTRU(1000))
      await tru.mock.transfer.withArgs(beneficiary.address, parseTRU(1000)).returns(true)
      await stkTru.mock.balanceOf.withArgs(trueFiVault.address).returns(parseTRU(2000))
      await stkTru.mock.transfer.withArgs(beneficiary.address, parseTRU(2000)).returns(true)
    })

    it('reverts with wrong caller', async () => {
      await timeTravel(provider, DURATION + 1)
      await expect(trueFiVault.connect(owner).withdrawToBeneficiary()).to.be.revertedWith('only beneficiary')
    })

    it('reverts before expiry', async () => {
      await timeTravel(provider, DURATION - 10)
      await expect(trueFiVault.connect(beneficiary).withdrawToBeneficiary()).to.be.revertedWith('TrueFiVault: beneficiary cannot withdraw before expiration')
    })

    xit('transfers TRU to beneficiary', async () => {
      await timeTravel(provider, DURATION + 1)
      await trueFiVault.connect(beneficiary).withdrawToBeneficiary()
      expect('transfer').to.be.calledOnContractWith(tru, [beneficiary.address, parseTRU(1000)])
    })

    xit('transfers stkTRU to beneficiary', async () => {
      await timeTravel(provider, DURATION + 1)
      await trueFiVault.connect(beneficiary).withdrawToBeneficiary()
      expect('transfer').to.be.calledOnContractWith(stkTru, [beneficiary.address, parseTRU(2000)])
    })

    it('emits event', async () => {
      await timeTravel(provider, DURATION + 1)
      await expect(trueFiVault.connect(beneficiary).withdrawToBeneficiary()).to.emit(trueFiVault, 'WithdrawTo').withArgs(beneficiary.address)
    })
  })

  describe('Delegate beneficiary stkTruToken calls', () => {
    it('reverts stake from non-beneficiary', async () => {
      await expect(trueFiVault.connect(owner).stake(parseTRU(1000))).to.be.revertedWith('only beneficiary')
    })

    xit('delegates stake from beneficiary', async () => {
      await stkTru.mock.stake.withArgs(parseTRU(1000)).returns()
      await trueFiVault.connect(beneficiary).stake(parseTRU(1000))
      expect('stake').to.be.calledOnContractWith(stkTru, [parseTRU(1000)])
    })

    it('reverts unstake from non-beneficiary', async () => {
      await expect(trueFiVault.connect(owner).unstake(parseTRU(1000))).to.be.revertedWith('only beneficiary')
    })

    xit('delegates unstake from beneficiary', async () => {
      await stkTru.mock.unstake.withArgs(parseTRU(1000)).returns()
      await trueFiVault.connect(beneficiary).unstake(parseTRU(1000))
      expect('unstake').to.be.calledOnContractWith(stkTru, [parseTRU(1000)])
    })

    it('reverts cooldown from non-beneficiary', async () => {
      await expect(trueFiVault.connect(owner).cooldown()).to.be.revertedWith('only beneficiary')
    })

    xit('delegates cooldown from beneficiary', async () => {
      await stkTru.mock.cooldown.returns()
      await trueFiVault.connect(beneficiary).cooldown()
      expect('cooldown').to.be.calledOnContract(stkTru)
    })

    it('reverts claimRewards from non-beneficiary', async () => {
      await expect(trueFiVault.connect(owner).claimRewards()).to.be.revertedWith('only beneficiary')
    })

    xit('delegates claimRewards from beneficiary', async () => {
      await stkTru.mock.claimRewards.withArgs(tru.address).returns()
      await trueFiVault.connect(beneficiary).claimRewards()
      expect('claimRewards').to.be.calledOnContractWith(stkTru, [tru.address])
    })

    it('reverts claimRestake from non-beneficiary', async () => {
      await expect(trueFiVault.connect(owner).claimRestake()).to.be.revertedWith('only beneficiary')
    })

    xit('delegates claimRestake from beneficiary', async () => {
      await stkTru.mock.claimRestake.returns()
      await trueFiVault.connect(beneficiary).claimRestake()
      expect('claimRestake').to.be.calledOnContract(stkTru)
    })
  })
})
