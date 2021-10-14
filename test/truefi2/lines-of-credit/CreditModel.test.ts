import { expect, use } from 'chai'
import { Wallet } from 'ethers'

import { beforeEachWithFixture, DAY, parseEth, parseTRU, parseUSDC, timeTravelTo, updateRateOracle } from 'utils'
import { setupDeploy } from 'scripts/utils'

import {
  IPoolFactory,
  MockErc20Token,
  MockErc20Token__factory,
  MockPoolFactory__factory,
  MockUsdStableCoinOracle__factory,
  TestTimeAveragedBaseRateOracle__factory,
  TimeAveragedBaseRateOracle,
  TimeAveragedBaseRateOracle__factory,
  TrueFiPool2,
  TrueFiPool2__factory,
  CreditModel,
  CreditModel__factory,
} from 'contracts'

import { deployMockContract, MockContract, MockProvider, solidity } from 'ethereum-waffle'
import { ITimeAveragedBaseRateOracleJson, ITrueFiPool2WithDecimalsJson, SpotBaseRateOracleJson } from 'build'

use(solidity)

describe('CreditModel', () => {
  let provider: MockProvider
  let owner: Wallet
  let borrower: Wallet
  let creditModel: CreditModel
  let mockPool: MockContract
  let asset: MockErc20Token
  let mockSpotOracle: MockContract
  let oracle: TimeAveragedBaseRateOracle
  let mockFactory: IPoolFactory

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner, borrower] = wallets
    provider = _provider

    const deployContract = setupDeploy(owner)

    creditModel = await deployContract(CreditModel__factory)
    mockPool = await deployMockContract(owner, ITrueFiPool2WithDecimalsJson.abi)

    asset = await deployContract(MockErc20Token__factory)
    mockSpotOracle = await deployMockContract(owner, SpotBaseRateOracleJson.abi)
    await mockSpotOracle.mock.getRate.withArgs(asset.address).returns(300)

    oracle = await new TestTimeAveragedBaseRateOracle__factory(owner).deploy()
    await oracle.initialize(mockSpotOracle.address, asset.address, DAY)

    mockFactory = await deployContract(MockPoolFactory__factory)
    await creditModel.initialize(mockFactory.address)
  })

  describe('initializer', () => {
    it('transfers ownership', async () => {
      expect(await creditModel.owner()).to.eq(owner.address)
    })

    it('sets riskPremium', async () => {
      expect(await creditModel.riskPremium()).to.eq(200)
    })

    it('sets credit score rate config', async () => {
      expect(await creditModel.creditScoreRateConfig()).to.deep.eq([1000, 1])
    })

    it('sets utilization rate config', async () => {
      expect(await creditModel.utilizationRateConfig()).to.deep.eq([50, 2])
    })

    it('sets borrow limit config', async () => {
      expect(await creditModel.borrowLimitConfig()).to.deep.eq([40, 7500, 1500, 1500])
    })

    it('sets staking config', async () => {
      expect(await creditModel.stakingConfig()).to.deep.eq([4000, 1])
    })
  })

  describe('setRiskPremium', () => {
    it('reverts if caller is not the owner', async () => {
      await expect(creditModel.connect(borrower).setRiskPremium(0))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('sets riskPremium', async () => {
      await creditModel.setRiskPremium(300)
      expect(await creditModel.riskPremium()).to.eq(300)
    })

    it('emits event', async () => {
      await expect(creditModel.setRiskPremium(300))
        .to.emit(creditModel, 'RiskPremiumChanged')
        .withArgs(300)
    })
  })

  describe('setCreditScoreRateConfig', () => {
    it('reverts if caller is not the owner', async () => {
      await expect(creditModel.connect(borrower).setCreditScoreRateConfig(0, 0))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('sets credit score rate config', async () => {
      await creditModel.setCreditScoreRateConfig(1, 2)
      const [creditScoreRateCoefficient, creditScoreRatePower] = await creditModel.creditScoreRateConfig()
      expect([creditScoreRateCoefficient, creditScoreRatePower]).to.deep.eq([1, 2])
    })

    it('emits event', async () => {
      await expect(creditModel.setCreditScoreRateConfig(1, 2))
        .to.emit(creditModel, 'CreditScoreRateConfigChanged')
        .withArgs(1, 2)
    })
  })

  describe('setUtilizationRateConfig', () => {
    it('reverts if caller is not the owner', async () => {
      await expect(creditModel.connect(borrower).setUtilizationRateConfig(0, 0))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('sets utilization rate config', async () => {
      await creditModel.setUtilizationRateConfig(1, 2)
      const [utilizationRateCoefficient, utilizationRatePower] = await creditModel.utilizationRateConfig()
      expect([utilizationRateCoefficient, utilizationRatePower]).to.deep.eq([1, 2])
    })

    it('emits event', async () => {
      await expect(creditModel.setUtilizationRateConfig(1, 2))
        .to.emit(creditModel, 'UtilizationRateConfigChanged')
        .withArgs(1, 2)
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
      await expect(creditModel.connect(borrower).setBaseRateOracle(fakePool.address, fakeOracle.address))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('sets base rate oracle', async () => {
      await creditModel.setBaseRateOracle(fakePool.address, fakeOracle.address)
      expect(await creditModel.baseRateOracle(fakePool.address)).to.eq(fakeOracle.address)
    })

    it('emits event', async () => {
      await expect(creditModel.setBaseRateOracle(fakePool.address, fakeOracle.address))
        .to.emit(creditModel, 'BaseRateOracleChanged')
        .withArgs(fakePool.address, fakeOracle.address)
    })
  })

  describe('setFixedTermLoanAdjustmentCoefficient', () => {
    it('reverts if caller is not the owner', async () => {
      await expect(creditModel.connect(borrower).setFixedTermLoanAdjustmentCoefficient(0))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('sets fixed-term loan adjustment coefficient', async () => {
      await creditModel.setFixedTermLoanAdjustmentCoefficient(50)
      expect(await creditModel.fixedTermLoanAdjustmentCoefficient()).to.eq(50)
    })

    it('emits event', async () => {
      await expect(creditModel.setFixedTermLoanAdjustmentCoefficient(50))
        .to.emit(creditModel, 'FixedTermLoanAdjustmentCoefficientChanged')
        .withArgs(50)
    })
  })

  describe('setBorrowLimitConfig', () => {
    it('reverts if caller is not the owner', async () => {
      await expect(creditModel.connect(borrower).setBorrowLimitConfig(0, 0, 0, 0))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('sets borrow limit config', async () => {
      await creditModel.setBorrowLimitConfig(1, 2, 3, 4)
      expect(await creditModel.borrowLimitConfig()).to.deep.eq([1, 2, 3, 4])
    })

    it('emits event', async () => {
      await expect(creditModel.setBorrowLimitConfig(1, 2, 3, 4))
        .to.emit(creditModel, 'BorrowLimitConfigChanged')
        .withArgs(1, 2, 3, 4)
    })
  })

  describe('setStakingConfig', () => {
    it('reverts if caller is not the owner', async () => {
      await expect(creditModel.connect(borrower).setStakingConfig(0, 0))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('sets staking config', async () => {
      await creditModel.setStakingConfig(1, 2)
      expect(await creditModel.stakingConfig()).to.deep.eq([1, 2])
    })

    it('emits event', async () => {
      await expect(creditModel.setStakingConfig(1, 2))
        .to.emit(creditModel, 'StakingConfigChanged')
        .withArgs(1, 2)
    })
  })

  describe('rate', () => {
    let mockOracle: MockContract

    beforeEach(async () => {
      mockOracle = await deployMockContract(owner, ITimeAveragedBaseRateOracleJson.abi)
      await mockOracle.mock.getWeeklyAPY.returns(300)
      await creditModel.setBaseRateOracle(mockPool.address, mockOracle.address)
    })

    it('calculates pro forma rate correctly', async () => {
      await creditModel.setRiskPremium(100)
      const borrowerScore = 223
      // pool value: 100_000
      // initial utilization: 35%
      // pro forma utilization: 50%
      await mockPool.mock.liquidRatio.withArgs(15_000).returns(10000 - 50 * 100)
      const expectedProFormaRate = 693 // 300 + 100 + 143 + 150
      expect(await creditModel.rate(mockPool.address, borrowerScore, 15_000)).to.eq(expectedProFormaRate)
    })

    it('caps pro forma rate if it exceeds max rate', async () => {
      await creditModel.setRiskPremium(22600)
      const borrowerScore = 31
      // pool value: 100_000
      // initial utilization: 80%
      // pro forma utilization: 95%
      await mockPool.mock.liquidRatio.withArgs(15_000).returns(10000 - 95 * 100)
      const expectedProFormaRate = 50000 // min(300 + 22600 + 7225 + 19950 = 50075, 50000)
      expect(await creditModel.rate(mockPool.address, borrowerScore, 15_000)).to.eq(expectedProFormaRate)
    })
  })

  describe('poolBasicRate', () => {
    let mockOracle: MockContract

    beforeEach(async () => {
      mockOracle = await deployMockContract(owner, ITimeAveragedBaseRateOracleJson.abi)
      await mockOracle.mock.getWeeklyAPY.returns(300)
      await creditModel.setBaseRateOracle(mockPool.address, mockOracle.address)
    })

    it('calculates rate correctly', async () => {
      await creditModel.setRiskPremium(100)
      // pro forma utilization: 50%
      await mockPool.mock.liquidRatio.withArgs(15_000).returns(10000 - 50 * 100)
      const expectedPoolBasicRate = 550 // 300 + 100 + 150
      expect(await creditModel.poolBasicRate(mockPool.address, 15_000)).to.eq(expectedPoolBasicRate)
    })

    it('caps pool basic rate if it exceeds max rate', async () => {
      await creditModel.setRiskPremium(29825)
      // pro forma utilization: 95%
      await mockPool.mock.liquidRatio.withArgs(15_000).returns(10000 - 95 * 100)
      const expectedPoolBasicRate = 50000 // min(300 + 29825 + 19950 = 50075, 50000)
      expect(await creditModel.poolBasicRate(mockPool.address, 15_000)).to.eq(expectedPoolBasicRate)
    })
  })

  describe('fixedTermLoanAdjustment', () => {
    beforeEach(async () => {
      await creditModel.setFixedTermLoanAdjustmentCoefficient(25)
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
        expect(await creditModel.fixedTermLoanAdjustment(term)).to.eq(adjustment)
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
      it(`returns ${adjustment} if pro forma utilization is at ${utilization} percent`, async () => {
        await mockPool.mock.liquidRatio.withArgs(utilization).returns(10000 - utilization * 100)
        expect(await creditModel.utilizationAdjustmentRate(mockPool.address, utilization)).to.eq(adjustment)
      }),
    )
  })

  describe('Credit score rate adjustment', () => {
    [
      [255, 0],
      [223, 143],
      [191, 335],
      [159, 603],
      [127, 1007],
      [95, 1684],
      [63, 3047],
      [31, 7225],
      [5, 50000],
      [1, 50000],
      [0, 50000],
    ].map(([score, adjustment]) =>
      it(`returns ${adjustment} when score is ${score}`, async () => {
        expect(await creditModel.creditScoreAdjustmentRate(score)).to.equal(adjustment)
      }),
    )
  })

  describe('combinedRate', () => {
    it('returns sum of two rates', async () => {
      expect(await creditModel.combinedRate(29999, 20000)).to.eq(49999)
    })

    it('caps rate at 500%', async () => {
      expect(await creditModel.combinedRate(30000, 20001)).to.eq(50000)
    })
  })

  describe('borrowLimitAdjustment', () => {
    [
      [255, 10000],
      [223, 9043],
      [191, 8051],
      [159, 7016],
      [127, 5928],
      [95, 4768],
      [63, 3504],
      [31, 2058],
      [1, 156],
      [0, 0],
    ].map(([score, adjustment]) =>
      it(`returns ${adjustment} when score is ${score}`, async () => {
        expect(await creditModel.borrowLimitAdjustment(score)).to.equal(adjustment)
      }),
    )
  })

  describe('borrower TRU staking with TRU price at $0.25', () => {
    beforeEach(async () => {
      const oracle = await new MockUsdStableCoinOracle__factory(owner).deploy()
      await mockPool.mock.oracle.returns(oracle.address)
    })

    describe('conservativeCollateralValue', () => {
      [
        [0, 0, 0],
        [0, 100, 0],
        [100, 0, 0],
        [100, 40, 10],
        [100, 100, 25],
        [1000, 20, 50],
        [1000, 40, 100],
      ].map(([collateral, ltvRatio, result]) =>
        it(`when ${collateral} TRU is staked with ltvRatio=${ltvRatio}%, borrow limit rises by up to $${result}`, async () => {
          await creditModel.setStakingConfig(ltvRatio * 100, 0)
          expect(await creditModel.conservativeCollateralValue(mockPool.address, parseTRU(collateral))).to.equal(parseEth(result))
        }))
    })

    describe('conservativeCollateralRatio', () => {
      const collateral = 1000

      beforeEach(async () => {
        const ltvRatio = 40
        await creditModel.setStakingConfig(ltvRatio * 100, 0)
      })

      ;[
        [1000, 10],
        [500, 20],
        [250, 40],
        [200, 50],
        [100, 100],
        [75, 100],
        [0, 0],
      ].map(([borrowed, result]) =>
        it(`when borrowed amount is ${borrowed} collateral ratio is at ${result}%`, async () => {
          expect(await creditModel.conservativeCollateralRatio(mockPool.address, parseTRU(collateral), parseEth(borrowed)))
            .to.equal(result * 100)
        }))

      it('returns 0 if there is no collateral', async () => {
        expect(await creditModel.conservativeCollateralRatio(mockPool.address, 0, 100)).to.equal(0)
      })
    })

    describe('effectiveScore', () => {
      const collateral = 1000
      const borrowedAmount = 250
      const ltvRatio = 40

      describe('with effectiveScorePower = 1', () => {
        beforeEach(async () => {
          const effectiveScorePower = 1
          await creditModel.setStakingConfig(ltvRatio * 100, effectiveScorePower)
        })

        ;[
          [255, 255],
          [223, 235],
          [191, 216],
          [159, 197],
          [127, 178],
          [95, 159],
          [63, 139],
          [31, 120],
        ].map(([score, effectiveScore]) =>
          it(`staking ${collateral} TRU increases score from ${score} to ${effectiveScore}`, async () => {
            expect(await creditModel.effectiveScore(score, mockPool.address, parseTRU(collateral), parseEth(borrowedAmount))).to.eq(effectiveScore)
          }))
      })
      
      describe('with effectiveScorePower = 2', () => {
        beforeEach(async () => {
          const effectiveScorePower = 2
          await creditModel.setStakingConfig(ltvRatio * 100, effectiveScorePower)
        })

        ;[
          [255, 255],
          [223, 228],
          [191, 201],
          [159, 174],
          [127, 147],
          [95, 120],
          [63, 93],
          [31, 66],
        ].map(([score, effectiveScore]) =>
          it(`staking ${collateral} TRU increases score from ${score} to ${effectiveScore}`, async () => {
            expect(await creditModel.effectiveScore(score, mockPool.address, parseTRU(collateral), parseEth(borrowedAmount))).to.eq(effectiveScore)
          }))
      })

      it('doesn\'t depend on pool decimal count', async () => {
        await creditModel.setStakingConfig(ltvRatio * 100, 1)
        await mockPool.mock.decimals.returns(6)
        expect(await creditModel.effectiveScore(191, mockPool.address, parseTRU(collateral), parseEth(250))).to.eq(216)
        await mockPool.mock.decimals.returns(18)
        expect(await creditModel.effectiveScore(191, mockPool.address, parseTRU(collateral), parseEth(250))).to.eq(216)
      })

      describe('amount of collateral affects score', async () => {
        const borrowed = 250

        beforeEach(async () => {
          await creditModel.setStakingConfig(ltvRatio * 100, 1)
        })

        ;[
          [0, 0],
          [10, 0],
          [50, 1],
          [250, 6],
          [1000, 25],
          [2500, 64],
          [10**10, 64],
          ].map(([collateral, expectedScoreChange]) => 
          it(`when borrowed $${borrowed} staking ${collateral} TRU increases score by ${expectedScoreChange}`, async () => {
            const effectiveScore = await creditModel.effectiveScore(191, mockPool.address, parseTRU(collateral), parseEth(borrowed))
            const scoreChange = effectiveScore - 191
            expect(scoreChange).to.eq(expectedScoreChange)
          })
        )
      })
    })
  })

  describe('Borrow limit', () => {
    let mockPool2: MockContract

    beforeEach(async () => {
      mockPool2 = await deployMockContract(owner, ITrueFiPool2WithDecimalsJson.abi)
      const oracle1 = await new MockUsdStableCoinOracle__factory(owner).deploy()
      const oracle2 = await new MockUsdStableCoinOracle__factory(owner).deploy()
      await oracle2.setDecimalAdjustment(12)
      await mockPool.mock.decimals.returns(18)
      await mockPool.mock.poolValue.returns(parseEth(1e7))
      await mockPool.mock.oracle.returns(oracle1.address)
      await mockPool2.mock.decimals.returns(6)
      await mockPool2.mock.poolValue.returns(parseUSDC(1e7))
      await mockPool2.mock.oracle.returns(oracle2.address)
      await mockFactory.supportPool(mockPool.address)
      await mockFactory.supportPool(mockPool2.address)
    })

    it('borrow amount is limited by borrower limit', async () => {
      expect(await creditModel.borrowLimit(mockPool.address, 191, parseEth(100), 0, 0)).to.equal(parseEth(80.51)) // borrowLimitAdjustment(191)
    })

    it('borrow limit depends on decimal count of the pool', async () => {
      expect(await creditModel.borrowLimit(mockPool2.address, 191, parseEth(100), 0, 0)).to.equal(parseEth(80.51))
    })

    it('borrow amount is limited by total TVL', async () => {
      const maxTVLLimit = parseEth(20)
      await mockPool.mock.poolValue.returns(maxTVLLimit.sub(parseEth(1)))
      await mockPool2.mock.poolValue.returns(parseUSDC(1))
      expect(await creditModel.borrowLimit(mockPool.address, 191, parseEth(100), 0, 0)).to.equal(maxTVLLimit.mul(15).div(100).mul(8051).div(10000))
    })

    it('borrow amount is limited by a single pool value', async () => {
      await mockPool.mock.poolValue.returns(parseUSDC(100))
      await mockPool.mock.decimals.returns(18)
      expect(await creditModel.borrowLimit(mockPool.address, 191, parseEth(100), 0, 0)).to.equal(parseUSDC(100).mul(15).div(100))
    })

    it('borrow limit can be increased by staking TRU', async () => {
      expect(await creditModel.borrowLimit(mockPool.address, 191, parseEth(100), parseTRU(100), 0)).to.equal(parseEth(80.51).add(parseEth(10)))
      expect(await creditModel.borrowLimit(mockPool.address, 191, parseEth(100), parseTRU(1000), 0)).to.equal(parseEth(80.51).add(parseEth(100)))
    })

    it('collateral TRU cannot increase limit over TVL limit', async () => {
      const maxTVLLimit = parseEth(20)
      await mockPool.mock.poolValue.returns(maxTVLLimit.sub(parseEth(1)))
      await mockPool2.mock.poolValue.returns(parseUSDC(1))
      expect(await creditModel.borrowLimit(mockPool.address, 191, parseEth(1), 0, 0)).to.equal(parseEth(0.8051))
      expect(await creditModel.borrowLimit(mockPool.address, 191, parseEth(1), parseTRU(1000), 0)).to.equal(maxTVLLimit.mul(15).div(100).mul(8051).div(10000))
    })

    it('collateral TRU cannot increase limit over pool limit', async () => {
      await mockPool.mock.poolValue.returns(parseEth(20))
      await mockPool.mock.decimals.returns(18)
      expect(await creditModel.borrowLimit(mockPool.address, 191, parseEth(1), 0, 0)).to.equal(parseEth(0.8051))
      expect(await creditModel.borrowLimit(mockPool.address, 191, parseEth(1), parseTRU(1000), 0)).to.equal(parseEth(20).mul(15).div(100))
    })

    it('subtracts borrowed amount from credit limit', async () => {
      expect(await creditModel.borrowLimit(mockPool.address, 191, parseEth(100), 0, 100)).to.equal(parseEth(80.51).sub(100))
    })

    it('borrow limit is 0 if credit limit is below the borrowed amount', async () => {
      expect(await creditModel.borrowLimit(mockPool.address, 191, parseEth(100), 0, parseEth(100))).to.equal(0)
    })

    describe('isOverLimit', () => {
      it('returns true when over limit', async () => {
        expect(await creditModel.isOverLimit(mockPool.address, 191, parseEth(100), 0, parseEth(80.51).add(1))).to.equal(true)
      })

      it('returns false when below limit', async () => {
        expect(await creditModel.isOverLimit(mockPool.address, 191, parseEth(100), 0, parseEth(80.51))).to.equal(false)
      })
    })
  })

  const weeklyFillOracle = async (oracle: TimeAveragedBaseRateOracle) => {
    for (let i = 0; i < 7; i++) {
      const [, timestamps, currIndex] = await oracle.getTotalsBuffer()
      const newestTimestamp = timestamps[currIndex].toNumber()
      await timeTravelTo(provider, newestTimestamp + DAY - 1)
      await oracle.update()
    }
  }

  describe('securedRate', () => {
    beforeEach(async () => {
      await creditModel.setBaseRateOracle(mockPool.address, oracle.address)
      await weeklyFillOracle(oracle)
    })

    it('gets correct rate', async () => {
      expect(await creditModel.securedRate(mockPool.address)).to.eq(300)
    })

    it('changes with oracle update', async () => {
      await mockSpotOracle.mock.getRate.withArgs(asset.address).returns(307)
      await updateRateOracle(oracle, DAY, provider)
      expect(await creditModel.securedRate(mockPool.address)).to.eq(301)
    })
  })
})
