import { DebtToken__factory, LoanFactory2, MockTrueCurrency, Safu, StkTruToken, TrueCreditAgency, TrueFiCreditOracle, TrueFiPool2 } from 'contracts'
import { expect, use } from 'chai'
import { MockProvider, solidity } from 'ethereum-waffle'
import { ContractTransaction, Wallet } from 'ethers'
import {
  beforeEachWithFixture,
  DAY,
  parseEth,
  parseTRU,
  setupTruefi2,
  timeTravel as _timeTravel,
} from 'utils'

use(solidity)

const MONTH = DAY * 31

describe('Lines Of Credit flow', () => {
  let provider: MockProvider
  let owner: Wallet
  let borrower: Wallet
  let staker: Wallet
  let creditAgency: TrueCreditAgency
  let tusd: MockTrueCurrency
  let pool: TrueFiPool2
  let loanFactory: LoanFactory2
  let creditOracle: TrueFiCreditOracle
  let safu: Safu
  let tru: MockTrueCurrency
  let stkTru: StkTruToken
  let timeTravel: (time: number) => void

  async function extractDebtTokens (pendingTx: Promise<ContractTransaction>) {
    const tx = await pendingTx
    const receipt = await tx.wait()
    const iface = loanFactory.interface
    return Promise.all(receipt.events
      .filter(({ address }) => address === loanFactory.address)
      .map((e) => iface.parseLog(e))
      .filter(({ eventFragment }) => eventFragment.name === 'DebtTokenCreated')
      .map((e) => DebtToken__factory.connect(e.args.contractAddress, owner)))
  }

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner, borrower, staker] = wallets
    timeTravel = (time: number) => _timeTravel(_provider, time)
    provider = _provider

    ; ({
      standardToken: tusd,
      standardPool: pool,
      loanFactory,
      creditAgency,
      creditOracle,
      safu,
      tru,
      stkTru,
    } = await setupTruefi2(owner, provider))

    await pool.setCreditAgency(creditAgency.address)

    await tusd.mint(owner.address, parseEth(1e7))
    await tusd.approve(pool.address, parseEth(1e7))
    await pool.join(parseEth(1e7))

    await tru.mint(staker.address, parseTRU(1e6))
    await tru.connect(staker).approve(stkTru.address, parseTRU(1e6))
    await stkTru.connect(staker).stake(parseTRU(1e6))

    await creditOracle.setScore(borrower.address, 255)
    await creditOracle.setMaxBorrowerLimit(borrower.address, parseEth(100_000_000))

    await creditAgency.allowBorrower(borrower.address, true)
    await tusd.mint(borrower.address, parseEth(1e6))
    await tusd.connect(borrower).approve(creditAgency.address, parseEth(1e6))

    await tusd.mint(safu.address, parseEth(1e7))
  })

  it('from borrow to defaulted debt repayment', async () => {
    const poolBalanceBefore = await tusd.balanceOf(pool.address)
    const safuBalanceBefore = await tusd.balanceOf(safu.address)

    // borrows 1 million tusd
    await creditAgency.connect(borrower).borrow(pool.address, parseEth(1e6))

    // month passes and borrower repays interest
    await timeTravel(MONTH)
    await creditAgency.connect(borrower).payInterest(pool.address)

    // another month passes and borrower repays interest and 50% of principal
    await timeTravel(MONTH)
    await creditAgency.connect(borrower).payInterest(pool.address)
    await creditAgency.connect(borrower).repay(pool.address, parseEth(5e5))

    // 2 months without repayment pass and the line gets defaulted
    await timeTravel(MONTH * 2)
    const debtToken = (await extractDebtTokens(creditAgency.enterDefault(borrower.address)))[0]

    const poolValueBefore = await pool.poolValue()
    await safu.liquidate([debtToken.address])
    expect(await pool.poolValue()).to.eq(poolValueBefore)

    // borrower repays the debt
    const debt = await debtToken.totalSupply()
    await tusd.connect(borrower).transfer(debtToken.address, debt)

    // safu redeems the debt
    await safu.redeem(debtToken.address)

    const totalInterest = await creditAgency.poolTotalPaidInterest(pool.address)
    expect(await tusd.balanceOf(pool.address)).to.eq(poolBalanceBefore.add(totalInterest))
    expect(await tusd.balanceOf(safu.address)).to.eq(safuBalanceBefore)
  })
})
