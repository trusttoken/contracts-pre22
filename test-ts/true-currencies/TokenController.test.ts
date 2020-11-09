import { expect } from 'chai'
import { Wallet } from 'ethers'
import { formatBytes32String } from '@ethersproject/strings'
import { parseEther } from '@ethersproject/units'

import { beforeEachWithFixture } from 'utils'

import {
  TokenControllerMockFactory,
  TokenControllerMock,
  RegistryMock,
  RegistryMockFactory,
  OwnedUpgradeabilityProxy,
  OwnedUpgradeabilityProxyFactory,
  MockTrueCurrencyFactory,
  MockTrueCurrency,
} from 'contracts'

describe.only('TokenController', () => {
  let owner: Wallet
  let otherWallet: Wallet
  let thirdWallet: Wallet
  let registryAdmin: Wallet
  let mintKey: Wallet
  let pauseKey: Wallet
  let ratifier1: Wallet
  let ratifier2: Wallet
  let ratifier3: Wallet

  let token: MockTrueCurrency
  let tokenImplementation: MockTrueCurrency
  let tokenProxy: OwnedUpgradeabilityProxy
  let controller: TokenControllerMock
  let registry: RegistryMock

  const notes = formatBytes32String('notes')
  const CAN_BURN = formatBytes32String('canBurn')

  beforeEachWithFixture(async (wallets) => {
    [owner, registryAdmin, otherWallet, thirdWallet, mintKey, pauseKey, ratifier1, ratifier2, ratifier3] = wallets
    
    registry = await new RegistryMockFactory(owner).deploy()
    controller = await new TokenControllerMockFactory(owner).deploy()
    
    tokenProxy = await new OwnedUpgradeabilityProxyFactory(owner).deploy()
    tokenImplementation = await new MockTrueCurrencyFactory(owner).deploy()
    await tokenProxy.upgradeTo(tokenImplementation.address)

    token = new MockTrueCurrencyFactory(owner).attach(tokenProxy.address)
    await token.initialize()

    await token.transferOwnership(controller.address)
    await controller.initialize()
    await controller.issueClaimOwnership(token.address)
    await controller.setRegistryAdmin(registryAdmin.address)
    await controller.setRegistry(registry.address)
    await controller.setToken(token.address)
    await controller.transferMintKey(mintKey.address)
    await tokenProxy.transferProxyOwnership(controller.address)
    await controller.claimTrueCurrencyProxyOwnership()
    await registry.setAttribute(thirdWallet.address, CAN_BURN, 1, notes, {gasLimit: 5_000_000})
    await registry.setAttribute(ratifier1.address, formatBytes32String('isTUSDMintRatifier'), 1, notes, {gasLimit: 5_000_000})
    await registry.setAttribute(ratifier2.address, formatBytes32String('isTUSDMintRatifier'), 1, notes, {gasLimit: 5_000_000})
    await registry.setAttribute(ratifier3.address, formatBytes32String('isTUSDMintRatifier'), 1, notes, {gasLimit: 5_000_000})
    await registry.setAttribute(pauseKey.address, formatBytes32String('isTUSDMintPausers'), 1, notes)
    await controller.setMintThresholds(parseEther('200'), parseEther('1000'), parseEther('1001'))
    await controller.setMintLimits(parseEther('200'), parseEther('300'), parseEther('3000'))
    await controller.refillMultiSigMintPool()
    await controller.refillRatifiedMintPool()
    await controller.refillInstantMintPool()
    await controller.instantMint(thirdWallet.address, parseEther('100'))
    await controller.setMintLimits(0, 0, 0)
  })

  describe('setCanBurn', function () {
    it('sets whether address can burn', async function () {
      await controller.setCanBurn(otherWallet.address, true)
      expect(await token.canBurn(otherWallet.address)).to.be.true
      await controller.connect(registryAdmin).setCanBurn(otherWallet.address, false)
      expect(await token.canBurn(otherWallet.address)).to.be.false
    })

    it('emits event', async () => {
      await expect(controller.setCanBurn(otherWallet.address, true)).to.emit(controller, 'CanBurn')
        .withArgs(otherWallet.address, true)
    })

    it('rejects when called by non owner or registry admin', async () => {
      await expect(controller.connect(otherWallet).setCanBurn(otherWallet.address, true))
        .to.be.revertedWith('must be registry admin or owner')
    })
  })

  describe('setBlacklisted', function () {
    it('sets blacklisted status for the account', async function () {
      await expect(controller.setBlacklisted(otherWallet.address, true)).to.emit(token, 'Blacklisted')
        .withArgs(otherWallet.address, true)
      await expect(controller.setBlacklisted(otherWallet.address, false)).to.emit(token, 'Blacklisted')
        .withArgs(otherWallet.address, false)
    })

    it('rejects when called by non owner or registry admin', async () => {
      await expect(controller.connect(otherWallet).setBlacklisted(otherWallet.address, true)).to.be.revertedWith('must be registry admin or owner')
    })
  })
})
