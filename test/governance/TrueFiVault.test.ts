import { expect, use } from 'chai'
import { MockProvider, solidity } from 'ethereum-waffle'
import { BigNumber, Wallet } from 'ethers'
import { DAY, parseTRU, timeTravel } from 'utils'
import { beforeEachWithFixture } from 'fixtures/beforeEachWithFixture'

import {
  Erc20Mock,
  Erc20Mock__factory,
  LinearTrueDistributor__factory,
  StkTruToken,
  StkTruToken__factory,
  TrueFiVault,
  TrueFiVault__factory,
  TrustToken,
  TrustToken__factory,
} from 'contracts'
import { Zero } from '@ethersproject/constants'

use(solidity)

describe('TrueFiVault', () => {
  let owner: Wallet
  let beneficiary: Wallet
  let liquidator: Wallet
  let provider: MockProvider
  let tfUsd: Erc20Mock
  let feeToken: Erc20Mock

  let tru: TrustToken
  let stkTru: StkTruToken

  let trueFiVault: TrueFiVault

  const TRU_AMOUNT = parseTRU(1000)
  const STKTRU_AMOUNT = parseTRU(200)
  const dayInSeconds = 60 * 60 * 24
  const DURATION = 365 * dayInSeconds

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner, beneficiary, liquidator] = wallets
    provider = _provider
    await provider.send('hardhat_reset', [])

    tru = await new TrustToken__factory(owner).deploy()
    await tru.initialize()
    await tru.mint(owner.address, TRU_AMOUNT.add(STKTRU_AMOUNT))
    stkTru = await new StkTruToken__factory(owner).deploy()
    tfUsd = await new Erc20Mock__factory(owner).deploy(owner.address, 0)
    feeToken = await new Erc20Mock__factory(owner).deploy(owner.address, 0)
    const distributor = await new LinearTrueDistributor__factory(owner).deploy()
    await stkTru.initialize(tru.address, tfUsd.address, feeToken.address, distributor.address, liquidator.address)

    trueFiVault = await new TrueFiVault__factory(owner).deploy()
    await tru.approve(trueFiVault.address, TRU_AMOUNT.add(STKTRU_AMOUNT))
    await trueFiVault.initialize(
      beneficiary.address,
      TRU_AMOUNT.add(STKTRU_AMOUNT),
      tru.address,
      stkTru.address,
    )

    await trueFiVault.connect(beneficiary).stake(STKTRU_AMOUNT)
  })

  describe('Constructor', () => {
    it('sets owner to msg.sender', async () => {
      expect(await trueFiVault.owner()).to.equal(owner.address)
    })

    it('sets beneficiary', async () => {
      expect(await trueFiVault.beneficiary()).to.equal(beneficiary.address)
    })

    it('delegates stkTRU to beneficiary', async () => {
      const vault = await new TrueFiVault__factory(owner).deploy()
      await vault.initialize(
        beneficiary.address,
        0,
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

  describe('Withdraw to beneficiary', () => {
    it('reverts with wrong caller', async () => {
      await timeTravel(provider, DURATION + 1)
      await expect(trueFiVault.connect(owner).withdrawTru(1)).to.be.revertedWith('TrueFiVault: only beneficiary')
      await expect(trueFiVault.connect(owner).withdrawStkTru(1)).to.be.revertedWith('TrueFiVault: only beneficiary')
    })

    describe('Vesting', () => {
      const MONTH = DURATION / 12
      const VEST_EACH_MONTH = (TRU_AMOUNT.add(STKTRU_AMOUNT)).div(12)

      it('cannot withdraw more than possible', async () => {
        await timeTravel(provider, MONTH)
        await expect(trueFiVault.connect(beneficiary).withdrawTru((await trueFiVault.withdrawable(tru.address)).add(10000)))
          .to.be.revertedWith('TrueFiVault: attempting to withdraw more than allowed')
        await expect(trueFiVault.connect(beneficiary).withdrawStkTru((await trueFiVault.withdrawable(stkTru.address)).add(10000)))
          .to.be.revertedWith('TrueFiVault: attempting to withdraw more than allowed')
      })

      it('unlocks TRU linearly over a year', async () => {
        const start = await trueFiVault.withdrawable(tru.address)
        expect(start).to.be.lt(parseTRU(1))
        await timeTravel(provider, MONTH)
        expect(await trueFiVault.withdrawable(tru.address)).to.be.closeTo(start.add(VEST_EACH_MONTH), 40000)
        await timeTravel(provider, MONTH)
        expect(await trueFiVault.withdrawable(tru.address)).to.be.closeTo(start.add(VEST_EACH_MONTH.mul(2)), 40000)
        await timeTravel(provider, MONTH * 2)
        expect(await trueFiVault.withdrawable(tru.address)).to.be.closeTo(start.add(VEST_EACH_MONTH.mul(4)), 40000)
        await timeTravel(provider, MONTH * 10)
        expect(await trueFiVault.withdrawable(tru.address)).to.equal(TRU_AMOUNT)
      })

      it('unlocks all stkTRU only after a year has passed', async () => {
        const start = await trueFiVault.withdrawable(stkTru.address)
        expect(start).to.be.lt(parseTRU(1))
        await timeTravel(provider, MONTH)
        expect(await trueFiVault.withdrawable(stkTru.address)).to.be.closeTo(start.add(VEST_EACH_MONTH), 40000)
        await timeTravel(provider, MONTH)
        expect(await trueFiVault.withdrawable(stkTru.address)).to.be.closeTo(start.add(VEST_EACH_MONTH.mul(2)), 40000)
        await timeTravel(provider, MONTH * 2)
        // STKTRU_AMOUNT < VEST_EACH_MONTH * 8
        expect(await trueFiVault.withdrawable(stkTru.address)).to.equal(STKTRU_AMOUNT)
        await timeTravel(provider, MONTH * 10)
        expect(await trueFiVault.withdrawable(stkTru.address)).to.equal(STKTRU_AMOUNT)
      })

      it('correctly vests funds after withdraw', async () => {
        const start = await trueFiVault.withdrawable(tru.address)
        await timeTravel(provider, MONTH * 2)
        await trueFiVault.connect(beneficiary).withdrawTru(await trueFiVault.withdrawable(tru.address))
        expect(await tru.balanceOf(beneficiary.address)).to.be.closeTo(start.add((VEST_EACH_MONTH.mul(2))), 32000)
        expect(await trueFiVault.withdrawable(tru.address)).to.be.closeTo(BigNumber.from(0), 10000)
        await timeTravel(provider, MONTH * 2)
        expect(await trueFiVault.withdrawable(tru.address)).to.be.closeTo(VEST_EACH_MONTH.mul(2), 10000)
      })

      it('correctly vests funds after withdraw claiming rewards', async () => {
        const REWARDS_AMOUNT = TRU_AMOUNT.div(2)
        const start = await trueFiVault.withdrawable(tru.address)
        await timeTravel(provider, MONTH * 2)
        // Simulate claiming rewards by minting TRU
        await tru.mint(trueFiVault.address, REWARDS_AMOUNT)
        await trueFiVault.connect(beneficiary).withdrawTru(await trueFiVault.withdrawable(tru.address))
        expect(await tru.balanceOf(beneficiary.address)).to.be.closeTo(start.add(((VEST_EACH_MONTH.add(REWARDS_AMOUNT.div(12))).mul(2))), 100000)
        await timeTravel(provider, MONTH * 20)
        await trueFiVault.connect(beneficiary).withdrawTru(await trueFiVault.withdrawable(tru.address))
        expect(await tru.balanceOf(beneficiary.address)).to.equal(REWARDS_AMOUNT.add(TRU_AMOUNT))
      })

      it('correctly calculates withdrawable stkTRU amount after slashing', async () => {
        await timeTravel(provider, DAY)
        const start = await trueFiVault.withdrawable(stkTru.address)
        await stkTru.connect(liquidator).withdraw(STKTRU_AMOUNT.div(2))
        // 1/6th of stake was slashed by half, our balance is 11/12 of initial
        expect(await trueFiVault.withdrawable(stkTru.address)).to.be.closeTo(start.mul(11).div(12).mul(2), 10000)
        await trueFiVault.connect(beneficiary).withdrawStkTru(await trueFiVault.withdrawable(stkTru.address))
        expect(await trueFiVault.withdrawable(stkTru.address)).to.be.closeTo(Zero, 100000)
        expect(await trueFiVault.withdrawable(tru.address)).to.be.closeTo(Zero, 100000)
        await timeTravel(provider, MONTH)
        expect(await trueFiVault.withdrawable(stkTru.address)).to.be.closeTo(VEST_EACH_MONTH.mul(11).div(12).mul(2), 20000000)
        await timeTravel(provider, MONTH)
        // whole stkTRU should be withdrawable by now
        expect(await trueFiVault.withdrawable(stkTru.address)).to.equal(STKTRU_AMOUNT.sub(await stkTru.balanceOf(beneficiary.address)))
        await trueFiVault.connect(beneficiary).withdrawStkTru(await trueFiVault.withdrawable(stkTru.address))
        expect(await trueFiVault.withdrawable(stkTru.address)).to.equal(Zero)
        await timeTravel(provider, MONTH * 15)
        expect(await trueFiVault.withdrawable(tru.address)).to.equal(TRU_AMOUNT)
        await trueFiVault.connect(beneficiary).withdrawTru(TRU_AMOUNT)
      })
    })

    it('cannot call before time has passed', async () => {
      await timeTravel(provider, DURATION - 100)
      await expect(trueFiVault.connect(beneficiary).withdrawToBeneficiary()).to.be.revertedWith('TrueFiVault: vault is not expired yet')
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

    it('transfers stkTRU to beneficiary ', async () => {
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
      await trueFiVault.connect(beneficiary).stake(TRU_AMOUNT)
      expect('stake').to.be.calledOnContractWith(stkTru, [TRU_AMOUNT])
    })

    it('reverts unstake from non-beneficiary', async () => {
      await expect(trueFiVault.connect(owner).unstake(TRU_AMOUNT)).to.be.revertedWith('TrueFiVault: only beneficiary')
    })

    it('unstakes from stkTRU', async () => {
      await trueFiVault.connect(beneficiary).cooldown()
      await timeTravel(provider, DAY * 14)
      await trueFiVault.connect(beneficiary).unstake(STKTRU_AMOUNT)
      expect(await tru.balanceOf(trueFiVault.address)).to.equal(STKTRU_AMOUNT.add(TRU_AMOUNT))
    })

    it('reverts cooldown from non-beneficiary', async () => {
      await expect(trueFiVault.connect(owner).cooldown()).to.be.revertedWith('TrueFiVault: only beneficiary')
    })

    it('delegates cooldown from beneficiary', async () => {
      await trueFiVault.connect(beneficiary).cooldown()
      expect('cooldown').to.be.calledOnContract(stkTru)
    })

    it('claims FeeToken rewards', async () => {
      await trueFiVault.connect(beneficiary).claimFeeRewards()
      expect('transfer').to.be.calledOnContractWith(tfUsd, [beneficiary.address, 0])
      expect('transfer').to.be.calledOnContractWith(feeToken, [beneficiary.address, 0])
    })

    it('reverts claimRewards from non-beneficiary', async () => {
      await expect(trueFiVault.connect(owner).claimRewards()).to.be.revertedWith('TrueFiVault: only beneficiary')
    })

    it('delegates claimRewards from beneficiary', async () => {
      await trueFiVault.connect(beneficiary).claimRewards()
      expect('claimRewards').to.be.calledOnContractWith(stkTru, [tru.address])
    })

    it('reverts claimRestake from non-beneficiary', async () => {
      await expect(trueFiVault.connect(owner).claimRestake()).to.be.revertedWith('TrueFiVault: only beneficiary')
    })
  })

  describe('Delegation', () => {
    beforeEach(async () => {
      await trueFiVault.connect(beneficiary).delegate(beneficiary.address)
    })

    it('vault delegates votes to beneficiary', async () => {
      expect(await tru.getCurrentVotes(beneficiary.address)).to.equal(TRU_AMOUNT)
      expect(await stkTru.getCurrentVotes(beneficiary.address)).to.equal(STKTRU_AMOUNT)
    })

    it('beneficiary can delegate votes', async () => {
      await trueFiVault.connect(beneficiary).delegate(liquidator.address)
      expect(await tru.getCurrentVotes(liquidator.address)).to.equal(TRU_AMOUNT)
      expect(await stkTru.getCurrentVotes(liquidator.address)).to.equal(STKTRU_AMOUNT)
    })
  })
})
