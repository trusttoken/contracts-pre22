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
  let manager: Wallet
  let registry: BorrowingRegistry

  beforeEachWithFixture(async (wallets) => {
    [owner, manager] = wallets
    const deployContract = setupDeploy(owner)
    registry = await deployContract(BorrowingRegistry__factory)
    await registry.initialize()
  })

  describe('initializer', () => {
    it('sets owner', async () => {
      expect(await registry.owner()).to.eq(owner.address)
    })
  })

  describe('allowChangingBorrowingStatus', () => {
    it('only owner can call', async () => {
      await expect(registry.connect(manager).allowChangingBorrowingStatus(manager.address, true))
        .to.be.revertedWith('Ownable: caller is not the owner')

      await expect(registry.connect(owner).allowChangingBorrowingStatus(manager.address, true))
        .not.to.be.reverted
    })

    it('changes allowance status', async () => {
      expect(await registry.canChangeBorrowingStatus(manager.address)).to.eq(false)
      await registry.allowChangingBorrowingStatus(manager.address, true)
      expect(await registry.canChangeBorrowingStatus(manager.address)).to.eq(true)
    })

    it('emits event', async () => {
      await expect(registry.connect(owner).allowChangingBorrowingStatus(manager.address, true))
        .to.emit(registry, 'AllowedToChangeBorrowingStatus')
        .withArgs(manager.address, true)

      await expect(registry.connect(owner).allowChangingBorrowingStatus(manager.address, false))
        .to.emit(registry, 'AllowedToChangeBorrowingStatus')
        .withArgs(manager.address, false)
    })
  })

  describe('setBorrowingStatus', () => {
    beforeEach(async () => {
      await registry.allowChangingBorrowingStatus(manager.address, true)
    })

    it('only allowed addresses can change status', async () => {
      await expect(registry.connect(owner).setBorrowingStatus(manager.address, true))
        .to.be.revertedWith('BorrowingRegistry: Caller is not allowed to change borrowing status')

      await expect(registry.connect(manager).setBorrowingStatus(manager.address, true))
        .not.to.be.reverted
    })

    it('changes borrowing status', async () => {
      expect(await registry.borrowingStatus(manager.address)).to.eq(false)
      await registry.connect(manager).setBorrowingStatus(manager.address, true)
      expect(await registry.borrowingStatus(manager.address)).to.eq(true)
      await registry.connect(manager).setBorrowingStatus(manager.address, false)
      expect(await registry.borrowingStatus(manager.address)).to.eq(false)
    })

    it('emits event', async () => {
      await expect(registry.connect(manager).setBorrowingStatus(manager.address, true))
        .to.emit(registry, 'BorrowingStatusChanged')
        .withArgs(manager.address, true)

      await expect(registry.connect(manager).setBorrowingStatus(manager.address, false))
        .to.emit(registry, 'BorrowingStatusChanged')
        .withArgs(manager.address, false)
    })
  })
})
