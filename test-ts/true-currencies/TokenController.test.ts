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
    await registry.setAttribute(thirdWallet.address, CAN_BURN, 1, notes, { gasLimit: 5_000_000 })
    await registry.setAttribute(ratifier1.address, formatBytes32String('isTUSDMintRatifier'), 1, notes, { gasLimit: 5_000_000 })
    await registry.setAttribute(ratifier2.address, formatBytes32String('isTUSDMintRatifier'), 1, notes, { gasLimit: 5_000_000 })
    await registry.setAttribute(ratifier3.address, formatBytes32String('isTUSDMintRatifier'), 1, notes, { gasLimit: 5_000_000 })
    await registry.setAttribute(pauseKey.address, formatBytes32String('isTUSDMintPausers'), 1, notes)
    await controller.setMintThresholds(parseEther('200'), parseEther('1000'), parseEther('1001'))
    await controller.setMintLimits(parseEther('200'), parseEther('300'), parseEther('3000'))
    await controller.refillMultiSigMintPool()
    await controller.refillRatifiedMintPool()
    await controller.refillInstantMintPool()
    await controller.instantMint(thirdWallet.address, parseEther('100'))
    await controller.setMintLimits(0, 0, 0)
  })

  describe('Request and Finalize Mints (owner)', function () {
    beforeEach(async function () {
      await controller.setMintThresholds(parseEther('10'), parseEther('100'), parseEther('1000'))
      await controller.setMintLimits(parseEther('30'), parseEther('300'), parseEther('3000'))
    })

    it('mint limits cannot be out of order', async function () {
      await expect(controller.setMintLimits(parseEther('300'), parseEther('30'), parseEther('3000')))
        .to.be.reverted
      await expect(controller.setMintLimits(parseEther('30'), parseEther('300'), parseEther('200')))
        .to.be.reverted
    })

    it('mint thresholds cannot be out of order', async function () {
      await expect(controller.setMintThresholds(parseEther('100'), parseEther('10'), parseEther('1000')))
        .to.be.reverted
      await expect(controller.setMintThresholds(parseEther('10'), parseEther('100'), parseEther('50')))
        .to.be.reverted
    })

    it('non mintKey/owner cannot request mint', async function () {
      await expect(controller.connect(otherWallet).requestMint(thirdWallet.address, parseEther('10')))
        .to.be.reverted
    })

    it('request a mint', async function () {
      expect(await controller.mintOperationCount()).to.equal(0)
      await controller.requestMint(thirdWallet.address, parseEther('10'))
      const mintOperation = await controller.mintOperations(0)
      expect(mintOperation[0]).to.equal(thirdWallet.address)
      expect(mintOperation[1]).to.equal(parseEther('10'))
      expect(mintOperation[3]).to.equal(0)
      expect(await controller.mintOperationCount()).to.equal(1)
    })

    it('request mint then revoke it', async function () {
      await controller.connect(mintKey).requestMint(thirdWallet.address, parseEther('10'))

      await expect(controller.connect(mintKey).revokeMint(0))
        .to.emit(controller, 'RevokeMint')

      const mintOperation = await controller.mintOperations(0)
      expect(mintOperation[0]).to.equal('0x0000000000000000000000000000000000000000')
      expect(mintOperation[1]).to.equal('0')
      expect(mintOperation[2]).to.equal('0')
      expect(mintOperation[3]).to.equal('0')
    })

    it('request and finalize a mint', async function () {
      await controller.requestMint(thirdWallet.address, parseEther('10'))
      await expect(controller.ratifyMint(0, thirdWallet.address, parseEther('10')))
        .to.emit(controller, 'MintRatified')
        .withArgs('0', owner.address)

      expect(await token.totalSupply()).to.equal(parseEther('110'))
    })

    it('fails to transfer mintkey to 0x0', async function () {
      await expect(controller.transferMintKey('0x0000000000000000000000000000000000000000'))
        .to.be.reverted
    })

    it('non owner/mintkey cannot transfer mintkey', async function () {
      await expect(controller.connect(otherWallet).transferMintKey(thirdWallet.address))
        .to.be.reverted
    })
  })

  describe('Emit Proper Event Logs', async function () {
    it('transfer mintkey should generate logs', async function () {
      await expect(controller.transferMintKey(thirdWallet.address))
        .to.emit(controller, 'TransferMintKey')
        .withArgs(mintKey.address, thirdWallet.address)
    })

    it('pause mint should generate logs', async function () {
      await expect(controller.pauseMints())
        .to.emit(controller, 'AllMintsPaused')
        .withArgs(true)
    })

    it('changing mint thresholds should generate logs', async function () {
      await expect(controller.setMintThresholds(parseEther('10'), parseEther('100'), parseEther('1000')))
        .to.emit(controller, 'MintThresholdChanged')
        .withArgs(parseEther('10'), parseEther('100'), parseEther('1000'))
    })

    it('changing mint limits should generate logs', async function () {
      await expect(controller.setMintLimits(parseEther('30'), parseEther('300'), parseEther('3000')))
        .to.emit(controller, 'MintLimitsChanged')
        .withArgs(parseEther('30'), parseEther('300'), parseEther('3000'))
    })
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
