import { forkChain } from './suite'
import { setupDeploy } from 'scripts/utils'
import {
  BorrowingMutex,
  BorrowingMutex__factory,
  StakingVault__factory,
  Erc20Mock,
  Erc20Mock__factory,
  FixedTermLoanAgency,
  FixedTermLoanAgency__factory,
  ImplementationReference__factory,
  LoanFactory2,
  LoanFactory2__factory,
  LoanToken2,
  LoanToken2__factory,
  MockUsdStableCoinOracle__factory,
  PoolFactory__factory,
  TrueFiPool2,
  TrueFiPool2__factory,
} from 'contracts'
import { DAY, extractLoanTokenAddress, MAX_APY, parseEth } from 'utils'
import { expect, use } from 'chai'
import { deployMockContract, solidity } from 'ethereum-waffle'
import { utils, Wallet } from 'ethers'
import { TrueFiCreditOracleJson, RateModelJson, LineOfCreditAgencyJson } from 'build'
import { AddressZero } from '@ethersproject/constants'
import { mock1Inch_TL2 } from './data'

use(solidity)

describe('FixedTermLoanAgency', () => {
  const USDC_ADDRESS = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
  const USDT_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
  const TUSD_ADDRESS = '0x0000000000085d4780B73119b644AE5ecd22b376'
  const INCH_ADDRESS = '0x11111112542D85B3EF69AE05771c2dCCff4fAa26'
  const TUSD_HOLDER = '0xf977814e90da44bfa03b6295a0616a897441acec'
  const USDT_HOLDER = '0x2faf487a4414fe77e2327f0bf4ae2a264a776ad2'
  const OWNER = '0x52bc44d5378309EE2abF1539BF71dE1b7d7bE3b5'
  const provider = forkChain('https://eth-mainnet.alchemyapi.io/v2/Vc3xNXIWdxEbDOToa69DhWeyhgFVBDWl', [OWNER, TUSD_HOLDER, USDT_HOLDER], 13289115)
  const owner = provider.getSigner(OWNER)
  const tusdHolder = provider.getSigner(TUSD_HOLDER)
  const usdtHolder = provider.getSigner(USDT_HOLDER)
  const deployContract = setupDeploy(owner)

  let usdcFeePool: TrueFiPool2
  let usdtLoanPool: TrueFiPool2
  let tusdLoanPool: TrueFiPool2
  let ftlAgency: FixedTermLoanAgency
  let loanFactory: LoanFactory2
  let stkTru: Wallet
  let tusd: Erc20Mock
  let usdc: Erc20Mock
  let usdt: Erc20Mock
  let loan: LoanToken2
  let borrowingMutex: BorrowingMutex

  beforeEach(async () => {
    stkTru = Wallet.createRandom()
    const poolFactory = await deployContract(PoolFactory__factory)
    const poolImplementation = await deployContract(TrueFiPool2__factory)
    const implementationReference = await deployContract(ImplementationReference__factory, poolImplementation.address)
    loanFactory = await new LoanFactory2__factory(owner).deploy()

    const mockRateModel = await deployMockContract(owner, RateModelJson.abi)
    await mockRateModel.mock.rate.returns(0)
    await mockRateModel.mock.effectiveScore.returns(255)
    await mockRateModel.mock.fixedTermLoanAdjustment.returns(1000)
    const mockCreditOracle = await deployMockContract(owner, TrueFiCreditOracleJson.abi)
    await mockCreditOracle.mock.score.returns(255)
    await mockCreditOracle.mock.maxBorrowerLimit.withArgs(OWNER).returns(parseEth(100_000_000))
    await mockCreditOracle.mock.status.withArgs(OWNER).returns(0)

    const mockLineOfCreditAgency = await deployMockContract(owner, LineOfCreditAgencyJson.abi)
    await mockLineOfCreditAgency.mock.updateAllCreditScores.returns()

    borrowingMutex = await deployContract(BorrowingMutex__factory)
    await borrowingMutex.initialize()

    const stakingVault = await deployContract(StakingVault__factory)
    await stakingVault.initialize(stkTru.address, borrowingMutex.address, mockLineOfCreditAgency.address, AddressZero)

    ftlAgency = await deployContract(FixedTermLoanAgency__factory)
    await ftlAgency.initialize(stkTru.address, poolFactory.address, INCH_ADDRESS, mockCreditOracle.address, mockRateModel.address, borrowingMutex.address, loanFactory.address, stakingVault.address)
    await ftlAgency.allowBorrower(await owner.getAddress())

    await poolFactory.initialize(implementationReference.address, AddressZero, ftlAgency.address, AddressZero, AddressZero)

    await poolFactory.allowToken(USDC_ADDRESS, true)
    usdc = Erc20Mock__factory.connect(USDC_ADDRESS, owner)
    await poolFactory.createPool(usdc.address)
    usdcFeePool = TrueFiPool2__factory.connect(await poolFactory.pool(usdc.address), owner)
    await ftlAgency.setFeePool(usdcFeePool.address)

    await poolFactory.allowToken(TUSD_ADDRESS, true)
    tusd = Erc20Mock__factory.connect(TUSD_ADDRESS, owner)
    await poolFactory.createPool(tusd.address)
    tusdLoanPool = TrueFiPool2__factory.connect(await poolFactory.pool(tusd.address), owner)
    await poolFactory.supportPool(tusdLoanPool.address)

    await poolFactory.allowToken(USDT_ADDRESS, true)
    usdt = Erc20Mock__factory.connect(USDT_ADDRESS, owner)
    await poolFactory.createPool(usdt.address)
    usdtLoanPool = TrueFiPool2__factory.connect(await poolFactory.pool(usdt.address), owner)
    await poolFactory.supportPool(usdtLoanPool.address)

    await mockRateModel.mock.borrowLimit.withArgs(tusdLoanPool.address, 255, parseEth(100_000_000), 0, 0).returns(parseEth(100_000_000))
    await mockRateModel.mock.borrowLimit.withArgs(usdtLoanPool.address, 255, parseEth(100_000_000), 0, 0).returns(parseEth(100_000_000))

    const loanTokenImplementation = await new LoanToken2__factory(owner).deploy()
    await loanFactory.initialize(ftlAgency.address, AddressZero, mockCreditOracle.address, borrowingMutex.address, AddressZero)
    await loanFactory.setLoanTokenImplementation(loanTokenImplementation.address)
    await borrowingMutex.allowLocker(ftlAgency.address, true)
  })

  it('ensure max 1% swap fee slippage', async () => {
    const oracle = await deployContract(MockUsdStableCoinOracle__factory)
    await tusdLoanPool.setOracle(oracle.address)

    await tusd.connect(tusdHolder).approve(tusdLoanPool.address, parseEth(1_000_000))
    await tusdLoanPool.connect(tusdHolder).join(parseEth(1_000_000))
    loan = await extractLoanTokenAddress(ftlAgency.borrow(tusdLoanPool.address, parseEth(1_000_000), DAY * 90, MAX_APY), owner, loanFactory)
    const debt = await loan.debt()
    await tusd.connect(tusdHolder).transfer(loan.address, debt)
    await loan.settle()
    const fee = debt.sub(parseEth(1_000_000)).div(10)

    const data = mock1Inch_TL2()

    await ftlAgency.reclaim(loan.address, data)

    const reclaimedFee = await usdcFeePool.balanceOf(stkTru.address)
    expect(reclaimedFee.mul(utils.parseUnits('1', 12))).to.gt(fee.mul(98).div(100))
    expect(reclaimedFee.mul(utils.parseUnits('1', 12))).to.lt(fee.mul(102).div(100))
  })

  it('funds tether loan tokens', async () => {
    const oracle = await deployContract(MockUsdStableCoinOracle__factory)
    await usdtLoanPool.setOracle(oracle.address)

    await usdt.connect(usdtHolder).approve(usdtLoanPool.address, 10_000_000)
    await usdtLoanPool.connect(usdtHolder).join(10_000_000)

    await expect(ftlAgency.borrow(usdtLoanPool.address, 10_000_000, DAY * 50, MAX_APY)).not.to.be.reverted
  })
})
