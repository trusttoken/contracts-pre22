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
  let governor: Wallet
  let poolImplementation: TrueFiPool2
  let implementationReference: ImplementationReference
  let factory: PoolFactory
  let token1: MockErc20Token

  beforeEachWithFixture(async (wallets) => {
    [owner, governor] = wallets
    poolImplementation = await new TrueFiPool2Factory(owner).deploy()
    implementationReference = await new ImplementationReferenceFactory(owner).deploy(poolImplementation.address)

    factory = await new PoolFactoryFactory(owner).deploy()
    token1 = await new MockErc20TokenFactory(owner).deploy()

    await factory.initialize(implementationReference.address, governor.address)
  })

  describe('Initializer', () => {
    it('sets pool implementation address', async () => {
      expect(await factory.poolImplementationReference()).to.eq(implementationReference.address)
      expect(await implementationReference.attach(await factory.poolImplementationReference()).implementation()).to.eq(poolImplementation.address)
    })

    it('sets governance as new pools owner', async () => {
      expect(await factory.governance()).to.eq(governor.address)
    })
  })

  describe('Creating new pool', () => {
    let creationEventArgs: {}
    let proxy1: OwnedProxyWithReference

    beforeEach(async () => {
      const tx = await factory.createPool(token1.address)
      creationEventArgs = (await tx.wait()).events[4].args
      proxy1 = OwnedProxyWithReferenceFactory.connect(await factory.correspondingPool(token1.address), owner)
      await proxy1.connect(governor).claimProxyOwnership()
    })

    it('governance is pools owner', async () => {
      expect(await proxy1.proxyOwner()).to.eq(governor.address)
    })

    it('adds pool to token -> pool mapping', async () => {
      expect(await factory.correspondingPool(token1.address)).to.eq(proxy1.address)
    })

    it('emits event', async () => {
      const proxyAddress = await factory.correspondingPool(token1.address)
      expect(creationEventArgs['token']).to.eq(token1.address)
      expect(creationEventArgs['pool']).to.eq(proxyAddress)
    })
  })
})
