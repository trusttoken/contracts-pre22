import { expect, use } from 'chai'
import { MockProvider, solidity } from 'ethereum-waffle'
import { Wallet } from 'ethers'
import { AddressZero } from '@ethersproject/constants'

import { beforeEachWithFixture, DAY, timeTravel, ZERO_ADDRESS } from 'utils'

import {
  MockTrueCurrency,
  MockTrueCurrency__factory,
} from 'contracts'
import { TimeLockedOwnedUpgradeabilityProxy } from 'build/types/TimeLockedOwnedUpgradeabilityProxy'
import { TimeLockedOwnedUpgradeabilityProxy__factory } from 'build/types/factories/TimeLockedOwnedUpgradeabilityProxy__factory'

use(solidity)

describe('TimeLockedOwnedUpgradeabilityProxy', () => {
  let owner: Wallet
  let anotherWallet: Wallet
  let thirdWallet: Wallet
  let provider: MockProvider

  let proxy: TimeLockedOwnedUpgradeabilityProxy
  let tusd: MockTrueCurrency

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner, anotherWallet, thirdWallet] = wallets
    provider = _provider
    await provider.send('hardhat_reset', [])
    proxy = await new TimeLockedOwnedUpgradeabilityProxy__factory(owner).deploy()
    tusd = await new MockTrueCurrency__factory(owner).deploy()
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

  describe('Setting delay', () => {
    it('initially set to 10', async () => {
      expect(await proxy.delay()).to.eq(10 * DAY)
    })

    it('only proxy owner can initialize setter', async () => {
      await expect(proxy.connect(anotherWallet).initializeSetDelay(3 * DAY))
        .to.be.revertedWith('only Proxy Owner')

      await expect(proxy.initializeSetDelay(3 * DAY))
        .not.to.be.reverted
    })

    describe('setting delay process', () => {
      beforeEach(async () => {
        await proxy.initializeSetDelay(3 * DAY)
        timeTravel(provider, 10 * DAY)
      })

      it('sets pendingDelay', async () => {
        expect(await proxy.pendingDelay()).to.eq(3 * DAY)
      })

      it('anyone execute setter', async () => {
        await expect(proxy.connect(anotherWallet).executeSetDelay())
          .not.to.be.reverted
      })

      it('sets new delay', async () => {
        await proxy.executeSetDelay()
        expect(await proxy.delay()).to.eq(3 * DAY)
      })

      it('can execute multiple times', async () => {
        await proxy.executeSetDelay()
        expect(await proxy.delay()).to.eq(3 * DAY)
        await expect(proxy.executeSetDelay())
          .to.be.reverted
      })

      it('emits event', async () => {
        await expect(proxy.connect(anotherWallet).executeSetDelay())
          .to.emit(proxy, 'DelayChanged')
          .withArgs(DAY * 3)
      })
    })

    it('initializing setter initializes cooldown', async () => {
      await proxy.initializeSetDelay(3 * DAY)
      timeTravel(provider, 9 * DAY)
      expect(await proxy.delayUnlockTimestamp())
        .to.be.gt((await provider.getBlock('latest')).timestamp)
      await expect(proxy.executeSetDelay())
        .to.be.revertedWith('not enough time has passed')
    })
  })

  describe('Upgrading', () => {
    it('initially set to 0x', async () => {
      expect(await proxy.implementation()).to.eq(AddressZero)
    })

    it('only proxy owner can initialize setter', async () => {
      await expect(proxy.connect(anotherWallet).initializeUpgradeTo(tusd.address))
        .to.be.revertedWith('only Proxy Owner')

      await expect(proxy.initializeUpgradeTo(tusd.address))
        .not.to.be.reverted
    })

    describe('setting delay process', () => {
      beforeEach(async () => {
        await proxy.initializeUpgradeTo(tusd.address)
        timeTravel(provider, 10 * DAY)
      })

      it('sets pendingImplementation', async () => {
        expect(await proxy.pendingImplementation()).to.eq(tusd.address)
      })

      it('anyone execute setter', async () => {
        await expect(proxy.connect(anotherWallet).executeUpgradeTo())
          .not.to.be.reverted
      })

      it('sets new implementation', async () => {
        await proxy.executeUpgradeTo()
        expect(await proxy.implementation()).to.eq(tusd.address)
      })

      it('cannot set to the same implementation', async () => {
        await proxy.executeUpgradeTo()
        expect(await proxy.implementation()).to.eq(tusd.address)
        await expect(proxy.executeUpgradeTo())
          .to.be.reverted
      })

      it('emits event', async () => {
        await expect(proxy.connect(anotherWallet).executeUpgradeTo())
          .to.emit(proxy, 'Upgraded')
          .withArgs(tusd.address)
      })
    })

    it('initializing setter initializes cooldown', async () => {
      await proxy.initializeUpgradeTo(tusd.address)
      timeTravel(provider, 9 * DAY)
      expect(await proxy.implementationUnlockTimestamp())
        .to.be.gt((await provider.getBlock('latest')).timestamp)
      await expect(proxy.executeUpgradeTo())
        .to.be.revertedWith('not enough time has passed')
    })
  })
})
