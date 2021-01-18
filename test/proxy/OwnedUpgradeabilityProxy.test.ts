import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { Wallet } from 'ethers'

import { beforeEachWithFixture, ZERO_ADDRESS } from 'utils'

import {
  OwnedUpgradeabilityProxyFactory,
  OwnedUpgradeabilityProxy,
  MockTrueCurrency,
  MockTrueCurrencyFactory,
} from 'contracts'

use(solidity)

describe('OwnedUpgradeabilityProxy', () => {
  let owner: Wallet
  let anotherWallet: Wallet
  let thirdWallet: Wallet

  let proxy: OwnedUpgradeabilityProxy
  let tusd: MockTrueCurrency

  beforeEachWithFixture(async (wallets) => {
    [owner, anotherWallet, thirdWallet] = wallets
    proxy = await new OwnedUpgradeabilityProxyFactory(owner).deploy()
    tusd = await new MockTrueCurrencyFactory(owner).deploy()
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

  describe('Upgrading', () => {
    it('sets up implementation contract ', async () => {
      await proxy.upgradeTo(tusd.address)
      expect(await proxy.implementation()).to.equal(tusd.address)
    })

    it('non owner cannot upgrade implementation contract', async () => {
      await expect(proxy.connect(anotherWallet).upgradeTo(tusd.address))
        .to.be.reverted
    })

    it('new implementation contract cannot be the same as the old', async () => {
      await proxy.upgradeTo(tusd.address)
      await expect(proxy.upgradeTo(tusd.address))
        .to.be.reverted
    })

    it('emits proper event', async () => {
      await expect(proxy.upgradeTo(tusd.address))
        .to.emit(proxy, 'Upgraded')
        .withArgs(tusd.address)
    })
  })
})
