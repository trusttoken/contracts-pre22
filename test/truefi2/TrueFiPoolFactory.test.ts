import { expect, use } from 'chai'
import { MockErc20Token, MockErc20TokenFactory } from 'contracts/types'
import { PoolFactory } from 'contracts/types/PoolFactory'
import { PoolFactoryFactory } from 'contracts/types/PoolFactoryFactory'
import { TrueFiPool2 } from 'contracts/types/TrueFiPool2'
import { TrueFiPool2Factory } from 'contracts/types/TrueFiPool2Factory'
import { solidity } from 'ethereum-waffle'
import { Wallet } from 'ethers'
import { beforeEachWithFixture } from 'utils/beforeEachWithFixture'

use(solidity)

describe('TrueFiPoolFactory', () => {
  let owner: Wallet
  let poolImplementation: TrueFiPool2
  let factory: PoolFactory
  let token1: MockErc20Token

  beforeEachWithFixture(async (wallets) => {
    [owner] = wallets
    poolImplementation = await new TrueFiPool2Factory(owner).deploy()
    factory = await new PoolFactoryFactory(owner).deploy()
    token1 = await new MockErc20TokenFactory(owner).deploy()

    await factory.initialize(poolImplementation.address)
  })

  describe('Initializer', () => {
    it('Pool implementation address set correctly', async () => {
      expect(await factory.poolImplementation()).to.eq(poolImplementation.address)
    })
  })

  describe('Creating new pool', () => {
    beforeEach(async () => {
      await factory.createPool(token1.address)
    })

    it('is added to storage array and index mapping', async () => {
      expect(await factory.correspondingPool(token1.address)).not.to.eq(0)
    })
  })
})
