import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { Wallet } from 'ethers'

import { beforeEachWithFixture, ZERO_ADDRESS } from 'utils'

import {
  OwnedProxyWithReferenceFactory,
  OwnedProxyWithReference,
  MockTrueCurrency,
  MockTrueCurrencyFactory,
  ImplementationReference,
  ImplementationReferenceFactory,
} from 'contracts'

use(solidity)

describe('OwnedProxyWithReference', () => {
  let owner: Wallet
  let anotherWallet: Wallet
  let thirdWallet: Wallet

  let proxy: OwnedProxyWithReference
  
  let implementationReference: ImplementationReference
  let tusd: MockTrueCurrency

  beforeEachWithFixture(async (wallets) => {
    [owner, anotherWallet, thirdWallet] = wallets
    proxy = await new OwnedProxyWithReferenceFactory(owner).deploy()
    tusd = await new MockTrueCurrencyFactory(owner).deploy()
    implementationReference = await new ImplementationReferenceFactory(owner).deploy(tusd.address)
  })

  describe('Ownership', () => {
    it('owner is the owner of the proxy', async () => {
      expect(await proxy.proxyOwner()).to.equal(owner.address)
    })

    it('owner can transfer proxy ownership ', async () => {
      expect(await proxy.pendingProxyOwner()).to.equal(ZERO_ADDRESS)
      await proxy.transferProxyOwnership(anotherWallet.address)

      expect(await proxy.pendingProxyOwner()).to.equal(anotherWallet.address)
    })

    it('pending owner can claim ownership ', async () => {
      await proxy.transferProxyOwnership(anotherWallet.address)
      await proxy.connect(anotherWallet).claimProxyOwnership()

      expect(await proxy.proxyOwner()).to.equal(anotherWallet.address)
    })

    it('non owner cannot transfer ownership ', async () => {
      await expect(proxy.connect(anotherWallet).transferProxyOwnership(anotherWallet.address))
        .to.be.reverted
    })

    it('non pending owner cannot claim ownership ', async () => {
      await proxy.transferProxyOwnership(anotherWallet.address)
      await expect(proxy.connect(thirdWallet).claimProxyOwnership())
        .to.be.reverted
    })

    it('zero address cannot be pending owner ', async () => {
      await expect(proxy.transferProxyOwnership(ZERO_ADDRESS))
        .to.be.reverted
    })

    it('emits proper events', async () => {
      await expect(proxy.transferProxyOwnership(anotherWallet.address))
        .to.emit(proxy, 'NewPendingOwner')
        .withArgs(owner.address, anotherWallet.address)
      await expect(proxy.connect(anotherWallet).claimProxyOwnership())
        .to.emit(proxy, 'ProxyOwnershipTransferred')
        .withArgs(owner.address, anotherWallet.address)
    })
  })

  describe('Referencing', () => { 
    it('sets up implementation reference ', async () => {
      await proxy.changeImplementationReference(implementationReference.address)
      expect(await proxy.implementation()).to.equal(tusd.address)
    })

    it('non owner cannot upgrade implementation contract', async () => {
      await expect(proxy.connect(anotherWallet).changeImplementationReference(implementationReference.address))
        .to.be.reverted
    })

    it('emits proper event', async () => {
      await expect(proxy.changeImplementationReference(implementationReference.address))
        .to.emit(proxy, 'ImplementationReferenceChanged')
        .withArgs(implementationReference.address)
    })
  })

  it('calls implementation function', async () => {
    await proxy.changeImplementationReference(implementationReference.address)
    expect(await tusd.attach(proxy.address).balanceOf(owner.address)).to.eq(0)
  })
})
