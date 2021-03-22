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
  let otherWallet: Wallet
  let poolImplementation: TrueFiPool2
  let implementationReference: ImplementationReference
  let factory: PoolFactory
  let token1: MockErc20Token
  let token2: MockErc20Token

  beforeEachWithFixture(async (wallets) => {
    [owner, otherWallet] = wallets
    poolImplementation = await new TrueFiPool2Factory(owner).deploy()
    implementationReference = await new ImplementationReferenceFactory(owner).deploy(poolImplementation.address)

    factory = await new PoolFactoryFactory(owner).deploy()
    token1 = await new MockErc20TokenFactory(owner).deploy()
    token2 = await new MockErc20TokenFactory(owner).deploy()

    await factory.initialize(implementationReference.address)
  })

  describe('Initializer', () => {
    it('sets pool implementation address', async () => {
      expect(await factory.poolImplementationReference()).to.eq(implementationReference.address)
      expect(await implementationReference.attach(await factory.poolImplementationReference()).implementation()).to.eq(poolImplementation.address)
    })
  })

  describe('Creating new pool', () => {
    let creationEventArgs: any
    let proxy: OwnedProxyWithReference

    beforeEach(async () => {
      await factory.whitelist(token1.address, true)
      const tx = await factory.createPool(token1.address)
      creationEventArgs = (await tx.wait()).events[4].args
      proxy = OwnedProxyWithReferenceFactory.connect(await factory.correspondingPool(token1.address), owner)
      await proxy.claimProxyOwnership()
    })

    it('transfers proxy ownership', async () => {
      expect(await proxy.proxyOwner()).to.eq(owner.address)
    })

    it('adds pool to token -> pool mapping', async () => {
      expect(await factory.correspondingPool(token1.address)).to.eq(proxy.address)
    })

    it('adds pool to isPool mapping', async () => {
      expect(await factory.isPool(proxy.address)).to.eq(true)
    })

    it('proxy gets correct implementation', async () => {
      expect(await proxy.implementation()).to.eq(poolImplementation.address)
    })

    it('cannot create pool for token that already has a pool', async () => {
      await expect(factory.createPool(token1.address))
        .to.be.revertedWith('PoolFactory: This token already has a corresponding pool')
    })

    it('emits event', async () => {
      const proxyAddress = await factory.correspondingPool(token1.address)
      expect(creationEventArgs['token']).to.eq(token1.address)
      expect(creationEventArgs['pool']).to.eq(proxyAddress)
    })
  })

  describe('Creating multiple pools', () => {
    let proxy1: OwnedProxyWithReference
    let proxy2: OwnedProxyWithReference

    beforeEach(async () => {
      await factory.whitelist(token1.address, true)
      await factory.whitelist(token2.address, true)
      await factory.createPool(token1.address)
      await factory.createPool(token2.address)
      proxy1 = OwnedProxyWithReferenceFactory.connect(await factory.correspondingPool(token1.address), owner)
      proxy2 = OwnedProxyWithReferenceFactory.connect(await factory.correspondingPool(token2.address), owner)
      await proxy1.claimProxyOwnership()
      await proxy2.claimProxyOwnership()
    })

    it('adds 2 pools for 2 tokens', async () => {
      expect(await proxy1.proxyOwner()).to.eq(owner.address)
      expect(await proxy2.proxyOwner()).to.eq(owner.address)

      expect(await factory.isPool(proxy1.address)).to.eq(true)
      expect(await factory.isPool(proxy2.address)).to.eq(true)

      expect(await factory.correspondingPool(token1.address)).to.eq(proxy1.address)
      expect(await factory.correspondingPool(token2.address)).to.eq(proxy2.address)

      expect(await proxy1.implementation()).to.eq(poolImplementation.address)
      expect(await proxy2.implementation()).to.eq(poolImplementation.address)
    })

    it('changing reference, changes implementation for both', async () => {
      const newPoolImplementation = await new TrueFiPool2Factory(owner).deploy()
      await implementationReference.setImplementation(newPoolImplementation.address)

      expect(await proxy1.implementation()).to.eq(newPoolImplementation.address)
      expect(await proxy2.implementation()).to.eq(newPoolImplementation.address)
    })

    it('one reference changed, second remains, then change initial implementation', async () => {
      const newPoolImplementation1 = await new TrueFiPool2Factory(owner).deploy()
      const newReference = await new ImplementationReferenceFactory(owner).deploy(newPoolImplementation1.address)
      const newPoolImplementation2 = await new TrueFiPool2Factory(owner).deploy()

      await proxy1.changeImplementationReference(newReference.address)
      expect(await proxy1.implementation()).to.eq(newPoolImplementation1.address)
      expect(await proxy2.implementation()).to.eq(poolImplementation.address)

      await implementationReference.setImplementation(newPoolImplementation2.address)
      expect(await proxy1.implementation()).to.eq(newPoolImplementation1.address)
      expect(await proxy2.implementation()).to.eq(newPoolImplementation2.address)
    })
  })

  describe('Whitelist', () => {
    beforeEach(async () => {
      await factory.whitelist(token1.address, true)
      await factory.createPool(token1.address)
    })

    it('only owner can call', async () => {
      await expect(factory.connect(otherWallet).whitelist(token1.address, true))
        .to.be.revertedWith('Ownable: caller is not the owner')
      
      await expect(factory.whitelist(token1.address, true))
        .to.not.be.reverted
    })

    it('can create only allowed', async () => {
      await expect(factory.createPool(token2.address))
        .to.be.revertedWith('PoolFactory: This token is not allowed to have a pool')
      await factory.whitelist(token2.address, true)
      await expect(factory.createPool(token2.address))
        .to.not.be.reverted
    })

    it('emits event', async () => {
      await expect(factory.whitelist(token1.address, true))
        .to.emit(factory, 'AllowedStatusChanged')
        .withArgs(token1.address, true)

      await expect(factory.whitelist(token1.address, false))
        .to.emit(factory, 'AllowedStatusChanged')
        .withArgs(token1.address, false)
    })
  })
})
