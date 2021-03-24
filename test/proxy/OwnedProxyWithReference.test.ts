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
  StringReturnFactory,
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
    tusd = await new MockTrueCurrencyFactory(owner).deploy()
    implementationReference = await new ImplementationReferenceFactory(owner).deploy(tusd.address)
    proxy = await new OwnedProxyWithReferenceFactory(owner).deploy(owner.address, implementationReference.address)
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
      const tusd2 = await new MockTrueCurrencyFactory(owner).deploy()
      const implementationReference2 = await new ImplementationReferenceFactory(owner).deploy(tusd2.address)
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
    const tester = await new StringReturnFactory(owner).deploy()
    await implementationReference.setImplementation(tester.address)
    // 512 byte hexadec
    const bigString = '8feb3c25debc66af907218820744b46753ce0dae37bc3e9af529957ef77a0065f976897f3ae4559a828d8ee9a45f69c6173664733376f8efbad7e91b2e274e777ec03871fe4f8439c3c5417102d0da45938820e10c727e8e9446e2cf519e8ea673c1b844cddfe35465c34018e30a164c6d8186a51a4000a5d92522920bcd40f0823eec3812706f0c6970fa0d0c3e0e146f034f7c05e68ab061f8842025ea419b772a738415c61fe6e08268c22586364066b9bfcad31e32c6fb335a55f5b27c1d1a758b437c70de955a74b80336c31d5a1f252f1d19be1789920529d99b6abe4e9143f7a89c9313cf16f66a6415f9a18f0fa93e093c99c14bf984cecc21a32f61'
    expect(await tester.attach(proxy.address).reflect(bigString)).to.eq(bigString)
  })
})
