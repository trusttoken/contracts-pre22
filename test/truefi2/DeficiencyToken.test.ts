import {
  LoanToken2,
  TestDeficiencyToken,
  TestDeficiencyToken__factory,
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
  let owner: Wallet, friend: Wallet, stranger: Wallet
  let pool: TrueFiPool2
  let loanFactory: LoanFactory2
  let loan: LoanToken2
  let deficiency: TestDeficiencyToken

  beforeEachWithFixture(async (wallets, provider) => {
    [owner, friend, stranger] = wallets

    ;({ standardPool: pool, loanFactory } = await setupTruefi2(owner, provider))
    loan = await createLoan(loanFactory, owner, pool, parseEth(1), 1, 1)
    deficiency = await deployContract(owner, TestDeficiencyToken__factory, [loan.address, parseEth(1)])
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

  describe('Burn', () => {
    it('burns correct amount from allowed account', async () => {
      await deficiency.mint(owner.address, parseEth(3))
      await deficiency.connect(owner).approve(friend.address, parseEth(2))
      await deficiency.connect(friend).burnFrom(owner.address, parseEth(2))
      expect(await deficiency.balanceOf(owner.address)).to.eq(parseEth(1))
    })

    it('reverts excessive burn from allowed account', async () => {
      await deficiency.mint(owner.address, parseEth(3))
      await deficiency.connect(owner).approve(friend.address, parseEth(2))
      await expect(deficiency.connect(friend).burnFrom(owner.address, parseEth(2).add(1))).to.be.revertedWith('DeficiencyToken: Burn amount exceeds allowance')
    })

    it('reverts burn from unrelated account', async () => {
      await deficiency.mint(owner.address, parseEth(3))
      await deficiency.connect(owner).approve(friend.address, parseEth(2))
      await expect(deficiency.connect(stranger).burnFrom(owner.address, 1)).to.be.revertedWith('DeficiencyToken: Burn amount exceeds allowance')
    })
  })
})
