import { expect, use } from 'chai'
import { Wallet } from 'ethers'

import { beforeEachWithFixture, DAY } from 'utils'
import { setupDeploy } from 'scripts/utils'

import {
  TrueRateAdjuster,
  TrueRateAdjuster__factory,
} from 'contracts'

import { solidity } from 'ethereum-waffle'

use(solidity)

describe('TrueRateAdjuster', () => {
  let owner: Wallet
  let borrower: Wallet
  let rateAdjuster: TrueRateAdjuster

  beforeEachWithFixture(async (wallets) => {
    [owner, borrower] = wallets

    const deployContract = setupDeploy(owner)

    rateAdjuster = await deployContract(TrueRateAdjuster__factory)

    await rateAdjuster.initialize()
  })

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
})
