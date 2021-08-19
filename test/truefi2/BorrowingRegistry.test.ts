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
      await expect(registry.connect(manager).allowChangingBorrowingStatus(manager.address))
        .to.be.revertedWith('Ownable: caller is not the owner')

      await expect(registry.connect(owner).allowChangingBorrowingStatus(manager.address))
        .not.to.be.reverted
    })

    it('changes allowance status', async () => {
      expect(await registry.canChangeBorrowingStatus(manager.address)).to.eq(false)
      await registry.allowChangingBorrowingStatus(manager.address)
      expect(await registry.canChangeBorrowingStatus(manager.address)).to.eq(true)
    })
  })
})
