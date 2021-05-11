import { expect, use } from 'chai'
import {
  ImplementationReference,
  ImplementationReference__factory,
  MockErc20Token,
  MockErc20Token__factory,
  OwnedProxyWithReference,
  OwnedProxyWithReference__factory,
  TestTrueLender,
  TestTrueLender__factory,
  PoolFactory,
  PoolFactory__factory,
  TrueFiPool2,
  TrueFiPool2__factory,
} from 'contracts'
import { solidity } from 'ethereum-waffle'
import { Wallet } from 'ethers'
import { beforeEachWithFixture } from 'utils/beforeEachWithFixture'
import { AddressZero } from '@ethersproject/constants'

use(solidity)

describe('PoolFactory', () => {
  let owner: Wallet
  let otherWallet: Wallet
  let poolImplementation: TrueFiPool2
  let implementationReference: ImplementationReference
  let factory: PoolFactory
  let token1: MockErc20Token
  let token2: MockErc20Token
  let stakingToken: MockErc20Token
  let trueLenderInstance1: TestTrueLender
  let trueLenderInstance2: TestTrueLender

  beforeEachWithFixture(async (wallets) => {
    [owner, otherWallet] = wallets
    poolImplementation = await new TrueFiPool2__factory(owner).deploy()
    implementationReference = await new ImplementationReference__factory(owner).deploy(poolImplementation.address)

    factory = await new PoolFactory__factory(owner).deploy()
    token1 = await new MockErc20Token__factory(owner).deploy()
    token2 = await new MockErc20Token__factory(owner).deploy()
    stakingToken = await new MockErc20Token__factory(owner).deploy()
    trueLenderInstance1 = await new TestTrueLender__factory(owner).deploy()
    trueLenderInstance2 = await new TestTrueLender__factory(owner).deploy()

    await factory.initialize(
      implementationReference.address,
      stakingToken.address,
      trueLenderInstance1.address,
    )
  })

  describe('Initializer', () => {
    it('sets factory owner', async () => {
      expect(await factory.owner()).to.eq(owner.address)
    })

    it('sets pool implementation address', async () => {
      expect(await factory.poolImplementationReference()).to.eq(implementationReference.address)
      expect(await implementationReference.attach(await factory.poolImplementationReference()).implementation()).to.eq(poolImplementation.address)
    })

    it('sets staking token address', async () => {
      expect(await factory.liquidationToken()).to.eq(stakingToken.address)
    })

    it('sets allowAll to false', async () => {
      expect(await factory.allowAll()).to.eq(false)
    })
  })

  describe('Creating new pool', () => {
    let creationEventArgs: any
    let proxy: OwnedProxyWithReference
    let pool: TrueFiPool2

    beforeEach(async () => {
      await factory.whitelist(token1.address, true)
      const tx = await factory.createPool(token1.address)
      creationEventArgs = (await tx.wait()).events[2].args
      proxy = OwnedProxyWithReference__factory.connect(await factory.pool(token1.address), owner)

      pool = poolImplementation.attach(proxy.address)
    })

    it('transfers proxy ownership', async () => {
      expect(await proxy.proxyOwner()).to.eq(owner.address)
    })

    it('initializes implementation with ownership', async () => {
      await factory.whitelist(token2.address, true)
      await factory.connect(otherWallet).createPool(token2.address)
      proxy = OwnedProxyWithReference__factory.connect(await factory.pool(token2.address), owner)
      expect(await pool.owner()).to.eq(owner.address)
    })

    it('adds pool to token -> pool mapping', async () => {
      expect(await factory.pool(token1.address)).to.eq(proxy.address)
    })

    it('adds pool to isPool mapping', async () => {
      expect(await factory.isPool(proxy.address)).to.eq(true)
    })

    it('proxy gets correct implementation', async () => {
      expect(await proxy.implementation()).to.eq(poolImplementation.address)
    })

    it('true lender is set correctly', async () => {
      expect(await pool.lender()).to.eq(trueLenderInstance1.address)
    })

    it('cannot create pool for token that already has a pool', async () => {
      await expect(factory.createPool(token1.address))
        .to.be.revertedWith('PoolFactory: This token already has a corresponding pool')
    })

    it('emits event', async () => {
      const proxyAddress = await factory.pool(token1.address)
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
      proxy1 = OwnedProxyWithReference__factory.connect(await factory.pool(token1.address), owner)
      proxy2 = OwnedProxyWithReference__factory.connect(await factory.pool(token2.address), owner)
    })

    it('adds 2 pools for 2 tokens', async () => {
      expect(await proxy1.proxyOwner()).to.eq(owner.address)
      expect(await proxy2.proxyOwner()).to.eq(owner.address)

      expect(await factory.isPool(proxy1.address)).to.eq(true)
      expect(await factory.isPool(proxy2.address)).to.eq(true)

      expect(await factory.pool(token1.address)).to.eq(proxy1.address)
      expect(await factory.pool(token2.address)).to.eq(proxy2.address)

      expect(await proxy1.implementation()).to.eq(poolImplementation.address)
      expect(await proxy2.implementation()).to.eq(poolImplementation.address)
    })

    it('changing reference, changes implementation for both', async () => {
      const newPoolImplementation = await new TrueFiPool2__factory(owner).deploy()
      await implementationReference.setImplementation(newPoolImplementation.address)

      expect(await proxy1.implementation()).to.eq(newPoolImplementation.address)
      expect(await proxy2.implementation()).to.eq(newPoolImplementation.address)
    })

    it('one reference changed, second remains, then change initial implementation', async () => {
      const newPoolImplementation1 = await new TrueFiPool2__factory(owner).deploy()
      const newReference = await new ImplementationReference__factory(owner).deploy(newPoolImplementation1.address)
      const newPoolImplementation2 = await new TrueFiPool2__factory(owner).deploy()

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

    it('can create only whitelisted', async () => {
      await expect(factory.createPool(token2.address))
        .to.be.revertedWith('PoolFactory: This token is not allowed to have a pool')
      await factory.whitelist(token2.address, true)
      await expect(factory.createPool(token2.address))
        .to.not.be.reverted
    })

    it('can create if allowAll is true', async () => {
      await expect(factory.createPool(token2.address))
        .to.be.revertedWith('PoolFactory: This token is not allowed to have a pool')
      await factory.setAllowAll(true)
      expect(await factory.isAllowed(token2.address))
        .to.eq(false)
      await expect(factory.createPool(token2.address))
        .not.to.be.reverted
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

  describe('setAllowAll', () => {
    it('only owner can set allowAll', async () => {
      await (expect(factory.connect(otherWallet).setAllowAll(true)))
        .to.be.revertedWith('Ownable: caller is not the owner')
      await (expect(factory.connect(owner).setAllowAll(true)))
        .not.to.be.reverted
    })

    it('toggles correctly', async () => {
      expect(await factory.allowAll())
        .to.eq(false)
      await factory.setAllowAll(true)
      expect(await factory.allowAll())
        .to.eq(true)
      await factory.setAllowAll(false)
      expect(await factory.allowAll())
        .to.eq(false)
    })

    it('emits events', async () => {
      await expect(factory.setAllowAll(true))
        .to.emit(factory, 'AllowAllStatusChanged')
        .withArgs(true)
      await expect(factory.setAllowAll(false))
        .to.emit(factory, 'AllowAllStatusChanged')
        .withArgs(false)
    })
  })

  describe('setTrueLender', () => {
    it('only owner can set trueLender', async () => {
      await expect(factory.connect(otherWallet).setTrueLender(trueLenderInstance2.address))
        .to.be.revertedWith('Ownable: caller is not the owner')
      await expect(factory.connect(owner).setTrueLender(trueLenderInstance2.address))
        .not.to.be.reverted
    })

    it('reverts when set to 0', async () => {
      await expect(factory.setTrueLender(AddressZero))
        .to.be.revertedWith('PoolFactory: TrueLender address cannot be set to 0')
    })

    it('sets new true lender contract', async () => {
      expect(await factory.trueLender2()).to.eq(trueLenderInstance1.address)
      await factory.connect(owner).setTrueLender(trueLenderInstance2.address)
      expect(await factory.trueLender2()).to.eq(trueLenderInstance2.address)
    })
  })
})
