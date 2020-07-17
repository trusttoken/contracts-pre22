import { Wallet } from 'ethers'
import { beforeEachWithFixture } from './utils/beforeEachWithFixture'
import { setupDeploy } from '../scripts/utils'
import { TrustTokenFactory } from '../build/types/TrustTokenFactory'
import { TrustToken } from '../build/types/TrustToken'
import { TimeLockRegistryFactory } from '../build/types/TimeLockRegistryFactory'
import { TimeLockRegistry } from '../build/types/TimeLockRegistry'

import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { parseTT } from './utils/parseTT'
import { AddressZero } from 'ethers/constants'

import { expectEvent } from './utils/eventHelpers'

use(solidity)

describe('TimeLockedRegistry', () => {
  let owner: Wallet, holder: Wallet, another: Wallet
  let registry: TimeLockRegistry
  let trustToken: TrustToken

  beforeEachWithFixture(async (provider, wallets) => {
    ([owner, holder, another] = wallets)
    const deployContract = setupDeploy(owner)
    trustToken = await deployContract(TrustTokenFactory)
    await trustToken.mint(owner.address, parseTT(1000))
    registry = await deployContract(TimeLockRegistryFactory, trustToken.address)
    await trustToken.setTimeLockRegistry(registry.address)
  })

  describe('Register', () => {
    it('non-owner cannot register accounts', async () => {
      await expect(registry.connect(holder).register(holder.address, 1)).to.be.revertedWith('only owner')
    })

    it('cannot register if allowance is too small', async () => {
      await trustToken.approve(registry.address, 9)
      await expect(registry.register(holder.address, 10)).to.be.revertedWith('Insufficient allowance')
    })

    it('adds recipient to distributions list', async () => {
      await trustToken.approve(registry.address, parseTT(10))
      // event emitted correctly
      const tx = await registry.register(holder.address, parseTT(10))

      await expectEvent(registry, 'Register')(tx, holder.address, parseTT(10))

      expect(await registry.registeredDistributions(holder.address)).to.equal(parseTT(10))
      expect(await trustToken.balanceOf(owner.address)).to.equal(parseTT(990))
      expect(await trustToken.balanceOf(registry.address)).to.equal(parseTT(10))
    })

    it('cannot register same address twice', async () => {
      await trustToken.approve(registry.address, parseTT(10))
      await registry.register(holder.address, parseTT(5))
      await expect(registry.register(holder.address, parseTT(5))).to.be.revertedWith('Distribution for this address is already registered')
    })

    it('cannot register distribution for zero address', async () => {
      await expect(registry.register(AddressZero, parseTT(5))).to.be.revertedWith('Zero address')
    })

    it('cannot register zero distribution', async () => {
      await expect(registry.register(holder.address, 0)).to.be.revertedWith('Distribution = 0')
    })
  })

  describe('Cancel', () => {
    it('cancels registration', async () => {
      await trustToken.approve(registry.address, parseTT(10))
      await registry.register(holder.address, parseTT(10))
      const tx = await registry.cancel(holder.address)

      await expectEvent(registry, 'Cancel')(tx, holder.address, parseTT(10))

      expect(await registry.registeredDistributions(holder.address)).to.equal(0)
      expect(await trustToken.balanceOf(owner.address)).to.equal(parseTT(1000))
      expect(await trustToken.balanceOf(registry.address)).to.equal(0)
    })

    it('cancel one of 2 registrations', async () => {
      await trustToken.approve(registry.address, parseTT(10))
      await registry.register(holder.address, parseTT(5))
      await registry.register(another.address, parseTT(5))
      await registry.cancel(holder.address)

      expect(await registry.registeredDistributions(holder.address)).to.equal(0)
      expect(await registry.registeredDistributions(another.address)).to.equal(parseTT(5))
      expect(await trustToken.balanceOf(owner.address)).to.equal(parseTT(995))
      expect(await trustToken.balanceOf(registry.address)).to.equal(parseTT(5))
    })

    it('cannot cancel by non-owner', async () => {
      await expect(registry.connect(holder).cancel(holder.address)).to.be.revertedWith('only owner')
    })

    it('cannot cancel not registered address', async () => {
      await expect(registry.cancel(holder.address)).to.be.revertedWith('Not registered')
    })
  })

  describe('Claim', () => {
    it('cannot claim if not registered', async () => {
      await expect(registry.claim()).to.be.revertedWith('Not registered')
    })

    it('transfers funds to registered address', async () => {
      await trustToken.approve(registry.address, parseTT(10))
      await registry.register(holder.address, parseTT(10))
      const tx = await registry.connect(holder).claim()

      await expectEvent(registry, 'Claim')(tx, holder.address, parseTT(10))

      expect(await registry.registeredDistributions(holder.address)).to.equal(0)
      expect(await trustToken.balanceOf(owner.address)).to.equal(parseTT(990))
      expect(await trustToken.balanceOf(registry.address)).to.equal(0)
      expect(await trustToken.balanceOf(holder.address)).to.equal(parseTT(10))
      expect(await trustToken.lockedBalance(holder.address)).to.equal(parseTT(10))
    })

    it('cannot claim twice', async () => {
      await trustToken.approve(registry.address, parseTT(10))
      await registry.register(holder.address, parseTT(10))
      await registry.connect(holder).claim()
      await expect(registry.connect(holder).claim()).to.be.revertedWith('Not registered')
    })

    it('cannot claim after cancel', async () => {
      await trustToken.approve(registry.address, parseTT(10))
      await registry.register(holder.address, parseTT(10))
      await registry.cancel(holder.address)
      await expect(registry.connect(holder).claim()).to.be.revertedWith('Not registered')
    })
  })
})
