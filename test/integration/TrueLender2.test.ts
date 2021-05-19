import { forkChain } from './suite'
import { setupDeploy } from 'scripts/utils'
import {
  MockUsdStableCoinOracle__factory,
  Erc20Mock__factory,
  ImplementationReference__factory,
  TrueFiPool2,
  TrueFiPool2__factory,
  TrueLender2__factory,
  TrustToken,
  TrustToken__factory,
  PoolFactory__factory,
  TrueLender2,
  LoanFactory2__factory,
  LoanToken2,
  LoanToken2__factory,
  Erc20Mock,
} from 'contracts'
import { DAY, parseEth, parseTRU } from 'utils'
import fetch from 'node-fetch'
import { expect, use } from 'chai'
import { deployMockContract, MockContract, solidity } from 'ethereum-waffle'
import { utils, Wallet } from 'ethers'
import { TrueRatingAgencyJson } from 'build'
import { AddressZero } from '@ethersproject/constants'

use(solidity)

describe('TrueLender2', () => {
  const TRU_ADDRESS = '0x4c19596f5aaff459fa38b0f7ed92f11ae6543784'
  const USDC_ADDRESS = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
  const TUSD_ADDRESS = '0x0000000000085d4780B73119b644AE5ecd22b376'
  const INCH_ADDRESS = '0x11111112542D85B3EF69AE05771c2dCCff4fAa26'
  const TUSD_HOLDER = '0xE662710B76BF0Eda532b109Ac2f6C1ca8688210b'
  const OWNER = '0x52bc44d5378309EE2abF1539BF71dE1b7d7bE3b5'
  const provider = forkChain('https://eth-mainnet.alchemyapi.io/v2/Vc3xNXIWdxEbDOToa69DhWeyhgFVBDWl', [OWNER, TUSD_HOLDER])
  const owner = provider.getSigner(OWNER)
  const tusdHolder = provider.getSigner(TUSD_HOLDER)
  const deployContract = setupDeploy(owner)

  let feePool: TrueFiPool2
  let loanPool: TrueFiPool2
  let lender: TrueLender2
  let tru: TrustToken
  let mockRatingAgency: MockContract
  let stkTru: Wallet
  let tusd: Erc20Mock
  let usdc: Erc20Mock
  let loan: LoanToken2
  let contractAddress: string

  beforeEach(async () => {
    stkTru = Wallet.createRandom()
    const poolFactory = await deployContract(PoolFactory__factory)
    const poolImplementation = await deployContract(TrueFiPool2__factory)
    const implementationReference = await deployContract(ImplementationReference__factory, poolImplementation.address)
    tru = TrustToken__factory.connect(TRU_ADDRESS, owner)

    mockRatingAgency = await deployMockContract(owner, TrueRatingAgencyJson.abi)
    await mockRatingAgency.mock.getResults.returns(0, 0, parseTRU(50e6))

    lender = await deployContract(TrueLender2__factory)
    await lender.initialize(stkTru.address, poolFactory.address, mockRatingAgency.address, INCH_ADDRESS)

    await poolFactory.initialize(implementationReference.address, tru.address, lender.address)

    await poolFactory.whitelist(USDC_ADDRESS, true)
    usdc = Erc20Mock__factory.connect(USDC_ADDRESS, owner)
    await poolFactory.createPool(usdc.address)
    feePool = TrueFiPool2__factory.connect(await poolFactory.pool(usdc.address), owner)
    await lender.setFeePool(feePool.address)

    await poolFactory.whitelist(TUSD_ADDRESS, true)
    tusd = Erc20Mock__factory.connect(TUSD_ADDRESS, owner)
    await poolFactory.createPool(tusd.address)
    loanPool = TrueFiPool2__factory.connect(await poolFactory.pool(tusd.address), owner)

    const loanFactory = await new LoanFactory2__factory(owner).deploy()
    await loanFactory.initialize(poolFactory.address, lender.address, AddressZero)

    const tx = await loanFactory.createLoanToken(loanPool.address, parseEth(100000), 1000, DAY * 365)
    const creationEvent = (await tx.wait()).events[0]
    ;({ contractAddress } = creationEvent.args)

    loan = LoanToken2__factory.connect(contractAddress, owner)
  })

  xit('ensure max 1% swap fee slippage', async () => {
    const oracle = await deployContract(MockUsdStableCoinOracle__factory)
    await loanPool.setOracle(oracle.address)

    await tusd.connect(tusdHolder).approve(loanPool.address, parseEth(100000))
    await loanPool.connect(tusdHolder).join(parseEth(100000))
    await lender.fund(loan.address)
    const debt = await loan.debt()
    await tusd.connect(tusdHolder).transfer(loan.address, debt)
    await loan.settle()

    const dataUrl = `https://api.1inch.exchange/v3.0/1/swap?disableEstimate=true&protocols=UNISWAP_V2,SUSHI&allowPartialFill=false&fromTokenAddress=${TUSD_ADDRESS}&toTokenAddress=${USDC_ADDRESS}&amount=${parseEth(1000)}&fromAddress=${lender.address}&slippage=1`
    const body = await (await fetch(dataUrl)).json()
    const data = body.tx.data

    await lender.reclaim(loan.address, data)
    expect(await feePool.balanceOf(stkTru.address)).to.gt(utils.parseUnits('100', 6).mul(98).div(100))
  })
})
