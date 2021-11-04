import {
  FixedTermLoanAgency,
  LoanFactory2,
  MockTrueCurrency,
  Safu,
  StkTruToken,
  TrueFiCreditOracle,
  TrueFiPool2,
  LoanToken2,
  BorrowingMutex,
} from 'contracts'
import { expect, use } from 'chai'
import { MockProvider, solidity } from 'ethereum-waffle'
import { ContractTransaction, Wallet } from 'ethers'
import {
  beforeEachWithFixture,
  DAY,
  extractDebtTokens,
  parseEth,
  parseTRU,
  setupTruefi2,
  timeTravel as _timeTravel,
  extractLoanTokenAddress as _extractLoanTokenAddress,
} from 'utils'

use(solidity)

const MONTH = DAY * 31

describe('Fixed-term loans flow', () => {
  let provider: MockProvider
  let owner: Wallet
  let borrower: Wallet
  let staker: Wallet
  let ftlAgency: FixedTermLoanAgency
  let tusd: MockTrueCurrency
  let pool: TrueFiPool2
  let loanFactory: LoanFactory2
  let creditOracle: TrueFiCreditOracle
  let safu: Safu
  let tru: MockTrueCurrency
  let stkTru: StkTruToken
  let borrowingMutex: BorrowingMutex

  let timeTravel: (time: number) => void
  let extractLoanTokenAddress: (pendingTx: Promise<ContractTransaction>) => Promise<LoanToken2>

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner, borrower, staker] = wallets
    timeTravel = (time: number) => _timeTravel(_provider, time)
    extractLoanTokenAddress = (pendingTx: Promise<ContractTransaction>) =>
      _extractLoanTokenAddress(pendingTx, owner, loanFactory)
    provider = _provider

    ; ({
      standardToken: tusd,
      standardPool: pool,
      loanFactory,
      ftlAgency,
      creditOracle,
      safu,
      tru,
      stkTru,
      borrowingMutex,
    } = await setupTruefi2(owner, provider))

    await tusd.mint(owner.address, parseEth(1e7))
    await tusd.approve(pool.address, parseEth(1e7))
    await pool.join(parseEth(1e7))

    await tru.mint(staker.address, parseTRU(1e6))
    await tru.connect(staker).approve(stkTru.address, parseTRU(1e6))
    await stkTru.connect(staker).stake(parseTRU(1e6))

    await creditOracle.setScore(borrower.address, 255)
    await creditOracle.setMaxBorrowerLimit(borrower.address, parseEth(100_000_000))

    await ftlAgency.allowBorrower(borrower.address)
    await tusd.mint(borrower.address, parseEth(1e6))
    await tusd.mint(safu.address, parseEth(1e7))
  })

  it('from borrow to defaulted debt repayment', async () => {
    const poolBalanceBefore = await tusd.balanceOf(pool.address)
    const safuBalanceBefore = await tusd.balanceOf(safu.address)

    // borrows 1 million tusd
    let tx = ftlAgency.connect(borrower).borrow(pool.address, parseEth(1e6), 3 * MONTH, 10000)
    const loan = await extractLoanTokenAddress(tx)

    // month passes and borrower makes a repayment
    await timeTravel(MONTH)
    await tusd.connect(borrower).approve(loan.address, parseEth(5e5))
    await loan.repay(borrower.address, parseEth(5e5))

    // no further repayments, end of the term, after grace period, loan gets defaulted
    await timeTravel(2 * MONTH)
    await timeTravel((await creditOracle.gracePeriod()).toNumber())
    tx = loan.enterDefault()
    const debtToken = (await extractDebtTokens(loanFactory, owner, tx))[0]

    // borrower pays part of unpaid debt to defaulted loan token
    // wouldn't be accounted as repayment so commented out
    // await tusd.connect(borrower).approve(loan.address, parseEth(5e5))
    // await loan.repay(borrower.address, parseEth(5e5))

    await ftlAgency.reclaim(loan.address, '0x')

    const poolValueBefore = await pool.poolValue()
    await safu.liquidate([debtToken.address])
    expect(await pool.poolValue()).to.eq(poolValueBefore)

    // borrower repays the debt
    const debt = await debtToken.totalSupply()
    await tusd.connect(borrower).approve(debtToken.address, debt)
    await debtToken.repayInFull(borrower.address)

    // safu redeems the debt
    await safu.redeem(debtToken.address)

    // borrower stays banned even after full repayment of defaulted loan
    expect(await borrowingMutex.locker(borrower.address)).to.eq('0x0000000000000000000000000000000000000001')

    const loanInterest = await loan.interest()
    expect(await tusd.balanceOf(pool.address)).to.eq(poolBalanceBefore.add(loanInterest))
    expect(await tusd.balanceOf(safu.address)).to.eq(safuBalanceBefore)
  })
})
