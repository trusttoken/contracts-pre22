import { Wallet } from 'ethers'
import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { AddressZero } from '@ethersproject/constants'

import { parseAccountList, registerSaftAccounts } from 'scripts/register_saft_addresses'
import {
  toTrustToken,
  setupDeploy,
} from 'scripts/utils'

import {
  expectEvent,
  beforeEachWithFixture,
} from 'test/utils'

import {
  TrustTokenFactory,
  TrustToken,
  TimeLockRegistryFactory,
  TimeLockRegistry,
  OwnedUpgradeabilityProxyFactory,
} from 'contracts'

use(solidity)

describe('TimeLockRegistry', () => {
  let owner: Wallet, holder: Wallet, another: Wallet
  let registry: TimeLockRegistry
  let trustToken: TrustToken

  beforeEachWithFixture(async (wallets) => {
    ([owner, holder, another] = wallets)
    const deployContract = setupDeploy(owner)
    trustToken = await deployContract(TrustTokenFactory)
    await trustToken.mint(owner.address, toTrustToken(1000))
    const proxy = await deployContract(OwnedUpgradeabilityProxyFactory)
    const registryImpl = await deployContract(TimeLockRegistryFactory)
    await proxy.upgradeTo(registryImpl.address)
    registry = TimeLockRegistryFactory.connect(proxy.address, owner)
    await registry.initialize(trustToken.address)
    await trustToken.setTimeLockRegistry(registry.address)
  })

  it('cannot be initialized twice', async () => {
    await expect(registry.initialize(trustToken.address)).to.be.revertedWith('Already initialized')
  })

  describe('Register', () => {
    it('non-owner cannot register accounts', async () => {
      await expect(registry.connect(holder).register(holder.address, 1)).to.be.revertedWith('only owner')
    })

    it('cannot register if allowance is too small', async () => {
      await trustToken.approve(registry.address, 9)
      await expect(registry.register(holder.address, 10)).to.be.revertedWith('ERC20: transfer amount exceeds allowance')
    })

    it('adds recipient to distributions list', async () => {
      await trustToken.approve(registry.address, toTrustToken(10))
      // event emitted correctly
      const tx = await registry.register(holder.address, toTrustToken(10))

      await expectEvent(registry, 'Register')(tx, holder.address, toTrustToken(10))

      expect(await registry.registeredDistributions(holder.address)).to.equal(toTrustToken(10))
      expect(await trustToken.balanceOf(owner.address)).to.equal(toTrustToken(990))
      expect(await trustToken.balanceOf(registry.address)).to.equal(toTrustToken(10))
    })

    it('cannot register same address twice', async () => {
      await trustToken.approve(registry.address, toTrustToken(10))
      await registry.register(holder.address, toTrustToken(5))
      await expect(registry.register(holder.address, toTrustToken(5))).to.be.revertedWith('Distribution for this address is already registered')
    })

    it('cannot register distribution for zero address', async () => {
      await expect(registry.register(AddressZero, toTrustToken(5))).to.be.revertedWith('Zero address')
    })

    it('cannot register zero distribution', async () => {
      await expect(registry.register(holder.address, 0)).to.be.revertedWith('Distribution = 0')
    })
  })

  describe('Cancel', () => {
    it('cancels registration', async () => {
      await trustToken.approve(registry.address, toTrustToken(10))
      await registry.register(holder.address, toTrustToken(10))
      const tx = await registry.cancel(holder.address)

      await expectEvent(registry, 'Cancel')(tx, holder.address, toTrustToken(10))

      expect(await registry.registeredDistributions(holder.address)).to.equal(0)
      expect(await trustToken.balanceOf(owner.address)).to.equal(toTrustToken(1000))
      expect(await trustToken.balanceOf(registry.address)).to.equal(0)
    })

    it('cancel one of 2 registrations', async () => {
      await trustToken.approve(registry.address, toTrustToken(10))
      await registry.register(holder.address, toTrustToken(5))
      await registry.register(another.address, toTrustToken(5))
      await registry.cancel(holder.address)

      expect(await registry.registeredDistributions(holder.address)).to.equal(0)
      expect(await registry.registeredDistributions(another.address)).to.equal(toTrustToken(5))
      expect(await trustToken.balanceOf(owner.address)).to.equal(toTrustToken(995))
      expect(await trustToken.balanceOf(registry.address)).to.equal(toTrustToken(5))
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
      await trustToken.approve(registry.address, toTrustToken(10))
      await registry.register(holder.address, toTrustToken(10))
      const tx = await registry.connect(holder).claim()

      await expectEvent(registry, 'Claim')(tx, holder.address, toTrustToken(10))

      expect(await registry.registeredDistributions(holder.address)).to.equal(0)
      expect(await trustToken.balanceOf(owner.address)).to.equal(toTrustToken(990))
      expect(await trustToken.balanceOf(registry.address)).to.equal(0)
      expect(await trustToken.balanceOf(holder.address)).to.equal(toTrustToken(10))
    })

    it('cannot claim twice', async () => {
      await trustToken.approve(registry.address, toTrustToken(10))
      await registry.register(holder.address, toTrustToken(10))
      await registry.connect(holder).claim()
      await expect(registry.connect(holder).claim()).to.be.revertedWith('Not registered')
    })

    it('cannot claim after cancel', async () => {
      await trustToken.approve(registry.address, toTrustToken(10))
      await registry.register(holder.address, toTrustToken(10))
      await registry.cancel(holder.address)
      await expect(registry.connect(holder).claim()).to.be.revertedWith('Not registered')
    })

    it('register, claim, re-register', async () => {
      await trustToken.approve(registry.address, toTrustToken(20))
      await registry.register(holder.address, toTrustToken(10))
      await registry.connect(holder).claim()
      await registry.register(holder.address, toTrustToken(10))
      await registry.connect(holder).claim()
      expect(await trustToken.balanceOf(holder.address)).to.equal(toTrustToken(20))
    })
  })

  describe('Register SAFT accounts script', () => {
    const [address1, address2, address3] = [
      Wallet.createRandom().address,
      Wallet.createRandom().address,
      Wallet.createRandom().address,
    ]
    const csvList = `
      ${address1},500
      ${address2}, 123.32
      ${address3},3.14
      
    `

    it('correctly parses CSV file', async () => {
      expect(parseAccountList(csvList)).to.deep.equal([{
        address: address1, amount: '500',
      }, {
        address: address2, amount: '123.32',
      }, {
        address: address3, amount: '3.14',
      }])
    })

    it('registers all accounts', async () => {
      await registerSaftAccounts(registry, trustToken, parseAccountList(csvList))
      expect(await registry.registeredDistributions(address1)).to.equal(toTrustToken(500))
      expect(await registry.registeredDistributions(address2)).to.equal(toTrustToken(123.32))
      expect(await registry.registeredDistributions(address3)).to.equal(toTrustToken(3.14))
      expect(await trustToken.allowance(owner.address, registry.address)).to.equal(0)
    })
  })
})
