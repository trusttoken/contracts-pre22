import { setupDeploy } from 'scripts/utils'
import { deployMockContract, MockProvider } from 'ethereum-waffle'
import { DAY, parseEth, parseTRU } from 'utils'
import { AddressZero } from '@ethersproject/constants'
import {
  ImplementationReference__factory, Liquidator2__factory,
  LoanFactory2,
  LoanFactory2__factory, LoanToken2__factory, MockTrueCurrency__factory,
  MockTrueFiPoolOracle__factory,
  PoolFactory__factory, StkTruToken__factory,
  Safu__factory,
  TrueFiPool2,
  TrueFiPool2__factory,
  TrueLender2__factory,
  TrueRateAdjuster__factory,
} from 'contracts'
import {
  ITrueDistributorJson,
  TrueRatingAgencyV2Json,
} from 'build'
import { BigNumberish, Wallet } from 'ethers'
const YEAR = DAY * 365

export const trueFi2Fixture = async (_wallets: Wallet[], _provider: MockProvider) => {
  const [owner, otherWallet, borrower, ...wallets] = _wallets
  const provider = _provider
  const deployContract = setupDeploy(owner)

  const createLoan = async function (factory: LoanFactory2, creator: Wallet, pool: TrueFiPool2, amount: BigNumberish, duration: BigNumberish, apy: BigNumberish) {
    const loanTx = await factory.connect(creator).createLoanToken(pool.address, amount, duration, apy)
    const loanAddress = (await loanTx.wait()).events[0].args.contractAddress
    return new LoanToken2__factory(owner).attach(loanAddress)
  }

  const liquidator = await deployContract(Liquidator2__factory)
  const loanFactory = await deployContract(LoanFactory2__factory)
  const poolFactory = await deployContract(PoolFactory__factory)
  const tru = await deployContract(MockTrueCurrency__factory)
  const stkTru = await deployContract(StkTruToken__factory)
  const lender = await deployContract(TrueLender2__factory)
  const poolImplementation = await deployContract(TrueFiPool2__factory)
  const implementationReference = await deployContract(ImplementationReference__factory, poolImplementation.address)
  const token = await deployContract(MockTrueCurrency__factory)
  const oracle = await deployContract(MockTrueFiPoolOracle__factory, token.address)
  const safu = await deployContract(Safu__factory)
  const rateAdjuster = await deployContract(TrueRateAdjuster__factory, [100])

  const rater = await deployMockContract(owner, TrueRatingAgencyV2Json.abi)
  await rater.mock.getResults.returns(0, 0, parseTRU(15e6))
  const distributor = await deployMockContract(owner, ITrueDistributorJson.abi)
  await distributor.mock.nextDistribution.returns(0)

  await liquidator.initialize(stkTru.address, tru.address, loanFactory.address, safu.address)
  await loanFactory.initialize(poolFactory.address, lender.address, liquidator.address, rateAdjuster.address)
  await poolFactory.initialize(implementationReference.address, lender.address, safu.address)

  await poolFactory.allowToken(token.address, true)
  await poolFactory.createPool(token.address)
  const pool = poolImplementation.attach(await poolFactory.pool(token.address))
  await pool.setOracle(oracle.address)

  await tru.initialize()
  await stkTru.initialize(tru.address, pool.address, pool.address, distributor.address, liquidator.address)
  await lender.initialize(stkTru.address, poolFactory.address, rater.address, AddressZero, AddressZero)
  await lender.setFee(0)

  const loan = await createLoan(loanFactory, borrower, pool, parseEth(1000), YEAR, 1000)

  await token.mint(owner.address, parseEth(1e7))
  await token.approve(pool.address, parseEth(1e7))
  await tru.mint(owner.address, parseEth(1e7))
  await tru.approve(stkTru.address, parseEth(1e7))
  await tru.mint(otherWallet.address, parseEth(15e6))
  await tru.connect(otherWallet).approve(stkTru.address, parseEth(1e7))

  return {
    owner,
    otherWallet,
    borrower,
    provider,
    liquidator,
    loanFactory,
    poolFactory,
    tru,
    stkTru,
    lender,
    poolImplementation,
    implementationReference,
    token,
    oracle,
    rater,
    distributor,
    pool,
    loan,
    safu,
    wallets,
  } as const
}
