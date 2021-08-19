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
  let registry: BorrowingRegistry

  beforeEachWithFixture(async (wallets) => {
    [owner] = wallets
    const deployContract = setupDeploy(owner)
    registry = await deployContract(BorrowingRegistry__factory)
    await registry.initialize()
  })

  describe('initializer', () => {
    it('sets owner', async () => {
      expect(await registry.owner()).to.eq(owner.address)
    })
  })
})
