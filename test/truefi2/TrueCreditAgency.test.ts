import { Wallet } from 'ethers'
import { MockTrueCurrency, TrueCreditAgency, TrueCreditAgency__factory, TrueFiPool2 } from 'contracts'
import { beforeEachWithFixture, parseEth, setupTruefi2 } from 'utils'
import { expect } from 'chai'
import { AddressZero } from '@ethersproject/constants'

describe('TrueCreditAgency', () => {
  let owner: Wallet
  let borrower: Wallet
  let creditAgency: TrueCreditAgency
  let tusd: MockTrueCurrency
  let tusdPool: TrueFiPool2

  beforeEachWithFixture(async (wallets) => {
    [owner, borrower] = wallets

    ;({
      standardToken: tusd,
      standardPool: tusdPool,
    } = await setupTruefi2(owner))

    await tusd.mint(owner.address, parseEth(1e7))
    await tusd.approve(tusdPool.address, parseEth(1e7))
    await tusdPool.join(parseEth(1e7))

    creditAgency = await new TrueCreditAgency__factory(owner).deploy()
    await creditAgency.initialize()

    await tusdPool.setCreditAgency(creditAgency.address)
    await creditAgency.allowPool(tusdPool.address, true)
  })

  describe('Ownership', () => {
    it('owner is set to msg.sender of initialize()', async () => {
      expect(await creditAgency.owner()).to.equal(owner.address)
    })

    it('ownership transfer', async () => {
      await creditAgency.transferOwnership(borrower.address)
      expect(await creditAgency.owner()).to.equal(owner.address)
      expect(await creditAgency.pendingOwner()).to.equal(borrower.address)
      await creditAgency.connect(borrower).claimOwnership()
      expect(await creditAgency.owner()).to.equal(borrower.address)
      expect(await creditAgency.pendingOwner()).to.equal(AddressZero)
    })
  })

  describe('Setting pool allowance', () => {
    it('can only be called by the owner', async () => {
      await expect(creditAgency.connect(borrower).allowPool(tusdPool.address, true)).to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('changes pool allowance status', async () => {
      await creditAgency.allowPool(tusdPool.address, false)
      expect(await creditAgency.isPoolAllowed(tusdPool.address)).to.be.false
      await creditAgency.allowPool(tusdPool.address, true)
      expect(await creditAgency.isPoolAllowed(tusdPool.address)).to.be.true
    })

    it('emits event', async () => {
      await expect(creditAgency.allowPool(tusdPool.address, false)).to.emit(creditAgency, 'PoolAllowed')
        .withArgs(tusdPool.address, false)
    })
  })

  describe('Borrowing', () => {
    it('borrows funds from the pool', async () => {
      await creditAgency.connect(borrower).borrow(tusdPool.address, 1000)
      expect(await tusd.balanceOf(borrower.address)).to.equal(1000)
    })

    it('cannot borrow from the pool that is not whitelisted', async () => {
      await creditAgency.allowPool(tusdPool.address, false)
      await expect(creditAgency.connect(borrower).borrow(tusdPool.address, 1000))
        .to.be.revertedWith('TrueCreditAgency: The pool is not whitelisted for borrowing')
    })
  })

  describe('Repaying', () => {
    it('repays the funds to the pool', async () => {
      await creditAgency.connect(borrower).borrow(tusdPool.address, 1000)
      await tusd.connect(borrower).approve(creditAgency.address, 1000)
      await creditAgency.connect(borrower).repay(tusdPool.address, 1000)
      expect(await tusd.balanceOf(borrower.address)).to.equal(0)
      expect(await tusd.balanceOf(tusdPool.address)).to.equal(parseEth(1e7))
    })
  })
})
