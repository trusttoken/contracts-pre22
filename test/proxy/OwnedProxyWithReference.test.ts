import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { Wallet } from 'ethers'

import { beforeEachWithFixture, ZERO_ADDRESS } from 'utils'

import {
  OwnedProxyWithReference__factory,
  OwnedProxyWithReference,
  MockTrueCurrency,
  MockTrueCurrency__factory,
  ImplementationReference,
  ImplementationReference__factory,
  StringReturn__factory,
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
    tusd = await new MockTrueCurrency__factory(owner).deploy()
    implementationReference = await new ImplementationReference__factory(owner).deploy(tusd.address)
    proxy = await new OwnedProxyWithReference__factory(owner).deploy(owner.address, implementationReference.address)
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
    it('testName', async () => {
      expect(await proxy.implementation()).to.equal(tusd.address)
    })

    it('sets up implementation reference ', async () => {
      const tusd2 = await new MockTrueCurrency__factory(owner).deploy()
      const implementationReference2 = await new ImplementationReference__factory(owner).deploy(tusd2.address)
      await proxy.changeImplementationReference(implementationReference2.address)
      expect(await proxy.implementation()).to.equal(tusd2.address)
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
    await tusd.attach(proxy.address).approve(owner.address, 1)
    expect(await tusd.attach(proxy.address).allowance(owner.address, owner.address)).to.eq(1)
  })

  it('handles big calldata/returndata', async () => {
    const tester = await new StringReturn__factory(owner).deploy()
    await implementationReference.setImplementation(tester.address)
    // 512 byte hexadec
    const bigString = 'a'.repeat(256) + 'b'.repeat(256)
    expect(await tester.attach(proxy.address).reflect(bigString)).to.eq(bigString)
  })
})
