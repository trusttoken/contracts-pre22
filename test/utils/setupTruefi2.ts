import { setupDeploy } from 'scripts/utils'
import { AddressZero } from '@ethersproject/constants'
import {
  ArbitraryDistributor__factory,
  BorrowingMutex__factory,
  CollateralVault__factory,
  CreditModel__factory,
  DebtToken__factory,
  FixedTermLoanAgency__factory,
  ImplementationReference__factory,
  LinearTrueDistributor__factory,
  LineOfCreditAgency__factory,
  Liquidator2__factory,
  LoanFactory2,
  LoanFactory2__factory,
  LoanToken2__factory,
  MockTrueCurrency__factory,
  MockTrueFiPoolOracle__factory,
  MockUsdc__factory,
  PoolFactory__factory,
  Safu__factory,
  StkTruToken__factory,
  TestLoanFactory,
  TestTrueLender,
  TestTrueRatingAgencyV2,
  TimeAveragedBaseRateOracle,
  TimeAveragedBaseRateOracle__factory,
  TimeAveragedTruPriceOracle,
  TimeAveragedTruPriceOracle__factory,
  TrueFiCreditOracle__factory,
  TrueFiPool2__factory,
  TrueLender2,
  TrueLender2__factory,
  TrueRatingAgencyV2,
  TrueRatingAgencyV2__factory,
} from 'contracts'
import { Wallet } from 'ethers'
import { parseTRU, timeTravelTo, YEAR } from '.'
import { deployMockContract, MockProvider } from 'ethereum-waffle'
import { AggregatorV3InterfaceJson, SpotBaseRateOracleJson } from 'build'
import { DAY } from './constants'

const weeklyFillOracles = async (tusdOracle: TimeAveragedBaseRateOracle, usdcOracle: TimeAveragedBaseRateOracle, weeklyTruOracle: TimeAveragedTruPriceOracle, provider: MockProvider) => {
  for (let i = 0; i < 7; i++) {
    const [, timestamps, currIndex] = await tusdOracle.getTotalsBuffer()
    const newestTimestamp = timestamps[currIndex].toNumber()
    await timeTravelTo(provider, newestTimestamp + DAY - 1)
    await tusdOracle.update()
    await usdcOracle.update()
    await weeklyTruOracle.update()
  }
}

export const setupTruefi2 = async (owner: Wallet, provider: MockProvider, customDeployed?: any) => {
  const deployContract = setupDeploy(owner)

  // ====== DEPLOY ======
  const liquidator = await deployContract(Liquidator2__factory)
  const loanFactory: LoanFactory2 & TestLoanFactory = customDeployed?.loanFactory ? customDeployed.loanFactory : await deployContract(LoanFactory2__factory)
  const rater: TrueRatingAgencyV2 & TestTrueRatingAgencyV2 = customDeployed?.rater ? customDeployed.rater : await deployContract(TrueRatingAgencyV2__factory)
  const lender: TrueLender2 & TestTrueLender = customDeployed?.lender ? customDeployed.lender : await deployContract(TrueLender2__factory)
  const ftlAgency = await deployContract(FixedTermLoanAgency__factory)
  const safu = await deployContract(Safu__factory)
  const creditModel = await deployContract(CreditModel__factory)
  const creditAgency = await deployContract(LineOfCreditAgency__factory)
  const borrowingMutex = await deployContract(BorrowingMutex__factory)
  const collateralVault = await deployContract(CollateralVault__factory)

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
  const mockTruOracle = await deployMockContract(owner, AggregatorV3InterfaceJson.abi)
  const linearDistributor = await deployContract(LinearTrueDistributor__factory)
  const weeklyTruPriceOracle = await deployContract(TimeAveragedTruPriceOracle__factory)
  const arbitraryDistributor = await deployContract(ArbitraryDistributor__factory)

  // ====== SETUP ======
  await liquidator.initialize(stkTru.address, tru.address, loanFactory.address, poolFactory.address, safu.address, standardTokenOracle.address, collateralVault.address)
  await loanFactory.initialize(ftlAgency.address, liquidator.address, creditOracle.address, borrowingMutex.address, creditAgency.address)
  const loanTokenImplementation = await new LoanToken2__factory(owner).deploy()
  const debtTokenImplementation = await new DebtToken__factory(owner).deploy()
  await loanFactory.setLoanTokenImplementation(loanTokenImplementation.address)
  await loanFactory.setDebtTokenImplementation(debtTokenImplementation.address)
  await arbitraryDistributor.initialize(rater.address, tru.address, parseTRU(15e6))
  await rater.initialize(tru.address, stkTru.address, arbitraryDistributor.address)
  await borrowingMutex.initialize()
  await weeklyTruPriceOracle.initialize(mockTruOracle.address, DAY)
  await collateralVault.initialize(tru.address, borrowingMutex.address, creditAgency.address, liquidator.address)
  await lender.initialize(stkTru.address, poolFactory.address, customDeployed?.oneInch ? customDeployed.oneInch.address : AddressZero)
  await ftlAgency.initialize(stkTru.address, poolFactory.address, customDeployed?.oneInch ? customDeployed.oneInch.address : AddressZero, creditOracle.address, creditModel.address, borrowingMutex.address, loanFactory.address, collateralVault.address)
  await safu.initialize(loanFactory.address, liquidator.address, customDeployed?.oneInch ? customDeployed.oneInch.address : AddressZero)
  await poolFactory.initialize(implementationReference.address, lender.address, ftlAgency.address, safu.address, loanFactory.address)
  await creditModel.initialize(poolFactory.address, weeklyTruPriceOracle.address)
  await creditAgency.initialize(creditOracle.address, creditModel.address, borrowingMutex.address, poolFactory.address, loanFactory.address, collateralVault.address)
  await standardBaseRateOracle.initialize(mockSpotOracle.address, standardToken.address, DAY)
  await feeBaseRateOracle.initialize(mockSpotOracle.address, feeToken.address, DAY)

  await poolFactory.allowToken(feeToken.address, true)
  await poolFactory.createPool(feeToken.address)
  const feePool = poolImplementation.attach(await poolFactory.pool(feeToken.address))
  await poolFactory.supportPool(feePool.address)
  await feePool.setOracle(feeTokenOracle.address)

  await poolFactory.allowToken(standardToken.address, true)
  await poolFactory.createPool(standardToken.address)
  const standardPool = poolImplementation.attach(await poolFactory.pool(standardToken.address))
  await poolFactory.supportPool(standardPool.address)
  await standardPool.setOracle(standardTokenOracle.address)

  await creditModel.setBaseRateOracle(standardPool.address, standardBaseRateOracle.address)
  await creditModel.setBaseRateOracle(feePool.address, feeBaseRateOracle.address)

  await borrowingMutex.allowLocker(lender.address, true)
  await borrowingMutex.allowLocker(ftlAgency.address, true)
  await borrowingMutex.allowLocker(creditAgency.address, true)

  await mockSpotOracle.mock.getRate.withArgs(standardToken.address).returns(300)
  await mockSpotOracle.mock.getRate.withArgs(feeToken.address).returns(300)
  await mockTruOracle.mock.latestRoundData.returns(0, parseTRU(0.25), 0, 0, 0)
  await weeklyFillOracles(standardBaseRateOracle, feeBaseRateOracle, weeklyTruPriceOracle, provider)

  await creditOracle.initialize()
  await creditOracle.setManager(owner.address)

  await lender.setFee(0)
  await ftlAgency.setFee(0)
  await ftlAgency.setMaxLoanTerm(YEAR * 10)
  await ftlAgency.setLongTermLoanThreshold(YEAR * 10)

  await tru.initialize()
  await stkTru.initialize(tru.address, feePool.address, feePool.address, linearDistributor.address, liquidator.address)

  return {
    liquidator,
    loanFactory,
    poolFactory,
    tru,
    stkTru,
    lender,
    ftlAgency,
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
    creditModel,
    borrowingMutex,
    collateralVault,
  }
}
