import { expect, use } from 'chai'
import { Wallet } from 'ethers'

import {
  beforeEachWithFixture,
  createLoan,
  DAY, YEAR, expectScaledCloseTo,
  parseEth,
  parseUSDC,
  setupTruefi2, timeTravel,
  timeTravelTo,
  updateRateOracle,
} from 'utils'
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

    it('sets credit score rate config', async () => {
      expect(await rateAdjuster.creditScoreRateConfig()).to.deep.eq([1000, 1])
    })

    it('sets utilization rate config', async () => {
      expect(await rateAdjuster.utilizationRateConfig()).to.deep.eq([50, 2])
    })
  })

  describe('addPoolToTVL', () => {
    const pool1 = '0x1111111111111111111111111111111111111111'
    const pool2 = '0x2222222222222222222222222222222222222222'
    const pool3 = '0x3333333333333333333333333333333333333333'
    const pool4 = '0x4444444444444444444444444444444444444444'

    beforeEach(async () => {
      await rateAdjuster.addPoolToTVL(pool1)
      await rateAdjuster.addPoolToTVL(pool2)
      await rateAdjuster.addPoolToTVL(pool4)
    })

    it('reverts if caller is not the owner', async () => {
      await expect(rateAdjuster.connect(borrower).addPoolToTVL(pool3))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('reverts if pool has already been added', async () => {
      await expect(rateAdjuster.addPoolToTVL(pool2))
        .to.be.revertedWith('TrueRateAdjuster: Pool has already been added to TVL')
    })

    it('adds pools to array', async () => {
      await rateAdjuster.addPoolToTVL(pool3)

      expect(await rateAdjuster.tvlPools(0)).eq(pool1)
      expect(await rateAdjuster.tvlPools(1)).eq(pool2)
      expect(await rateAdjuster.tvlPools(2)).eq(pool4)
      expect(await rateAdjuster.tvlPools(3)).eq(pool3)
    })

    it('emits event', async () => {
      await expect(rateAdjuster.addPoolToTVL(pool3))
        .to.emit(rateAdjuster, 'PoolAddedToTVL')
        .withArgs(pool3)
    })
  })

  describe('removePoolFromTVL', () => {
    const pool1 = '0x1111111111111111111111111111111111111111'
    const pool2 = '0x2222222222222222222222222222222222222222'
    const pool3 = '0x3333333333333333333333333333333333333333'
    const pool4 = '0x4444444444444444444444444444444444444444'

    beforeEach(async () => {
      await rateAdjuster.addPoolToTVL(pool1)
      await rateAdjuster.addPoolToTVL(pool2)
      await rateAdjuster.addPoolToTVL(pool4)
    })

    it('reverts if caller is not the owner', async () => {
      await expect(rateAdjuster.connect(borrower).removePoolFromTVL(pool2))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('reverts if pool not in array', async () => {
      await expect(rateAdjuster.removePoolFromTVL(pool3)).to.be.revertedWith('TrueRateAdjuster: Pool already removed from TVL')
    })

    it('removes pool from array', async () => {
      await rateAdjuster.removePoolFromTVL(pool2)

      expect(await rateAdjuster.tvlPools(0)).eq(pool1)
      expect(await rateAdjuster.tvlPools(1)).eq(pool4)
    })

    it('emits event', async () => {
      await expect(rateAdjuster.removePoolFromTVL(pool2))
        .to.emit(rateAdjuster, 'PoolRemovedFromTVL')
        .withArgs(pool2)
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

  describe('setCreditScoreRateConfig', () => {
    it('reverts if caller is not the owner', async () => {
      await expect(rateAdjuster.connect(borrower).setCreditScoreRateConfig(0, 0))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('sets credit score rate config', async () => {
      await rateAdjuster.setCreditScoreRateConfig(1, 2)
      const [creditScoreRateCoefficient, creditScoreRatePower] = await rateAdjuster.creditScoreRateConfig()
      expect([creditScoreRateCoefficient, creditScoreRatePower]).to.deep.eq([1, 2])
    })

    it('emits event', async () => {
      await expect(rateAdjuster.setCreditScoreRateConfig(1, 2))
        .to.emit(rateAdjuster, 'CreditScoreRateConfigChanged')
        .withArgs(1, 2)
    })
  })

  describe('setUtilizationRateConfig', () => {
    it('reverts if caller is not the owner', async () => {
      await expect(rateAdjuster.connect(borrower).setUtilizationRateConfig(0, 0))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('sets utilization rate config', async () => {
      await rateAdjuster.setUtilizationRateConfig(1, 2)
      const [utilizationRateCoefficient, utilizationRatePower] = await rateAdjuster.utilizationRateConfig()
      expect([utilizationRateCoefficient, utilizationRatePower]).to.deep.eq([1, 2])
    })

    it('emits event', async () => {
      await expect(rateAdjuster.setUtilizationRateConfig(1, 2))
        .to.emit(rateAdjuster, 'UtilizationRateConfigChanged')
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

    it('calculates pro forma rate correctly', async () => {
      await rateAdjuster.setRiskPremium(100)
      const borrowerScore = 223
      // pool value: 100_000
      // initial utilization: 35%
      // pro forma utilization: 50%
      await mockPool.mock.liquidRatio.withArgs(15_000).returns(10000 - 50 * 100)
      const expectedProFormaRate = 693 // 300 + 100 + 143 + 150
      expect(await rateAdjuster.rate(mockPool.address, borrowerScore, 15_000)).to.eq(expectedProFormaRate)
    })

    it('caps pro forma rate if it exceeds max rate', async () => {
      await rateAdjuster.setRiskPremium(22600)
      const borrowerScore = 31
      // pool value: 100_000
      // initial utilization: 80%
      // pro forma utilization: 95%
      await mockPool.mock.liquidRatio.withArgs(15_000).returns(10000 - 95 * 100)
      const expectedProFormaRate = 50000 // min(300 + 22600 + 7225 + 19950 = 50075, 50000)
      expect(await rateAdjuster.rate(mockPool.address, borrowerScore, 15_000)).to.eq(expectedProFormaRate)
    })
  })

  describe('poolBasicRate', () => {
    let mockOracle: MockContract

    beforeEach(async () => {
      mockOracle = await deployMockContract(owner, ITimeAveragedBaseRateOracleJson.abi)
      await mockOracle.mock.getWeeklyAPY.returns(300)
      await rateAdjuster.setBaseRateOracle(mockPool.address, mockOracle.address)
    })

    it('calculates rate correctly', async () => {
      await rateAdjuster.setRiskPremium(100)
      // pro forma utilization: 50%
      await mockPool.mock.liquidRatio.withArgs(15_000).returns(10000 - 50 * 100)
      const expectedPoolBasicRate = 550 // 300 + 100 + 150
      expect(await rateAdjuster.poolBasicRate(mockPool.address, 15_000)).to.eq(expectedPoolBasicRate)
    })

    it('caps pool basic rate if it exceeds max rate', async () => {
      await rateAdjuster.setRiskPremium(29825)
      // pro forma utilization: 95%
      await mockPool.mock.liquidRatio.withArgs(15_000).returns(10000 - 95 * 100)
      const expectedPoolBasicRate = 50000 // min(300 + 29825 + 19950 = 50075, 50000)
      expect(await rateAdjuster.poolBasicRate(mockPool.address, 15_000)).to.eq(expectedPoolBasicRate)
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
      it(`returns ${adjustment} if pro forma utilization is at ${utilization} percent`, async () => {
        await mockPool.mock.liquidRatio.withArgs(utilization).returns(10000 - utilization * 100)
        expect(await rateAdjuster.utilizationAdjustmentRate(mockPool.address, utilization)).to.eq(adjustment)
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
        expect(await rateAdjuster.creditScoreAdjustmentRate(score)).to.equal(adjustment)
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

  describe('tvl', () => {
    let loan
    let lender

    beforeEach(async () => {
      const { loanFactory, standardPool: pool, lender: _lender, standardToken: tusd, creditOracle } = await setupTruefi2(owner, provider)
      loan = await createLoan(loanFactory, borrower, pool, 1_000_000, YEAR, 1000)
      lender = _lender

      const mockPool1 = await deployMockContract(owner, ITrueFiPool2WithDecimalsJson.abi)
      const mockPool2 = await deployMockContract(owner, ITrueFiPool2WithDecimalsJson.abi)
      await rateAdjuster.addPoolToTVL(pool.address)
      await rateAdjuster.addPoolToTVL(mockPool1.address)
      await rateAdjuster.addPoolToTVL(mockPool2.address)

      await tusd.mint(owner.address, parseEth(1e7))
      await tusd.approve(pool.address, parseEth(1e7))
      await pool.join(parseEth(1e7))
      await mockPool1.mock.decimals.returns(18)
      await mockPool1.mock.poolValue.returns(parseEth(1e7))
      await mockPool2.mock.decimals.returns(18)
      await mockPool2.mock.poolValue.returns(parseEth(1e7))

      await creditOracle.setScore(borrower.address, 255)
      await creditOracle.setMaxBorrowerLimit(borrower.address, parseEth(100_000_000))
    })

    it('tvl returns sum of poolValues of all pools with 18 decimals precision', async () => {
      expect(await rateAdjuster.tvl(18)).to.equal(parseEth(3e7))
    })

    it('tvl remains unchanged after borrowing', async () => {
      expect(await rateAdjuster.tvl(18)).to.equal(parseEth(3e7))
      await lender.connect(borrower).fund(loan.address)
      expect(await rateAdjuster.tvl(18)).to.equal(parseEth(3e7))
    })

    it('tvl scales with loan interest', async () => {
      expect(await rateAdjuster.tvl(18)).to.equal(parseEth(3e7))
      await lender.connect(borrower).fund(loan.address)
      await timeTravel(provider, YEAR / 2)
      expectScaledCloseTo(await rateAdjuster.tvl(18), parseEth(3e7).add(parseEth(1).div(2)))
      await timeTravel(provider, YEAR)
      expectScaledCloseTo(await rateAdjuster.tvl(18), parseEth(3e7).add(parseEth(1)))
    })

    it('newly added pool correctly effects tvl', async () => {
      const mockPool3 = await deployMockContract(owner, ITrueFiPool2WithDecimalsJson.abi)
      await mockPool3.mock.decimals.returns(18)
      await mockPool3.mock.poolValue.returns(0)

      expect(await rateAdjuster.tvl(18)).to.equal(parseEth(3e7))
      await rateAdjuster.addPoolToTVL(mockPool3.address)
      expect(await rateAdjuster.tvl(18)).to.equal(parseEth(3e7))

      await mockPool3.mock.poolValue.returns(parseEth(1e7))
      expect(await rateAdjuster.tvl(18)).to.equal(parseEth(4e7))
    })
  })

  describe('Borrow limit', () => {
    let mockPool2: MockContract

    beforeEach(async () => {
      mockPool2 = await deployMockContract(owner, ITrueFiPool2WithDecimalsJson.abi)
      await mockPool.mock.decimals.returns(18)
      await mockPool.mock.poolValue.returns(parseEth(1e7))
      await mockPool2.mock.decimals.returns(6)
      await mockPool2.mock.poolValue.returns(parseUSDC(1e7))
      await rateAdjuster.addPoolToTVL(mockPool.address)
      await rateAdjuster.addPoolToTVL(mockPool2.address)
    })

    it('borrow amount is limited by borrower limit', async () => {
      expect(await rateAdjuster.borrowLimit(mockPool.address, 191, parseEth(100), 0)).to.equal(parseEth(80.51)) // borrowLimitAdjustment(191)
    })

    it('borrow limit depends on decimal count of the pool', async () => {
      expect(await rateAdjuster.borrowLimit(mockPool2.address, 191, parseEth(100), 0)).to.equal(parseUSDC(80.51))
    })

    it('borrow amount is limited by total TVL', async () => {
      const maxTVLLimit = parseEth(20)
      await mockPool.mock.poolValue.returns(maxTVLLimit.sub(parseEth(1)))
      await mockPool2.mock.poolValue.returns(parseUSDC(1))
      expect(await rateAdjuster.borrowLimit(mockPool.address, 191, parseEth(100), 0)).to.equal(maxTVLLimit.mul(15).div(100).mul(8051).div(10000))
    })

    it('borrow amount is limited by a single pool value', async () => {
      await mockPool.mock.poolValue.returns(parseUSDC(100))
      await mockPool.mock.decimals.returns(18)
      expect(await rateAdjuster.borrowLimit(mockPool.address, 191, parseEth(100), 0)).to.equal(parseUSDC(100).mul(15).div(100))
    })

    it('subtracts borrowed amount from credit limit', async () => {
      expect(await rateAdjuster.borrowLimit(mockPool.address, 191, parseEth(100), 100)).to.equal(parseEth(80.51).sub(100))
    })

    it('borrow limit is 0 if credit limit is below the borrowed amount', async () => {
      expect(await rateAdjuster.borrowLimit(mockPool.address, 191, parseEth(100), parseEth(100))).to.equal(0)
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
