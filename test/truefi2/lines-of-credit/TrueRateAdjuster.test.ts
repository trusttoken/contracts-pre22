import { expect, use } from 'chai'
import { Wallet } from 'ethers'

import { beforeEachWithFixture, DAY, parseEth, parseUSDC, timeTravelTo, updateRateOracle } from 'utils'
import { setupDeploy } from 'scripts/utils'

import {
  TrueRateAdjuster,
  TrueRateAdjuster__factory,
  TrueFiPool2,
  TrueFiPool2__factory,
  TimeAveragedBaseRateOracle,
  TimeAveragedBaseRateOracle__factory,
  MockErc20Token__factory,
  MockErc20Token,
  TestTimeAveragedBaseRateOracle__factory,
} from 'contracts'

import { deployMockContract, MockContract, MockProvider, solidity } from 'ethereum-waffle'
import {
  ITrueFiPool2WithDecimalsJson,
  ITimeAveragedBaseRateOracleJson,
  SpotBaseRateOracleJson,
} from 'build'

use(solidity)

describe('TrueRateAdjuster', () => {
  let provider: MockProvider
  let owner: Wallet
  let borrower: Wallet
  let rateAdjuster: TrueRateAdjuster
  let mockPool: MockContract
  let asset: MockErc20Token
  let mockSpotOracle: MockContract
  let oracle: TimeAveragedBaseRateOracle

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner, borrower] = wallets
    provider = _provider

    const deployContract = setupDeploy(owner)

    rateAdjuster = await deployContract(TrueRateAdjuster__factory)
    mockPool = await deployMockContract(owner, ITrueFiPool2WithDecimalsJson.abi)

    asset = await deployContract(MockErc20Token__factory)
    mockSpotOracle = await deployMockContract(owner, SpotBaseRateOracleJson.abi)
    await mockSpotOracle.mock.getRate.withArgs(asset.address).returns(300)

    oracle = await new TestTimeAveragedBaseRateOracle__factory(owner).deploy()
    await oracle.initialize(mockSpotOracle.address, asset.address, DAY)

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

  describe('setBorrowLimitConfig', () => {
    it('reverts if caller is not the owner', async () => {
      await expect(rateAdjuster.connect(borrower).setBorrowLimitConfig(0, 0, 0, 0))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('sets borrow limit config', async () => {
      await rateAdjuster.setBorrowLimitConfig(1, 2, 3, 4)
      const [scoreFloor, limitAdjustmentPower, tvlLimitCoefficient, poolValueLimitCoefficient] = await rateAdjuster.borrowLimitConfig()
      expect([scoreFloor, limitAdjustmentPower, tvlLimitCoefficient, poolValueLimitCoefficient]).to.deep.eq([1, 2, 3, 4])
    })

    it('emits event', async () => {
      await expect(rateAdjuster.setBorrowLimitConfig(1, 2, 3, 4))
        .to.emit(rateAdjuster, 'BorrowLimitConfigChanged')
        .withArgs(1, 2, 3, 4)
    })
  })

  describe('rate', () => {
    let mockOracle: MockContract

    beforeEach(async () => {
      mockOracle = await deployMockContract(owner, ITimeAveragedBaseRateOracleJson.abi)
      await mockOracle.mock.getWeeklyAPY.returns(300)
      await rateAdjuster.setBaseRateOracle(mockPool.address, mockOracle.address)
    })

    it('calculates rate correctly', async () => {
      await rateAdjuster.setRiskPremium(100)
      const borrowerScore = 223
      await mockPool.mock.liquidRatio.returns(10000 - 50 * 100)
      const expectedCurrentRate = 693 // 300 + 100 + 143 + 150
      expect(await rateAdjuster.rate(mockPool.address, borrowerScore)).to.eq(expectedCurrentRate)
    })

    it('caps current rate if it exceeds max rate', async () => {
      await rateAdjuster.setRiskPremium(22600)
      const borrowerScore = 31
      await mockPool.mock.liquidRatio.returns(10000 - 95 * 100)
      const expectedCurrentRate = 50000 // min(300 + 22600 + 7225 + 19950 = 50075, 50000)
      expect(await rateAdjuster.rate(mockPool.address, borrowerScore)).to.eq(expectedCurrentRate)
    })
  })

  describe('proFormaRate', () => {
    let mockOracle: MockContract

    beforeEach(async () => {
      mockOracle = await deployMockContract(owner, ITimeAveragedBaseRateOracleJson.abi)
      await mockOracle.mock.getWeeklyAPY.returns(300)
      await rateAdjuster.setBaseRateOracle(mockPool.address, mockOracle.address)
    })

    it('calculates pro forma rate correctly', async () => {
      await rateAdjuster.setRiskPremium(100)
      const borrowerScore = 223
      // pool value: 100_000
      // initial utilization: 35%
      // pro forma utilization: 50%
      await mockPool.mock.proFormaLiquidRatio.withArgs(15_000).returns(10000 - 50 * 100)
      const expectedProFormaRate = 693 // 300 + 100 + 143 + 150
      expect(await rateAdjuster.proFormaRate(mockPool.address, borrowerScore, 15_000)).to.eq(expectedProFormaRate)
    })

    it('caps pro forma rate if it exceeds max rate', async () => {
      await rateAdjuster.setRiskPremium(22600)
      const borrowerScore = 31
      // pool value: 100_000
      // initial utilization: 80%
      // pro forma utilization: 95%
      await mockPool.mock.proFormaLiquidRatio.withArgs(15_000).returns(10000 - 95 * 100)
      const expectedProFormaRate = 50000 // min(300 + 22600 + 7225 + 19950 = 50075, 50000)
      expect(await rateAdjuster.proFormaRate(mockPool.address, borrowerScore, 15_000)).to.eq(expectedProFormaRate)
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
        await mockPool.mock.liquidRatio.returns(10000 - utilization * 100)
        expect(await rateAdjuster.utilizationAdjustmentRate(mockPool.address)).to.eq(adjustment)
      }),
    )
  })

  describe('proFormaUtilizationAdjustmentRate', () => {
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
        await mockPool.mock.proFormaLiquidRatio.withArgs(utilization).returns(10000 - utilization * 100)
        expect(await rateAdjuster.proFormaUtilizationAdjustmentRate(mockPool.address, utilization)).to.eq(adjustment)
      }),
    )
  })

  describe('combinedRate', () => {
    it('returns sum of two rates', async () => {
      expect(await rateAdjuster.combinedRate(29999, 20000)).to.eq(49999)
    })

    it('caps rate at 500%', async () => {
      expect(await rateAdjuster.combinedRate(30000, 20001)).to.eq(50000)
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
        expect(await rateAdjuster.borrowLimitAdjustment(score)).to.equal(adjustment)
      }),
    )
  })

  describe('Borrow limit', () => {
    beforeEach(async () => {
      await mockPool.mock.decimals.returns(18)
      await mockPool.mock.poolValue.returns(parseEth(1e7))
    })

    it('borrow amount is limited by borrower limit', async () => {
      expect(await rateAdjuster.borrowLimit(mockPool.address, 191, parseEth(100), parseEth(2e7), 0)).to.equal(parseEth(80.51)) // borrowLimitAdjustment(191)
    })

    it('borrow limit depends on decimal count of the pool', async () => {
      await mockPool.mock.decimals.returns(6)
      expect(await rateAdjuster.borrowLimit(mockPool.address, 191, parseEth(100), parseUSDC(2e7), 0)).to.equal(parseUSDC(80.51))
    })

    it('borrow amount is limited by total TVL', async () => {
      const maxTVLLimit = parseEth(10)
      expect(await rateAdjuster.borrowLimit(mockPool.address, 191, parseEth(100), maxTVLLimit, 0)).to.equal(maxTVLLimit.mul(15).div(100).mul(8051).div(10000))
    })

    it('borrow amount is limited by a single pool value', async () => {
      await mockPool.mock.poolValue.returns(parseUSDC(100))
      await mockPool.mock.decimals.returns(18)
      expect(await rateAdjuster.borrowLimit(mockPool.address, 191, parseEth(100), parseEth(2e7), 0)).to.equal(parseUSDC(100).mul(15).div(100))
    })

    it('subtracts borrowed amount from credit limit', async () => {
      expect(await rateAdjuster.borrowLimit(mockPool.address, 191, parseEth(100), parseEth(2e7), 100)).to.equal(parseEth(80.51).sub(100))
    })

    it('borrow limit is 0 if credit limit is below the borrowed amount', async () => {
      expect(await rateAdjuster.borrowLimit(mockPool.address, 191, parseEth(100), parseEth(2e7), parseEth(100))).to.equal(0)
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
      await rateAdjuster.setBaseRateOracle(mockPool.address, oracle.address)
      await weeklyFillOracle(oracle)
    })

    it('gets correct rate', async () => {
      expect(await rateAdjuster.securedRate(mockPool.address)).to.eq(300)
    })

    it('changes with oracle update', async () => {
      await mockSpotOracle.mock.getRate.withArgs(asset.address).returns(307)
      await updateRateOracle(oracle, DAY, provider)
      expect(await rateAdjuster.securedRate(mockPool.address)).to.eq(301)
    })
  })
})
