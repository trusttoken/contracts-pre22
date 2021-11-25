import { BigNumber, ContractTransaction, Wallet } from 'ethers'
import { BulletLoans, BulletLoans__factory, MockUsdc, MockUsdc__factory } from 'contracts'
import { parseUSDC } from 'utils'
import { expect } from 'chai'
import { beforeEachWithFixture } from 'fixtures/beforeEachWithFixture'

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

  describe.only('createLoan', () => {
    let loanId: BigNumber
    beforeEach(async () => {
      loanId = await extractLoanId(bulletLoans.connect(portfolio).createLoan(token.address))
    })

    it('assigns loanIds sequentially', async () => {
      expect(loanId).to.equal(0)
      const loanId2 = await extractLoanId(bulletLoans.connect(portfolio).createLoan(token.address))
      expect(loanId2).to.equal(1)
    })

    it('mints loan to the portfolio', async () => {
      expect(await bulletLoans.ownerOf(loanId)).to.equal(portfolio.address)
    })
  })

  it('repays', async () => {
    await bulletLoans.connect(portfolio).createLoan(token.address)
    await token.mint(borrower.address, parseUSDC(6))
    await token.connect(borrower).approve(bulletLoans.address, parseUSDC(6))
    await bulletLoans.connect(borrower).repay(0, parseUSDC(6))
    expect(await token.balanceOf(portfolio.address)).to.eq(parseUSDC(6))
  })

  const extractLoanId = async (pendingTx: Promise<ContractTransaction>) => {
    const tx = await pendingTx
    const receipt = await tx.wait()
    const id = receipt.events
      .filter(({ address }) => address === bulletLoans.address)
      .find(({ event }) => event === 'Transfer')
      .args.tokenId
    return id
  }
})
