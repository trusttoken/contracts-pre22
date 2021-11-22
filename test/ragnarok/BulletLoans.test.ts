import { Wallet } from 'ethers'
import { BulletLoans, BulletLoans__factory, MockUsdc, MockUsdc__factory } from 'contracts'
import { parseUSDC } from 'utils'
import { beforeEachWithFixture } from 'utils/beforeEachWithFixture'
import { expect } from 'chai'

describe('BulletLoans', () => {
  let bulletLoans: BulletLoans
  let token: MockUsdc
  let owner: Wallet
  let portfolio: Wallet
  let borrower: Wallet

  beforeEachWithFixture(async (wallets) => {
    [owner, portfolio, borrower] = wallets
    bulletLoans = await new BulletLoans__factory(owner).deploy()
    token = await new MockUsdc__factory(owner).deploy()
  })

  it('createLoan', async () => {
    await bulletLoans.connect(portfolio).createLoan(token.address)
    expect(await bulletLoans.ownerOf(0)).to.eq(portfolio.address)
  })

  it('repays', async () => {
    await bulletLoans.connect(portfolio).createLoan(token.address)
    await token.mint(borrower.address, parseUSDC(6))
    await token.connect(borrower).approve(bulletLoans.address, parseUSDC(6))
    await bulletLoans.connect(borrower).repay(0, parseUSDC(6))
    expect(await token.balanceOf(portfolio.address)).to.eq(parseUSDC(6))
  })
})
