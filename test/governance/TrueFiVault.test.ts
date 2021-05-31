import { expect, use } from 'chai'
import { deployMockContract, MockContract, MockProvider, solidity } from 'ethereum-waffle'
import { BigNumber, Wallet } from 'ethers'
import { beforeEachWithFixture, parseTRU, timeTravel } from 'utils'

import {
  TrueFiVault,
  TrueFiVault__factory,
  TrustToken,
  TrustToken__factory,
} from 'contracts'
import {
  StkTruTokenJson,
} from 'build'

use(solidity)

describe('TrueFiVault', () => {
  let owner: Wallet
  let beneficiary: Wallet
  let provider: MockProvider

  let tru: TrustToken
  let stkTru: MockContract

  let trueFiVault: TrueFiVault

  const TRU_AMOUNT = parseTRU(1000)
  const STKTRU_AMOUNT = parseTRU(2000)
  const dayInSeconds = 60 * 60 * 24
  const DURATION = 365 * dayInSeconds

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner, beneficiary] = wallets
    provider = _provider

    tru = await new TrustToken__factory(owner).deploy()
    await tru.initialize()
    await tru.mint(owner.address, TRU_AMOUNT)
    stkTru = await deployMockContract(owner, StkTruTokenJson.abi)
    await stkTru.mock.delegate.returns()

    trueFiVault = await new TrueFiVault__factory(owner).deploy()
    await trueFiVault.initialize(
      beneficiary.address,
      tru.address,
      stkTru.address,
    )

    await tru.approve(trueFiVault.address, TRU_AMOUNT)
    await trueFiVault.lock(TRU_AMOUNT)
  })

  describe('Constructor', () => {
    it('sets owner to msg.sender', async () => {
      expect(await trueFiVault.owner()).to.equal(owner.address)
    })

    it('sets beneficiary', async () => {
      expect(await trueFiVault.beneficiary()).to.equal(beneficiary.address)
    })

    it('delegates stkTRU to beneficiary', async () => {
      await stkTru.mock.delegate.withArgs(beneficiary.address).returns()
      const vault = await new TrueFiVault__factory(owner).deploy()
      await vault.initialize(
        beneficiary.address,
        tru.address,
        stkTru.address,
      )
      expect('delegate').to.be.calledOnContractWith(stkTru, [beneficiary.address])
    })
  })

  describe('Lock', () => {
    it('transfers TRU to the Vault', async () => {
      expect(await tru.balanceOf(trueFiVault.address)).to.equal(TRU_AMOUNT)
    })
  })

  describe('Withdraw to owner', () => {
    beforeEach(async () => {
      await stkTru.mock.balanceOf.withArgs(trueFiVault.address).returns(STKTRU_AMOUNT)
      await stkTru.mock.transfer.withArgs(owner.address, STKTRU_AMOUNT).returns(true)
      await stkTru.mock.claimRewards.withArgs(tru.address).returns()
    })

    it('reverts with wrong caller', async () => {
      await expect(trueFiVault.connect(beneficiary).withdrawToOwner()).to.be.revertedWith('TrueFiVault: only owner')
    })

    it('claims rewards', async () => {
      await trueFiVault.connect(owner).withdrawToOwner()
      expect('claimRewards').to.be.calledOnContractWith(stkTru, [tru.address])
    })

    it('transfers TRU to owner', async () => {
      await trueFiVault.connect(owner).withdrawToOwner()
      expect('transfer').to.be.calledOnContractWith(tru, [owner.address, TRU_AMOUNT])
    })

    it('transfers stkTRU to owner', async () => {
      await trueFiVault.connect(owner).withdrawToOwner()
      expect('transfer').to.be.calledOnContractWith(stkTru, [owner.address, STKTRU_AMOUNT])
    })

    it('emits event', async () => {
      await expect(trueFiVault.connect(owner).withdrawToOwner()).to.emit(trueFiVault, 'Withdraw').withArgs(tru.address, TRU_AMOUNT, owner.address)
    })
  })

  describe('Withdraw to beneficiary', () => {
    beforeEach(async () => {
      await stkTru.mock.balanceOf.withArgs(trueFiVault.address).returns(STKTRU_AMOUNT)
      await stkTru.mock.transfer.returns(true)
      await stkTru.mock.claimRewards.withArgs(tru.address).returns()
    })

    it('reverts with wrong caller', async () => {
      await timeTravel(provider, DURATION + 1)
      await expect(trueFiVault.connect(owner).withdrawToBeneficiary()).to.be.revertedWith('TrueFiVault: only beneficiary')
    })

    describe('Vesting', () => {
      const MONTH = DURATION / 12
      const VEST_EACH_MONTH = TRU_AMOUNT.div(12)

      it('unlocks TRU linearly over a year', async () => {
        const start = await trueFiVault.withdrawable(tru.address)
        expect(start).to.be.lt(parseTRU(1))
        await timeTravel(provider, MONTH)
        expect(await trueFiVault.withdrawable(tru.address)).to.be.closeTo(start.add(VEST_EACH_MONTH), 100)
        await timeTravel(provider, MONTH)
        expect(await trueFiVault.withdrawable(tru.address)).to.be.closeTo(start.add(VEST_EACH_MONTH.mul(2)), 100)
        await timeTravel(provider, MONTH * 2)
        expect(await trueFiVault.withdrawable(tru.address)).to.be.closeTo(start.add(VEST_EACH_MONTH.mul(4)), 100)
        await timeTravel(provider, MONTH * 10)
        expect(await trueFiVault.withdrawable(tru.address)).to.equal(TRU_AMOUNT)
      })

      it('unlocks all stkTRU only after a year has passed', async () => {
        const start = await trueFiVault.withdrawable(stkTru.address)
        expect(start).to.be.lt(parseTRU(1))
        await timeTravel(provider, MONTH)
        expect(await trueFiVault.withdrawable(stkTru.address)).to.equal(0)
        await timeTravel(provider, MONTH)
        expect(await trueFiVault.withdrawable(stkTru.address)).to.equal(0)
        await timeTravel(provider, MONTH * 2)
        expect(await trueFiVault.withdrawable(stkTru.address)).to.equal(0)
        await timeTravel(provider, MONTH * 10)
        expect(await trueFiVault.withdrawable(stkTru.address)).to.equal(STKTRU_AMOUNT)
      })

      it('correctly vests funds after withdraw', async () => {
        const start = await trueFiVault.withdrawable(tru.address)
        await timeTravel(provider, MONTH * 2)
        await trueFiVault.connect(beneficiary).withdrawToBeneficiary()
        expect(await tru.balanceOf(beneficiary.address)).to.be.closeTo(start.add((VEST_EACH_MONTH.mul(2))), 10000)
        expect(await trueFiVault.withdrawable(tru.address)).to.be.closeTo(BigNumber.from(0), 1000)
        await timeTravel(provider, MONTH * 2)
        expect(await trueFiVault.withdrawable(tru.address)).to.be.closeTo(VEST_EACH_MONTH.mul(2), 1000)
      })

      it('correctly vests funds after withdraw claiming rewards', async () => {
        const REWARDS_AMOUNT = TRU_AMOUNT.div(2)
        const start = await trueFiVault.withdrawable(tru.address)
        await timeTravel(provider, MONTH * 2)
        // Simulate claiming rewards by minting TRU
        await tru.mint(trueFiVault.address, REWARDS_AMOUNT)
        await trueFiVault.connect(beneficiary).withdrawToBeneficiary()
        expect(await tru.balanceOf(beneficiary.address)).to.be.closeTo(start.add(((VEST_EACH_MONTH.add(REWARDS_AMOUNT.div(12))).mul(2))), 50000)
        await timeTravel(provider, MONTH * 20)
        await trueFiVault.connect(beneficiary).withdrawToBeneficiary()
        expect(await tru.balanceOf(beneficiary.address)).to.equal(REWARDS_AMOUNT.add(TRU_AMOUNT))
      })
    })

    it('claims rewards', async () => {
      await timeTravel(provider, DURATION + 1)
      await trueFiVault.connect(beneficiary).withdrawToBeneficiary()
      expect('claimRewards').to.be.calledOnContractWith(stkTru, [tru.address])
    })

    it('transfers TRU to beneficiary', async () => {
      await timeTravel(provider, DURATION + 1)
      await trueFiVault.connect(beneficiary).withdrawToBeneficiary()
      expect('transfer').to.be.calledOnContractWith(tru, [beneficiary.address, TRU_AMOUNT])
    })

    it('does not transfer stkTRU when ', async () => {
      await timeTravel(provider, DURATION + 1)
      await trueFiVault.connect(beneficiary).withdrawToBeneficiary()
      expect('transfer').to.be.calledOnContractWith(stkTru, [beneficiary.address, STKTRU_AMOUNT])
    })

    it('emits event', async () => {
      await timeTravel(provider, DURATION + 1)
      await expect(trueFiVault.connect(beneficiary).withdrawToBeneficiary())
        .to.emit(trueFiVault, 'Withdraw').withArgs(tru.address, TRU_AMOUNT, beneficiary.address)
        .and.to.emit(trueFiVault, 'Withdraw').withArgs(stkTru.address, STKTRU_AMOUNT, beneficiary.address)
    })
  })

  describe('Delegate beneficiary stkTruToken calls', () => {
    it('reverts stake from non-beneficiary', async () => {
      await expect(trueFiVault.connect(owner).stake(TRU_AMOUNT)).to.be.revertedWith('TrueFiVault: only beneficiary')
    })

    it('delegates stake from beneficiary', async () => {
      await stkTru.mock.stake.withArgs(TRU_AMOUNT).returns()
      await trueFiVault.connect(beneficiary).stake(TRU_AMOUNT)
      expect('stake').to.be.calledOnContractWith(stkTru, [TRU_AMOUNT])
    })

    it('reverts unstake from non-beneficiary', async () => {
      await expect(trueFiVault.connect(owner).unstake(TRU_AMOUNT)).to.be.revertedWith('TrueFiVault: only beneficiary')
    })

    it('delegates unstake from beneficiary', async () => {
      await stkTru.mock.unstake.withArgs(TRU_AMOUNT).returns()
      await trueFiVault.connect(beneficiary).unstake(TRU_AMOUNT)
      expect('unstake').to.be.calledOnContractWith(stkTru, [TRU_AMOUNT])
    })

    it('reverts cooldown from non-beneficiary', async () => {
      await expect(trueFiVault.connect(owner).cooldown()).to.be.revertedWith('TrueFiVault: only beneficiary')
    })

    it('delegates cooldown from beneficiary', async () => {
      await stkTru.mock.cooldown.returns()
      await trueFiVault.connect(beneficiary).cooldown()
      expect('cooldown').to.be.calledOnContract(stkTru)
    })

    it('reverts claimRewards from non-beneficiary', async () => {
      await expect(trueFiVault.connect(owner).claimRewards()).to.be.revertedWith('TrueFiVault: only beneficiary')
    })

    it('delegates claimRewards from beneficiary', async () => {
      await stkTru.mock.claimRewards.withArgs(tru.address).returns()
      await trueFiVault.connect(beneficiary).claimRewards()
      expect('claimRewards').to.be.calledOnContractWith(stkTru, [tru.address])
    })

    it('reverts claimRestake from non-beneficiary', async () => {
      await expect(trueFiVault.connect(owner).claimRestake()).to.be.revertedWith('TrueFiVault: only beneficiary')
    })

    it('delegates claimRestake from beneficiary', async () => {
      await stkTru.mock.claimRestake.returns()
      await trueFiVault.connect(beneficiary).claimRestake()
      expect('claimRestake').to.be.calledOnContract(stkTru)
    })
  })

  describe('Vesting', () => {
    it('vests unlocked funds each month over a year', async () => {

    })
  })
})
