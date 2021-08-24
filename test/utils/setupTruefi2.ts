import { setupDeploy } from 'scripts/utils'
import { AddressZero } from '@ethersproject/constants'
import {
  ArbitraryDistributor__factory,
  BorrowingMutex__factory,
  ImplementationReference__factory,
  LinearTrueDistributor__factory,
  Liquidator2__factory,
  LoanFactory2__factory,
  MockTrueCurrency__factory,
  MockTrueFiPoolOracle__factory,
  MockUsdc__factory,
  PoolFactory__factory,
  Safu__factory,
  StkTruToken__factory, TestTrueLender,
  TimeAveragedBaseRateOracle,
  TimeAveragedBaseRateOracle__factory,
  TrueCreditAgency__factory,
  TrueFiCreditOracle__factory,
  TrueFiPool2__factory,
  TrueLender2,
  TrueLender2__factory,
  TrueRateAdjuster__factory,
  TrueRatingAgencyV2__factory,
} from 'contracts'
import { Wallet } from 'ethers'
import { parseTRU, timeTravelTo, YEAR } from '.'
import { deployMockContract, MockProvider } from 'ethereum-waffle'
import { SpotBaseRateOracleJson, TrueRateAdjusterJson } from 'build'
import { DAY } from './constants'

const weeklyFillBaseRateOracles = async (tusdOracle: TimeAveragedBaseRateOracle, usdcOracle: TimeAveragedBaseRateOracle, provider: MockProvider) => {
  for (let i = 0; i < 7; i++) {
    const [, timestamps, currIndex] = await tusdOracle.getTotalsBuffer()
    const newestTimestamp = timestamps[currIndex].toNumber()
    await timeTravelTo(provider, newestTimestamp + DAY - 1)
    await tusdOracle.update()
    await usdcOracle.update()
  }
}

export const setupTruefi2 = async (owner: Wallet, provider: MockProvider, customDeployed?: any) => {
  const deployContract = setupDeploy(owner)

  // ====== DEPLOY ======
  const liquidator = await deployContract(Liquidator2__factory)
  const loanFactory = await deployContract(LoanFactory2__factory)
  const rater = await deployContract(TrueRatingAgencyV2__factory)
  const lender: TrueLender2 & TestTrueLender = customDeployed?.lender ? customDeployed.lender : await deployContract(TrueLender2__factory)
  const safu = await deployContract(Safu__factory)
  const rateAdjuster = await deployContract(TrueRateAdjuster__factory)
  const mockRateAdjuster = await deployMockContract(owner, TrueRateAdjusterJson.abi)
  const creditAgency = await deployContract(TrueCreditAgency__factory)
  const borrowingMutex = await deployContract(BorrowingMutex__factory)

  const poolFactory = await deployContract(PoolFactory__factory)
  const poolImplementation = await deployContract(TrueFiPool2__factory)
  const implementationReference = await deployContract(ImplementationReference__factory, poolImplementation.address)

  const tru = await deployContract(MockTrueCurrency__factory)
  const stkTru = await deployContract(StkTruToken__factory)
  const feeToken = await deployContract(MockUsdc__factory)
  const standardToken = await deployContract(MockTrueCurrency__factory)

  const feeTokenOracle = await deployContract(MockTrueFiPoolOracle__factory, feeToken.address)
  const standardTokenOracle = await deployContract(MockTrueFiPoolOracle__factory, standardToken.address)
  const creditOracle = await deployContract(TrueFiCreditOracle__factory)
  const standardBaseRateOracle = await deployContract(TimeAveragedBaseRateOracle__factory)
  const feeBaseRateOracle = await deployContract(TimeAveragedBaseRateOracle__factory)
  const mockSpotOracle = await deployMockContract(owner, SpotBaseRateOracleJson.abi)
  const linearDistributor = await deployContract(LinearTrueDistributor__factory)
  const arbitraryDistributor = await deployContract(ArbitraryDistributor__factory)

  // ====== SETUP ======
  await liquidator.initialize(stkTru.address, tru.address, loanFactory.address, safu.address)
  await loanFactory.initialize(poolFactory.address, lender.address, liquidator.address, mockRateAdjuster.address, creditOracle.address, borrowingMutex.address)
  await arbitraryDistributor.initialize(rater.address, tru.address, parseTRU(15e6))
  await rater.initialize(tru.address, stkTru.address, arbitraryDistributor.address, loanFactory.address)
  await borrowingMutex.initialize()
  await lender.initialize(stkTru.address, poolFactory.address, rater.address, customDeployed?.oneInch ? customDeployed.oneInch.address : AddressZero, creditOracle.address, borrowingMutex.address)
  await safu.initialize(loanFactory.address, liquidator.address, customDeployed?.oneInch ? customDeployed.oneInch.address : AddressZero)
  await poolFactory.initialize(implementationReference.address, lender.address, safu.address)
  await rateAdjuster.initialize()
  await creditAgency.initialize(creditOracle.address, rateAdjuster.address)
  await standardBaseRateOracle.initialize(mockSpotOracle.address, standardToken.address, DAY)
  await feeBaseRateOracle.initialize(mockSpotOracle.address, feeToken.address, DAY)

  await poolFactory.allowToken(feeToken.address, true)
  await poolFactory.createPool(feeToken.address)
  const feePool = poolImplementation.attach(await poolFactory.pool(feeToken.address))
  await feePool.setOracle(feeTokenOracle.address)

  await poolFactory.allowToken(standardToken.address, true)
  await poolFactory.createPool(standardToken.address)
  const standardPool = poolImplementation.attach(await poolFactory.pool(standardToken.address))
  await standardPool.setOracle(standardTokenOracle.address)

  await rateAdjuster.setBaseRateOracle(standardPool.address, standardBaseRateOracle.address)
  await rateAdjuster.setBaseRateOracle(feePool.address, feeBaseRateOracle.address)

  await borrowingMutex.allowLocker(lender.address, true)
  await borrowingMutex.allowLocker(creditAgency.address, true)

  await mockRateAdjuster.mock.rate.returns(0)
  await mockRateAdjuster.mock.fixedTermLoanAdjustment.returns(0)

  await mockSpotOracle.mock.getRate.withArgs(standardToken.address).returns(300)
  await mockSpotOracle.mock.getRate.withArgs(feeToken.address).returns(300)
  await weeklyFillBaseRateOracles(standardBaseRateOracle, feeBaseRateOracle, provider)

  await liquidator.setTokenApproval(feeToken.address, true)
  await liquidator.setTokenApproval(standardToken.address, true)

  await creditOracle.initialize()
  await creditOracle.setManager(owner.address)

  await lender.setFee(0)
  await lender.setMaxLoanTerm(YEAR * 10)
  await lender.setLongTermLoanThreshold(YEAR * 10)
  await rater.allowChangingAllowances(owner.address, true)

  await tru.initialize()
  await stkTru.initialize(tru.address, feePool.address, feePool.address, linearDistributor.address, liquidator.address)

  return {
    liquidator,
    loanFactory,
    poolFactory,
    tru,
    stkTru,
    lender,
    poolImplementation,
    implementationReference,
    feeToken,
    standardToken,
    feeTokenOracle,
    standardTokenOracle,
    rater,
    linearDistributor,
    arbitraryDistributor,
    feePool,
    standardPool,
    safu,
    creditAgency,
    creditOracle,
    mockSpotOracle,
    standardBaseRateOracle,
    feeBaseRateOracle,
    rateAdjuster,
    mockRateAdjuster,
    borrowingMutex,
  }
}
