import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { Wallet } from 'ethers'
import { setupDeploy } from 'scripts/utils'
import { beforeEachWithFixture } from 'utils'
import {
  BorrowingRegistry,
  BorrowingRegistry__factory,
} from 'contracts'

use(solidity)

describe('TrueRateAdjuster', () => {
  let owner: Wallet
  let locker: Wallet
  let borrower: Wallet
  let registry: BorrowingRegistry

  beforeEachWithFixture(async (wallets) => {
    [owner, locker, borrower] = wallets
    const deployContract = setupDeploy(owner)
    registry = await deployContract(BorrowingRegistry__factory)
    await registry.initialize()
  })

  describe('initializer', () => {
    it('sets owner', async () => {
      expect(await registry.owner()).to.eq(owner.address)
    })
  })

  describe('allowLocking', () => {
    it('only owner can call', async () => {
      await expect(registry.connect(locker).allowLocking(locker.address))
        .to.be.revertedWith('Ownable: caller is not the owner')

      await expect(registry.connect(owner).allowLocking(locker.address))
        .not.to.be.reverted
    })

    it('changes allowance status', async () => {
      expect(await registry.canLock(locker.address)).to.eq(false)
      await registry.allowLocking(locker.address)
      expect(await registry.canLock(locker.address)).to.eq(true)
    })
  })

  describe('lock', () => {
    it('reverts if borrower is already locked', async () => {
      await registry.connect(locker).lock(borrower.address)
      await expect(registry.connect(locker).lock(borrower.address))
        .to.be.revertedWith('BorrowingRegistry: Borrower is already locked')
    })

    it('changes hasLock', async () => {
      await registry.connect(locker).lock(borrower.address)
      expect(await registry.hasLock(borrower.address)).to.eq(locker.address)
    })
  })
})
