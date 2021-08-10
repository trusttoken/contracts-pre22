import { setupDeploy } from 'scripts/utils'
import { AddressZero } from '@ethersproject/constants'
import {
  ArbitraryDistributor__factory,
  ImplementationReference__factory, LinearTrueDistributor__factory, Liquidator2__factory,
  LoanFactory2__factory, MockTrueCurrency__factory,
  MockTrueFiPoolOracle__factory,
  PoolFactory__factory, StkTruToken__factory,
  Safu__factory,
  TrueFiPool2__factory,
  TrueLender2__factory,
  TrueRatingAgencyV2__factory,
  MockUsdc__factory,
  TrueCreditAgency__factory,
  TrueFiCreditOracle__factory,
} from 'contracts'
import { Wallet } from 'ethers'
import { parseTRU, YEAR } from '.'

export const setupTruefi2 = async (owner: Wallet, customDeployed?: any) => {
  const deployContract = setupDeploy(owner)

  // ====== DEPLOY ======
  const liquidator = await deployContract(Liquidator2__factory)
  const loanFactory = await deployContract(LoanFactory2__factory)
  const rater = await deployContract(TrueRatingAgencyV2__factory)
  const lender = customDeployed?.lender ? customDeployed.lender : await deployContract(TrueLender2__factory)
  const safu = await deployContract(Safu__factory)
  const creditAgency = await deployContract(TrueCreditAgency__factory)

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
  const linearDistributor = await deployContract(LinearTrueDistributor__factory)
  const arbitraryDistributor = await deployContract(ArbitraryDistributor__factory)

  // ====== SETUP ======
  await liquidator.initialize(stkTru.address, tru.address, loanFactory.address, safu.address)
  await loanFactory.initialize(poolFactory.address, lender.address, liquidator.address)
  await arbitraryDistributor.initialize(rater.address, tru.address, parseTRU(15e6))
  await rater.initialize(tru.address, stkTru.address, arbitraryDistributor.address, loanFactory.address)
  await lender.initialize(stkTru.address, poolFactory.address, rater.address, customDeployed?.oneInch ? customDeployed.oneInch.address : AddressZero, creditOracle.address)
  await safu.initialize(loanFactory.address, liquidator.address, customDeployed?.oneInch ? customDeployed.oneInch.address : AddressZero)
  await poolFactory.initialize(implementationReference.address, lender.address, safu.address)
  await creditAgency.initialize(creditOracle.address, 100)

  await poolFactory.allowToken(feeToken.address, true)
  await poolFactory.createPool(feeToken.address)
  const feePool = poolImplementation.attach(await poolFactory.pool(feeToken.address))
  await feePool.setOracle(feeTokenOracle.address)

  await poolFactory.allowToken(standardToken.address, true)
  await poolFactory.createPool(standardToken.address)
  const standardPool = poolImplementation.attach(await poolFactory.pool(standardToken.address))
  await standardPool.setOracle(standardTokenOracle.address)

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
  }
}
