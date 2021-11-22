import { Wallet } from 'ethers'
import { BulletLoans, BulletLoans__factory } from 'contracts'
import { beforeEachWithFixture } from 'utils/beforeEachWithFixture'
import { expect } from 'chai'

describe('BulletLoans', () => {
  let bulletLoans: BulletLoans
  let owner: Wallet
  let portfolio: Wallet
  let borrower: Wallet

  beforeEachWithFixture(async (wallets) => {
    [owner, portfolio, borrower] = wallets
    bulletLoans = await new BulletLoans__factory(owner).deploy()
  })

  it('mintLoan', async () => {
    await bulletLoans.connect(portfolio).mintLoan()
    expect(await bulletLoans.ownerOf(0)).to.eq(portfolio.address)
  })
})
