import {
  LoanToken2,
  DeficiencyToken,
  DeficiencyToken__factory,
  TrueFiPool2,
  LoanFactory2,
} from 'contracts'
import { expect, use } from 'chai'
import { deployContract, solidity } from 'ethereum-waffle'
import { Wallet } from 'ethers'
import { beforeEachWithFixture } from 'utils/beforeEachWithFixture'
import { createLoan, parseEth, setupTruefi2 } from 'utils'

use(solidity)

describe('DeficiencyToken', () => {
  let owner: Wallet
  let pool: TrueFiPool2
  let loanFactory: LoanFactory2
  let loan: LoanToken2
  let deficiency: DeficiencyToken

  beforeEachWithFixture(async (wallets) => {
    [owner] = wallets

    ;({ standardPool: pool, loanFactory } = await setupTruefi2(owner))
    loan = await createLoan(loanFactory, owner, pool, parseEth(1), 1, 1)
    deficiency = await deployContract(owner, DeficiencyToken__factory, [loan.address, parseEth(1)])
  })

  it('sets loan address', async () => {
    expect(await deficiency.loan()).to.eq(loan.address)
  })

  it('mints tokens to the pool', async () => {
    expect(await deficiency.balanceOf(pool.address)).to.eq(parseEth(1))
  })

  it('returns correct version', async () => {
    expect(await deficiency.version()).to.eq(0)
  })
})
