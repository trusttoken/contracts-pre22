import {
  MockTrueCurrency,
  TrueFiPool2,
  TrueLender2,
  LoanFactory2,
} from 'contracts'
import { BigNumber, Wallet } from 'ethers'
import { DAY } from './constants'
import { createLoan as _createLoan } from './createLoan'

// When setting utilization above 30 percent
// slightly increases pool value
export const setUtilization = async (
  tusd: MockTrueCurrency,
  loanFactory: LoanFactory2,
  borrower1: Wallet,
  borrower2: Wallet,
  lender: TrueLender2,
  owner: Wallet,
  pool: TrueFiPool2,
  utilization: number,
) => {
  if (utilization === 0) {
    return
  }

  const createLoan = async (borrower, amount) => _createLoan(
    loanFactory, borrower, pool,
    amount, DAY, 0,
  )

  const poolValue = await pool.poolValue()
  const utilizationAmount = poolValue.mul(utilization).div(100)
  if (utilization <= 15) {
    const loan = await createLoan(borrower1, utilizationAmount)
    await lender.connect(borrower1).fund(loan.address)
    return
  }
  if (utilization <= 30) {
    const loan = await createLoan(borrower1, poolValue.mul(15).div(100))
    await lender.connect(borrower1).fund(loan.address)
  } else {
    const loan = await createLoan(borrower1, utilizationAmount)

    // bump liquidity temporarily to bypass
    // loan amount restriction of 15% pool value
    await tusd.mint(owner.address, poolValue.mul(9))
    await tusd.connect(owner).approve(pool.address, poolValue.mul(9))
    await pool.connect(owner).join(poolValue.mul(9))

    await lender.connect(borrower1).fund(loan.address)

    await pool.connect(owner).liquidExit(poolValue.mul(9))
  }

  // fund the second loan to set exact utilization value
  let loanAmount = (await pool.liquidValue()).sub(
    BigNumber.from((100 - utilization) * 100)
      .mul(await pool.poolValue())
      .div(10000),
  )
  const liquidityLeft = await pool.liquidValue()
  if (loanAmount.gt(liquidityLeft)) {
    loanAmount = liquidityLeft
  }
  const loan = await createLoan(borrower2, loanAmount)
  await lender.connect(borrower2).fund(loan.address)
}
