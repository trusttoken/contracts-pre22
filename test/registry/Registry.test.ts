import { expect, use } from 'chai'
import { MockProvider, solidity } from 'ethereum-waffle'
import { Wallet } from 'ethers'
import { keccak256 } from '@ethersproject/keccak256'
import { formatBytes32String } from '@ethersproject/strings'
import { parseEther } from '@ethersproject/units'

import {
  beforeEachWithFixture,
  writeAttributeFor,
  ZERO_ADDRESS,
} from 'utils'

import {
  RegistryMock,
  RegistryMockFactory,
  ForceEther,
  ForceEtherFactory,
  MockErc20Token,
  MockErc20TokenFactory,
  MockRegistrySubscriber,
  MockRegistrySubscriberFactory,
} from 'contracts'

use(solidity)

describe('Registry', () => {
  let provider: MockProvider
  let owner: Wallet
  let anotherWallet: Wallet
  let thirdWallet: Wallet

  let registry: RegistryMock

  const prop1 = keccak256(formatBytes32String('hasPassedKYC/AML'))
  const prop2 = formatBytes32String('isDepositAddress')
  const notes = formatBytes32String('isBlacklisted')

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner, anotherWallet, thirdWallet] = wallets
    provider = _provider
    registry = await new RegistryMockFactory(owner).deploy()
    await registry.initialize()
  })

  describe('ownership functions', () => {
    it('cannot be reinitialized', async () => {
      await expect(registry.initialize())
        .to.be.reverted
    })

    it('can transfer ownership', async () => {
      await registry.transferOwnership(anotherWallet.address)
      expect(await registry.pendingOwner()).to.equal(anotherWallet.address)
    })

    it('non owner cannot transfer ownership', async () => {
      await expect(registry.connect(anotherWallet).transferOwnership(anotherWallet.address))
        .to.be.reverted
    })

    it('can claim ownership', async () => {
      await registry.transferOwnership(anotherWallet.address)
      await registry.connect(anotherWallet).claimOwnership()
      expect(await registry.owner()).to.equal(anotherWallet.address)
    })

    it('only pending owner can claim ownership', async () => {
      await registry.transferOwnership(anotherWallet.address)
      await expect(registry.connect(thirdWallet).claimOwnership())
        .to.be.reverted
    })
  })

  describe('read/write', () => {
    it('works for owner', async () => {
      const receipt = await (await registry.setAttribute(anotherWallet.address, prop1, 3, notes)).wait()
      const attr = await registry.getAttribute(anotherWallet.address, prop1)
      expect(attr[0]).to.equal(3)
      expect(attr[1]).to.equal(notes)
      expect(attr[2]).to.equal(owner.address)
      expect(attr[3]).to.equal((await provider.getBlock(receipt.blockNumber)).timestamp)

      expect(await registry.hasAttribute(anotherWallet.address, prop1)).to.be.true
      expect(await registry.getAttributeValue(anotherWallet.address, prop1)).to.equal(3)
      expect(await registry.getAttributeAdminAddr(anotherWallet.address, prop1)).to.equal(owner.address)

      const timestamp = await registry.getAttributeTimestamp(anotherWallet.address, prop1)
      expect((await provider.getBlock(receipt.blockNumber)).timestamp).to.equal(timestamp)
    })

    it('sets only desired attribute', async () => {
      await registry.setAttribute(anotherWallet.address, prop1, 3, notes)
      const attribute = await registry.getAttribute(anotherWallet.address, prop2)
      expect(attribute[0]).to.equal(ZERO_ADDRESS)
      expect(attribute[1]).to.equal('0x0000000000000000000000000000000000000000000000000000000000000000')
      expect(attribute[2]).to.equal(ZERO_ADDRESS)

      const hasAttribute = await registry.hasAttribute(anotherWallet.address, prop2)
      expect(hasAttribute).to.equal(false)
    })

    it('emits an event', async () => {
      await expect(registry.setAttribute(anotherWallet.address, prop1, 3, notes))
        .to.emit(registry, 'SetAttribute')
        .withArgs(anotherWallet.address, prop1, 3, notes, owner.address)
    })

    it('cannot be called by random non-owner', async () => {
      await expect(registry.connect(thirdWallet).setAttribute(anotherWallet.address, prop1, 3, notes))
        .to.be.reverted
    })

    it('owner can let others write', async () => {
      const canWriteProp1 = writeAttributeFor(prop1)
      await registry.setAttribute(thirdWallet.address, canWriteProp1, 3, notes)
      await registry.connect(thirdWallet).setAttribute(anotherWallet.address, prop1, 3, notes)
    })

    it('owner can let others write attribute value', async () => {
      const canWriteProp1 = writeAttributeFor(prop1)
      await registry.setAttributeValue(thirdWallet.address, canWriteProp1, 3)
      await registry.connect(thirdWallet).setAttributeValue(anotherWallet.address, prop1, 3)
    })

    it('others can only write what they are allowed to', async () => {
      const canWriteProp1 = writeAttributeFor(prop1)
      await registry.setAttribute(thirdWallet.address, canWriteProp1, 3, notes)
      await expect(registry.connect(thirdWallet).setAttribute(anotherWallet.address, prop2, 3, notes))
        .to.be.reverted
      await expect(registry.connect(thirdWallet).setAttributeValue(anotherWallet.address, prop2, 3))
        .to.be.reverted
    })
  })

  describe('no ether and no tokens', () => {
    let token: MockErc20Token
    let forceEther: ForceEther

    const emptyAddress = '0x5fef93e79a73b28a9113a618aabf84f2956eb3ba'

    beforeEach(async () => {
      token = await new MockErc20TokenFactory(owner).deploy()
    })

    it('owner can transfer out token in the contract address ', async () => {
      await registry.reclaimToken(token.address, owner.address)
    })

    it('cannot transfer ether to contract address', async () => {
      await expect(owner.sendTransaction({
        to: registry.address,
        value: 10,
      })).to.be.reverted
    })

    it('owner can transfer out ether in the contract address', async () => {
      forceEther = await new ForceEtherFactory(owner).deploy({ value: parseEther('10') })
      await forceEther.destroyAndSend(registry.address)
      const registryInitialWithForcedEther = await provider.getBalance(registry.address)
      await registry.reclaimEther(emptyAddress)
      const registryFinalBalance = await provider.getBalance(registry.address)
      const emptyAddressFinalBalance = await provider.getBalance(emptyAddress)

      expect(registryInitialWithForcedEther).to.equal(parseEther('10'))
      expect(registryFinalBalance).to.equal(0)
      expect(emptyAddressFinalBalance).to.equal(parseEther('10'))
    })
  })

  describe('sync', () => {
    let registryToken: MockRegistrySubscriber

    beforeEach(async () => {
      registryToken = await new MockRegistrySubscriberFactory(owner).deploy()
      await registry.subscribe(prop1, registryToken.address)
      await registry.setAttributeValue(thirdWallet.address, prop1, 3)
    })

    it('writes sync', async () => {
      expect(await registryToken.getAttributeValue(thirdWallet.address, prop1)).to.equal(3)
    })

    it('subscription emits event', async () => {
      await expect(registry.subscribe(prop2, registryToken.address))
        .to.emit(registry, 'StartSubscription')
        .withArgs(prop2, registryToken.address)
      expect(await registry.subscriberCount(prop2)).to.equal(1)
    })

    it('unsubscription emits event', async () => {
      await expect(registry.unsubscribe(prop1, 0))
        .to.emit(registry, 'StopSubscription')
        .withArgs(prop1, registryToken.address)
    })

    it('can unsubscribe', async () => {
      expect(await registry.subscriberCount(prop1)).to.equal(1)
      await registry.unsubscribe(prop1, 0)
      expect(await registry.subscriberCount(prop1)).to.equal(0)
    })

    it('syncs prior writes', async () => {
      const token2 = await new MockRegistrySubscriberFactory(owner).deploy()
      await registry.subscribe(prop1, token2.address)
      expect(await registryToken.getAttributeValue(thirdWallet.address, prop1)).to.equal(3)
      expect(await token2.getAttributeValue(thirdWallet.address, prop1)).to.equal(0)

      await registry.syncAttribute(prop1, 0, [thirdWallet.address])
      expect(await token2.getAttributeValue(thirdWallet.address, prop1)).to.equal(3)
    })

    it('syncs prior attribute', async () => {
      const token2 = await new MockRegistrySubscriberFactory(owner).deploy()
      await registry.subscribe(prop1, token2.address)
      expect(await registryToken.getAttributeValue(thirdWallet.address, prop1)).to.equal(3)
      expect(await token2.getAttributeValue(thirdWallet.address, prop1)).to.equal(0)

      await registry.syncAttribute(prop1, 0, [thirdWallet.address])
      expect(await token2.getAttributeValue(thirdWallet.address, prop1)).to.equal(3)
    })

    it('syncs multiple prior writes', async () => {
      await registry.setAttributeValue(thirdWallet.address, prop1, 3, { gasLimit: 2_000_000 })
      await registry.setAttributeValue(anotherWallet.address, prop1, 5, { gasLimit: 2_000_000 })
      await registry.setAttributeValue(owner.address, prop1, 6, { gasLimit: 2_000_000 })

      const token2 = await new MockRegistrySubscriberFactory(owner).deploy()
      await registry.subscribe(prop1, token2.address, { gasLimit: 2_000_000 })
      await registry.syncAttribute(prop1, 2, [thirdWallet.address, anotherWallet.address, owner.address], { gasLimit: 2_000_000 })
      expect(await registryToken.getAttributeValue(thirdWallet.address, prop1)).to.equal(3)
      expect(await token2.getAttributeValue(thirdWallet.address, prop1)).to.equal(0)

      await registry.syncAttribute(prop1, 1, [thirdWallet.address, anotherWallet.address, owner.address], { gasLimit: 2_000_000 })
      expect(await token2.getAttributeValue(thirdWallet.address, prop1)).to.equal(3)
      expect(await token2.getAttributeValue(anotherWallet.address, prop1)).to.equal(5)
      expect(await token2.getAttributeValue(owner.address, prop1)).to.equal(6)
    })
  })
})
