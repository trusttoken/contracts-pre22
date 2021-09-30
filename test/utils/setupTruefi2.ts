import { setupDeploy } from 'scripts/utils'
import { AddressZero } from '@ethersproject/constants'
import {
  ArbitraryDistributor__factory,
  BorrowingMutex__factory,
  FixedTermLoanAgency,
  FixedTermLoanAgency__factory,
  ImplementationReference__factory,
  LinearTrueDistributor__factory,
  Liquidator2__factory,
  LoanToken2__factory,
  LoanFactory2__factory,
  MockTrueCurrency__factory,
  MockTrueFiPoolOracle__factory,
  MockUsdc__factory,
  PoolFactory__factory,
  Safu__factory,
  StkTruToken__factory,
  TestFixedTermLoanAgency,
  TestTrueLender,
  TimeAveragedBaseRateOracle,
  TimeAveragedBaseRateOracle__factory,
  LineOfCreditAgency__factory,
  TrueFiCreditOracle__factory,
  TrueFiPool2__factory,
  TrueLender2,
  TrueLender2__factory,
  CreditModel__factory,
  TrueRatingAgencyV2__factory,
  DebtToken__factory,
} from 'contracts'
import { Wallet } from 'ethers'
import { parseTRU, timeTravelTo, YEAR } from '.'
import { deployMockContract, MockProvider } from 'ethereum-waffle'
import { SpotBaseRateOracleJson, CreditModelJson } from 'build'
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
  const ftlAgency: FixedTermLoanAgency & TestFixedTermLoanAgency = customDeployed?.ftlAgency ? customDeployed.ftlAgency : await deployContract(FixedTermLoanAgency__factory)
  const safu = await deployContract(Safu__factory)
  const creditModel = await deployContract(CreditModel__factory)
  const mockCreditModel = await deployMockContract(owner, CreditModelJson.abi)
  const creditAgency = await deployContract(LineOfCreditAgency__factory)
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
  await liquidator.initialize(stkTru.address, tru.address, loanFactory.address, poolFactory.address, safu.address, standardTokenOracle.address)
  await loanFactory.initialize(poolFactory.address, ftlAgency.address, liquidator.address, mockCreditModel.address, creditOracle.address, borrowingMutex.address, creditAgency.address)
  const loanTokenImplementation = await new LoanToken2__factory(owner).deploy()
  const debtTokenImplementation = await new DebtToken__factory(owner).deploy()
  await loanFactory.setLoanTokenImplementation(loanTokenImplementation.address)
  await loanFactory.setDebtTokenImplementation(debtTokenImplementation.address)
  await arbitraryDistributor.initialize(rater.address, tru.address, parseTRU(15e6))
  await rater.initialize(tru.address, stkTru.address, arbitraryDistributor.address, loanFactory.address)
  await borrowingMutex.initialize()
  await lender.initialize(stkTru.address, poolFactory.address, customDeployed?.oneInch ? customDeployed.oneInch.address : AddressZero)
  await ftlAgency.initialize(stkTru.address, poolFactory.address, customDeployed?.oneInch ? customDeployed.oneInch.address : AddressZero, creditOracle.address, creditModel.address, borrowingMutex.address, loanFactory.address)
  await safu.initialize(loanFactory.address, liquidator.address, customDeployed?.oneInch ? customDeployed.oneInch.address : AddressZero)
  await poolFactory.initialize(implementationReference.address, lender.address, ftlAgency.address, safu.address, loanFactory.address)
  await creditModel.initialize(poolFactory.address)
  await creditAgency.initialize(creditOracle.address, creditModel.address, borrowingMutex.address, poolFactory.address, loanFactory.address)
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

  await mockCreditModel.mock.rate.returns(0)
  await mockCreditModel.mock.fixedTermLoanAdjustment.returns(0)

  await mockSpotOracle.mock.getRate.withArgs(standardToken.address).returns(300)
  await mockSpotOracle.mock.getRate.withArgs(feeToken.address).returns(300)
  await weeklyFillBaseRateOracles(standardBaseRateOracle, feeBaseRateOracle, provider)

  await creditOracle.initialize()
  await creditOracle.setManager(owner.address)

  await lender.setFee(0)
  await ftlAgency.setFee(0)
  await ftlAgency.setMaxLoanTerm(YEAR * 10)
  await ftlAgency.setLongTermLoanThreshold(YEAR * 10)
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
    mockCreditModel,
    borrowingMutex,
  }
}
