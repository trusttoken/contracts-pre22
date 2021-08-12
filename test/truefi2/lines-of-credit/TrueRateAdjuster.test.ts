import { expect, use } from 'chai'
import { Wallet } from 'ethers'

import { beforeEachWithFixture } from 'utils'
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

    rateAdjuster = await deployContract(TrueRateAdjuster__factory, 1000)
  })

  describe('constructor', () => {
    it('transfers ownership', async () => {
      expect(await rateAdjuster.owner()).to.eq(owner.address)
    })

    it('sets riskPremium', async () => {
      expect(await rateAdjuster.riskPremium()).to.eq(1000)
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
})
