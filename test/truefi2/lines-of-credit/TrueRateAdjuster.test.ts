import { expect, use } from 'chai'
import { Wallet } from 'ethers'

import { beforeEachWithFixture, createApprovedLoan, DAY, parseEth, setupTruefi2 } from 'utils'

import {
  TrueRateAdjuster,
  TrueFiPool2,
  TrueFiPool2__factory,
  TimeAveragedBaseRateOracle,
  TimeAveragedBaseRateOracle__factory,
  TrueRatingAgencyV2,
  MockTrueCurrency,
  StkTruToken,
  LoanFactory2,
  TrueLender2,
  TrueCreditAgency,
} from 'contracts'

import { MockProvider, solidity } from 'ethereum-waffle'

use(solidity)

describe('TrueRateAdjuster', () => {
  let owner: Wallet
  let borrower: Wallet
  let provider: MockProvider
  let rateAdjuster: TrueRateAdjuster
  let ratingAgency: TrueRatingAgencyV2
  let tru: MockTrueCurrency
  let stkTru: StkTruToken
  let loanFactory: LoanFactory2
  let tusdPool: TrueFiPool2
  let tusd: MockTrueCurrency
  let lender: TrueLender2
  let creditAgency: TrueCreditAgency

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner, borrower] = wallets
    provider = _provider

    ;({
      rateAdjuster,
      rater: ratingAgency,
      tru,
      stkTru,
      loanFactory,
      standardToken: tusd,
      standardPool: tusdPool,
      lender,
      creditAgency,
    } = await setupTruefi2(owner, provider))

    await tusd.mint(owner.address, parseEth(1e7))
    await tusd.approve(tusdPool.address, parseEth(1e7))
    await tusdPool.join(parseEth(1e7))
  })

  const setUtilization = async (pool: TrueFiPool2, utilization: number) => {
    if (utilization === 0) {
      return
    }
    const utilizationAmount = (await pool.poolValue()).mul(utilization).div(100)
    const loan = await createApprovedLoan(
      ratingAgency, tru, stkTru,
      loanFactory, borrower, tusdPool,
      utilizationAmount, DAY, 1,
      owner, provider,
    )
    await lender.connect(borrower).fund(loan.address)
  }

  describe('initializer', () => {
    it('transfers ownership', async () => {
      expect(await rateAdjuster.owner()).to.eq(owner.address)
    })

    it('sets riskPremium', async () => {
      expect(await rateAdjuster.riskPremium()).to.eq(200)
    })

    it('sets credit adjustment coefficient', async () => {
      expect(await rateAdjuster.creditAdjustmentCoefficient()).to.eq(1000)
    })

    it('sets utilization adjustment coefficient', async () => {
      expect(await rateAdjuster.utilizationAdjustmentCoefficient()).to.eq(50)
    })

    it('sets utilization adjustment power', async () => {
      expect(await rateAdjuster.utilizationAdjustmentPower()).to.eq(2)
    })
  })

  describe('setRiskPremium', () => {
    it('reverts if caller is not the owner', async () => {
      await expect(rateAdjuster.connect(borrower).setRiskPremium(0))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('sets riskPremium', async () => {
      await rateAdjuster.setRiskPremium(300)
      expect(await rateAdjuster.riskPremium()).to.eq(300)
    })

    it('emits event', async () => {
      await expect(rateAdjuster.setRiskPremium(300))
        .to.emit(rateAdjuster, 'RiskPremiumChanged')
        .withArgs(300)
    })
  })

  describe('setCreditAdjustmentCoefficient', () => {
    it('reverts if caller is not the owner', async () => {
      await expect(rateAdjuster.connect(borrower).setCreditAdjustmentCoefficient(0))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('sets credit adjustment coefficient', async () => {
      await rateAdjuster.setCreditAdjustmentCoefficient(2000)
      expect(await rateAdjuster.creditAdjustmentCoefficient()).to.eq(2000)
    })

    it('emits event', async () => {
      await expect(rateAdjuster.setCreditAdjustmentCoefficient(2000))
        .to.emit(rateAdjuster, 'CreditAdjustmentCoefficientChanged')
        .withArgs(2000)
    })
  })

  describe('setUtilizationAdjustmentCoefficient', () => {
    it('reverts if caller is not the owner', async () => {
      await expect(rateAdjuster.connect(borrower).setUtilizationAdjustmentCoefficient(0))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('sets utilization adjustment coefficient', async () => {
      await rateAdjuster.setUtilizationAdjustmentCoefficient(100)
      expect(await rateAdjuster.utilizationAdjustmentCoefficient()).to.eq(100)
    })

    it('emits event', async () => {
      await expect(rateAdjuster.setUtilizationAdjustmentCoefficient(100))
        .to.emit(rateAdjuster, 'UtilizationAdjustmentCoefficientChanged')
        .withArgs(100)
    })
  })

  describe('setUtilizationAdjustmentPower', () => {
    it('reverts if caller is not the owner', async () => {
      await expect(rateAdjuster.connect(borrower).setUtilizationAdjustmentPower(0))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('sets utilization adjustment power', async () => {
      await rateAdjuster.setUtilizationAdjustmentPower(3)
      expect(await rateAdjuster.utilizationAdjustmentPower()).to.eq(3)
    })

    it('emits event', async () => {
      await expect(rateAdjuster.setUtilizationAdjustmentPower(3))
        .to.emit(rateAdjuster, 'UtilizationAdjustmentPowerChanged')
        .withArgs(3)
    })
  })

  describe('setBaseRateOracle', () => {
    let fakePool: TrueFiPool2
    let fakeOracle: TimeAveragedBaseRateOracle

    beforeEach(async () => {
      fakePool = await new TrueFiPool2__factory(owner).deploy()
      fakeOracle = await new TimeAveragedBaseRateOracle__factory(owner).deploy()
    })

    it('reverts if caller is not the owner', async () => {
      await expect(rateAdjuster.connect(borrower).setBaseRateOracle(fakePool.address, fakeOracle.address))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('sets base rate oracle', async () => {
      await rateAdjuster.setBaseRateOracle(fakePool.address, fakeOracle.address)
      expect(await rateAdjuster.baseRateOracle(fakePool.address)).to.eq(fakeOracle.address)
    })

    it('emits event', async () => {
      await expect(rateAdjuster.setBaseRateOracle(fakePool.address, fakeOracle.address))
        .to.emit(rateAdjuster, 'BaseRateOracleChanged')
        .withArgs(fakePool.address, fakeOracle.address)
    })
  })

  describe('setFixedTermLoanAdjustmentCoefficient', () => {
    it('reverts if caller is not the owner', async () => {
      await expect(rateAdjuster.connect(borrower).setFixedTermLoanAdjustmentCoefficient(0))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('sets fixed-term loan adjustment coefficient', async () => {
      await rateAdjuster.setFixedTermLoanAdjustmentCoefficient(50)
      expect(await rateAdjuster.fixedTermLoanAdjustmentCoefficient()).to.eq(50)
    })

    it('emits event', async () => {
      await expect(rateAdjuster.setFixedTermLoanAdjustmentCoefficient(50))
        .to.emit(rateAdjuster, 'FixedTermLoanAdjustmentCoefficientChanged')
        .withArgs(50)
    })
  })

  describe('fixedTermLoanAdjustment', () => {
    beforeEach(async () => {
      await rateAdjuster.setFixedTermLoanAdjustmentCoefficient(25)
    })

    ;[
      [0, 0],
      [30 * DAY - 1, 0],
      [30 * DAY, 25],
      [60 * DAY - 1, 25],
      [60 * DAY, 50],
      [3.5 * 30 * DAY, 75],
      [180 * DAY, 150],
    ].map(([term, adjustment]) =>
      it(`returns adjustment of ${adjustment} basis points for term of ${term / DAY} days`, async () => {
        expect(await rateAdjuster.fixedTermLoanAdjustment(term)).to.eq(adjustment)
      }),
    )
  })

  describe('utilizationAdjustmentRate', () => {
    [
      [0, 0],
      [10, 11],
      [20, 28],
      [30, 52],
      [40, 88],
      [50, 150],
      [60, 262],
      [70, 505],
      [80, 1200],
      [90, 4950],
      [95, 19950],
      [99, 50000],
      [100, 50000],
    ].map(([utilization, adjustment]) =>
      it(`returns ${adjustment} if utilization is at ${utilization} percent`, async () => {
        await setUtilization(tusdPool, utilization)
        expect(await creditAgency.utilizationAdjustmentRate(tusdPool.address)).to.eq(adjustment)
      }),
    )
  })
})
