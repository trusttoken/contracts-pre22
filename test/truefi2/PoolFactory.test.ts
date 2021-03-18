import { expect, use } from 'chai'
import { ImplementationReference, ImplementationReferenceFactory, MockErc20Token, MockErc20TokenFactory, OwnedProxyWithReference, OwnedProxyWithReferenceFactory } from 'contracts/types'
import { PoolFactory } from 'contracts/types/PoolFactory'
import { PoolFactoryFactory } from 'contracts/types/PoolFactoryFactory'
import { TrueFiPool2 } from 'contracts/types/TrueFiPool2'
import { TrueFiPool2Factory } from 'contracts/types/TrueFiPool2Factory'
import { solidity } from 'ethereum-waffle'
import { Wallet } from 'ethers'
import { beforeEachWithFixture } from 'utils/beforeEachWithFixture'

use(solidity)

describe('PoolFactory', () => {
  let owner: Wallet
  let poolImplementation: TrueFiPool2
  let implementationReference: ImplementationReference
  let factory: PoolFactory
  let token: MockErc20Token

  beforeEachWithFixture(async (wallets) => {
    [owner] = wallets
    poolImplementation = await new TrueFiPool2Factory(owner).deploy()
    implementationReference = await new ImplementationReferenceFactory(owner).deploy(poolImplementation.address)

    factory = await new PoolFactoryFactory(owner).deploy()
    token = await new MockErc20TokenFactory(owner).deploy()

    await factory.initialize(implementationReference.address)
  })

  describe('Initializer', () => {
    it('sets pool implementation address', async () => {
      expect(await factory.poolImplementationReference()).to.eq(implementationReference.address)
      expect(await implementationReference.attach(await factory.poolImplementationReference()).implementation()).to.eq(poolImplementation.address)
    })
  })

  describe('Creating new pool', () => {
    let creationEventArgs: {}
    let proxy: OwnedProxyWithReference

    beforeEach(async () => {
      const tx = await factory.createPool(token.address)
      creationEventArgs = (await tx.wait()).events[4].args
      proxy = OwnedProxyWithReferenceFactory.connect(await factory.correspondingPool(token.address), owner)
      await proxy.claimProxyOwnership()
    })

    it('transfers proxy ownership', async () => {
      expect(await proxy.proxyOwner()).to.eq(owner.address)
    })

    it('adds pool to token -> pool mapping', async () => {
      expect(await factory.correspondingPool(token.address)).to.eq(proxy.address)
    })

    it('adds pool to isPool mapping', async () => {
      expect(await factory.isPool(proxy.address)).to.eq(true)
    })

    it('cannot create pool for token that already has a pool', async () => {
      await expect(factory.createPool(token.address))
        .to.be.revertedWith('PoolFactory: This token already has a corresponding pool')
    })

    it('emits event', async () => {
      const proxyAddress = await factory.correspondingPool(token.address)
      expect(creationEventArgs['token']).to.eq(token.address)
      expect(creationEventArgs['pool']).to.eq(proxyAddress)
    })
  })

  describe('Creating multiple pools', () => {
    
  })
})
