import {
  MockTrueCurrency,
  TrueFiPool2,
  FixedTermLoanAgency,
} from 'contracts'
import { BigNumber, Wallet } from 'ethers'
import { DAY } from './constants'

// When setting utilization above 30 percent
// slightly increases pool value
export const setUtilization = async (
  tusd: MockTrueCurrency,
  borrower1: Wallet,
  borrower2: Wallet,
  ftlAgency: FixedTermLoanAgency,
  owner: Wallet,
  pool: TrueFiPool2,
  utilization: number,
) => {
  if (utilization === 0) {
    return
  }

  await ftlAgency.allowBorrower(borrower1.address)

  const poolValue = await pool.poolValue()
  const utilizationAmount = poolValue.mul(utilization).div(100)
  if (utilization <= 15) {
    await ftlAgency.connect(borrower1).fund(pool.address, utilizationAmount, DAY, 2000)
    return
  }
  if (utilization <= 30) {
    await ftlAgency.connect(borrower1).fund(pool.address, poolValue.mul(15).div(100), DAY, 2000)
  } else {
    // bump liquidity temporarily to bypass
    // loan amount restriction of 15% pool value
    await tusd.mint(owner.address, poolValue.mul(9))
    await tusd.connect(owner).approve(pool.address, poolValue.mul(9))
    await pool.connect(owner).join(poolValue.mul(9))

    await ftlAgency.connect(borrower1).fund(pool.address, utilizationAmount, DAY, 2000)

    await pool.connect(owner).liquidExit(poolValue.mul(89).div(10))
  }

  await ftlAgency.allowBorrower(borrower2.address)

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
  await ftlAgency.connect(borrower2).fund(pool.address, loanAmount, DAY, 50000)
}
