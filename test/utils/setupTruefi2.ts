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
} from 'contracts'
import { Wallet } from 'ethers'

export const setupTruefi2 = async (owner: Wallet) => {
  const deployContract = setupDeploy(owner)

  // ====== DEPLOY ======
  const liquidator = await deployContract(Liquidator2__factory)
  const loanFactory = await deployContract(LoanFactory2__factory)
  const rater = await deployContract(TrueRatingAgencyV2__factory)
  const lender = await deployContract(TrueLender2__factory)
  const safu = await deployContract(Safu__factory)

  const poolFactory = await deployContract(PoolFactory__factory)
  const poolImplementation = await deployContract(TrueFiPool2__factory)
  const implementationReference = await deployContract(ImplementationReference__factory, poolImplementation.address)

  const tru = await deployContract(MockTrueCurrency__factory)
  const stkTru = await deployContract(StkTruToken__factory)
  const feeLpToken = await deployContract(MockUsdc__factory)
  const lpToken = await deployContract(MockTrueCurrency__factory)

  const oracle = await deployContract(MockTrueFiPoolOracle__factory, feeLpToken.address)
  const linearDistributor = await deployContract(LinearTrueDistributor__factory)
  const arbitraryDistributor = await deployContract(ArbitraryDistributor__factory)

  // ====== SETUP ======
  await liquidator.initialize(stkTru.address, tru.address, loanFactory.address, safu.address)
  await loanFactory.initialize(poolFactory.address, lender.address, liquidator.address)
  await arbitraryDistributor.initialize(rater.address, tru.address, 0)
  await rater.initialize(tru.address, stkTru.address, arbitraryDistributor.address, loanFactory.address)
  await lender.initialize(stkTru.address, poolFactory.address, rater.address, AddressZero)
  await safu.initialize(loanFactory.address, liquidator.address)
  await poolFactory.initialize(implementationReference.address, stkTru.address, lender.address, safu.address)

  await poolFactory.whitelist(feeLpToken.address, true)
  await poolFactory.createPool(feeLpToken.address)
  const feePool = poolImplementation.attach(await poolFactory.pool(feeLpToken.address))
  await feePool.setOracle(oracle.address)

  await poolFactory.whitelist(lpToken.address, true)
  await poolFactory.createPool(lpToken.address)
  const standardPool = poolImplementation.attach(await poolFactory.pool(lpToken.address))
  await standardPool.setOracle(oracle.address)
  
  await lender.setFee(0)
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
    feeLpToken,
    lpToken,
    oracle,
    rater,
    linearDistributor,
    arbitraryDistributor,
    feePool,
    standardPool,
    safu,
  }
}
