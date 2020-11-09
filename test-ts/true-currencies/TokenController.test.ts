import { expect } from 'chai'
import { BigNumberish, Wallet } from 'ethers'
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

  const expectTokenBalance = async (token: MockTrueCurrency, wallet: Wallet, value: BigNumberish) => {
    expect(await token.balanceOf(wallet.address)).to.equal(value)
  }

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

  describe('Request and Finalize Mints (owner)', () => {
    beforeEach(async function () {
      await controller.setMintThresholds(parseEther('10'), parseEther('100'), parseEther('1000'))
      await controller.setMintLimits(parseEther('30'), parseEther('300'), parseEther('3000'))
    })

    it('mint limits cannot be out of order', async () => {
      await expect(controller.setMintLimits(parseEther('300'), parseEther('30'), parseEther('3000')))
        .to.be.reverted
      await expect(controller.setMintLimits(parseEther('30'), parseEther('300'), parseEther('200')))
        .to.be.reverted
    })

    it('mint thresholds cannot be out of order', async () => {
      await expect(controller.setMintThresholds(parseEther('100'), parseEther('10'), parseEther('1000')))
        .to.be.reverted
      await expect(controller.setMintThresholds(parseEther('10'), parseEther('100'), parseEther('50')))
        .to.be.reverted
    })

    it('non mintKey/owner cannot request mint', async () => {
      await expect(controller.connect(otherWallet).requestMint(thirdWallet.address, parseEther('10')))
        .to.be.reverted
    })

    it('request a mint', async () => {
      expect(await controller.mintOperationCount()).to.equal(0)
      await controller.requestMint(thirdWallet.address, parseEther('10'))
      const mintOperation = await controller.mintOperations(0)
      expect(mintOperation[0]).to.equal(thirdWallet.address)
      expect(mintOperation[1]).to.equal(parseEther('10'))
      expect(mintOperation[3]).to.equal(0)
      expect(await controller.mintOperationCount()).to.equal(1)
    })

    it('request mint then revoke it', async () => {
      await controller.connect(mintKey).requestMint(thirdWallet.address, parseEther('10'))

      await expect(controller.connect(mintKey).revokeMint(0))
        .to.emit(controller, 'RevokeMint')

      const mintOperation = await controller.mintOperations(0)
      expect(mintOperation[0]).to.equal('0x0000000000000000000000000000000000000000')
      expect(mintOperation[1]).to.equal('0')
      expect(mintOperation[2]).to.equal('0')
      expect(mintOperation[3]).to.equal('0')
    })

    it('request and finalize a mint', async () => {
      await controller.requestMint(thirdWallet.address, parseEther('10'))
      await expect(controller.ratifyMint(0, thirdWallet.address, parseEther('10')))
        .to.emit(controller, 'MintRatified')
        .withArgs('0', owner.address)

      expect(await token.totalSupply()).to.equal(parseEther('110'))
    })

    it('fails to transfer mintkey to 0x0', async () => {
      await expect(controller.transferMintKey('0x0000000000000000000000000000000000000000'))
        .to.be.reverted
    })

    it('non owner/mintkey cannot transfer mintkey', async () => {
      await expect(controller.connect(otherWallet).transferMintKey(thirdWallet.address))
        .to.be.reverted
    })
  })

  describe('Emit Proper Event Logs', async () => {
    it('transfer mintkey should generate logs', async () => {
      await expect(controller.transferMintKey(thirdWallet.address))
        .to.emit(controller, 'TransferMintKey')
        .withArgs(mintKey.address, thirdWallet.address)
    })

    it('pause mint should generate logs', async () => {
      await expect(controller.pauseMints())
        .to.emit(controller, 'AllMintsPaused')
        .withArgs(true)
    })

    it('changing mint thresholds should generate logs', async () => {
      await expect(controller.setMintThresholds(parseEther('10'), parseEther('100'), parseEther('1000')))
        .to.emit(controller, 'MintThresholdChanged')
        .withArgs(parseEther('10'), parseEther('100'), parseEther('1000'))
    })

    it('changing mint limits should generate logs', async () => {
      await expect(controller.setMintLimits(parseEther('30'), parseEther('300'), parseEther('3000')))
        .to.emit(controller, 'MintLimitsChanged')
        .withArgs(parseEther('30'), parseEther('300'), parseEther('3000'))
    })
  })

  describe('Full mint process', () => {
    beforeEach(async function () {
      await controller.setMintThresholds(parseEther('10'), parseEther('100'), parseEther('1000'))
      await controller.setMintLimits(parseEther('30'), parseEther('300'), parseEther('3000'))
      await controller.refillMultiSigMintPool()
      await controller.refillRatifiedMintPool()
      await controller.refillInstantMintPool()
    })

    it('have enough approvals for mints', async () => {
      expect(await controller.hasEnoughApproval(1, parseEther('50'))).to.be.true
      expect(await controller.hasEnoughApproval(1, parseEther('200'))).to.be.false
      expect(await controller.hasEnoughApproval(3, parseEther('200'))).to.be.true
      expect(await controller.hasEnoughApproval(3, parseEther('2000'))).to.be.false
      expect(await controller.hasEnoughApproval(2, parseEther('500'))).to.be.false
      expect(await controller.hasEnoughApproval(0, parseEther('50'))).to.be.false
    })

    it('owner can finalize before without approvals', async () => {
      await controller.connect(mintKey).requestMint(thirdWallet.address, parseEther('10'))
      await controller.ratifyMint(0, thirdWallet.address, parseEther('10'))
    })

    it('non ratifiers cannot ratify mints', async () => {
      await controller.connect(mintKey).requestMint(thirdWallet.address, parseEther('10'))
      await expect(controller.connect(otherWallet).ratifyMint(0, thirdWallet.address, parseEther('10')))
        .to.be.reverted
    })

    it('ratifier cannot ratify twice', async () => {
      await controller.connect(mintKey).requestMint(thirdWallet.address, parseEther('200'))
      await controller.connect(ratifier1).ratifyMint(0, thirdWallet.address, parseEther('200'))
      await expect(controller.connect(ratifier1).ratifyMint(0, thirdWallet.address, parseEther('200')))
        .to.be.reverted
    })

    it('ratify mint should generate logs', async () => {
      await controller.connect(mintKey).requestMint(thirdWallet.address, parseEther('10'))
      await expect(controller.connect(ratifier1).ratifyMint(0, thirdWallet.address, parseEther('10')))
        .to.emit(controller, 'MintRatified')
        .withArgs(0, ratifier1.address)
    })

    it('cannot approve the same mint twice', async () => {
      await controller.connect(mintKey).requestMint(thirdWallet.address, parseEther('10'))
      await controller.connect(ratifier1).ratifyMint(0, thirdWallet.address, parseEther('10'))
      await expect(controller.connect(ratifier1).ratifyMint(0, thirdWallet.address, parseEther('10')))
        .to.be.reverted
    })

    it('cannot request mint when mint paused', async () => {
      await controller.connect(pauseKey).pauseMints()
      await expect(controller.connect(mintKey).requestMint(thirdWallet.address, parseEther('10')))
        .to.be.reverted
    })

    it('non pause key cannot pause mint', async () => {
      await expect(controller.connect(otherWallet).pauseMints())
        .to.be.reverted
    })

    it('pause key cannot unpause', async () => {
      await expect(controller.connect(pauseKey).unpauseMints())
        .to.be.reverted
    })

    it('owner pauses then unpause then mints', async () => {
      await controller.pauseMints()
      await controller.unpauseMints()
      await controller.connect(mintKey).requestMint(thirdWallet.address, parseEther('10'))
    })

    it('ratify fails when the amount does not match', async () => {
      await controller.connect(mintKey).requestMint(thirdWallet.address, parseEther('10'))
      await expect(controller.connect(ratifier1).ratifyMint(0, thirdWallet.address, parseEther('11')))
        .to.be.reverted
    })

    it('ratify fails when the to address does not match', async () => {
      await controller.connect(mintKey).requestMint(thirdWallet.address, parseEther('10'))
      await expect(controller.connect(ratifier1).ratifyMint(0, otherWallet.address, parseEther('10')))
        .to.be.reverted
    })

    it('instant mint a small amount', async () => {
      await controller.connect(mintKey).instantMint(otherWallet.address, parseEther('10'))
      await expectTokenBalance(token, otherWallet, parseEther('10'))
    })

    it('cannot instant mint over the instant mint threshold', async () => {
      await expect(controller.connect(mintKey).instantMint(otherWallet.address, parseEther('15')))
        .to.be.reverted
    })

    it('cannot instant when the instant mint pool is dry', async () => {
      await controller.connect(mintKey).instantMint(otherWallet.address, parseEther('10'))
      await controller.connect(mintKey).instantMint(otherWallet.address, parseEther('10'))
      await controller.connect(mintKey).instantMint(otherWallet.address, parseEther('8'))
      await expect(controller.connect(mintKey).instantMint(otherWallet.address, parseEther('5')))
        .to.be.reverted
    })

    it('does the entire ratify mint process', async () => {
      await controller.connect(mintKey).requestMint(otherWallet.address, parseEther('20'))
      await controller.connect(ratifier1).ratifyMint(0, otherWallet.address, parseEther('20'))
      await expectTokenBalance(token, otherWallet, parseEther('20'))
      expect(await controller.ratifiedMintPool()).to.equal(parseEther('250'))
    })

    it('single approval ratify does not finalize if over the ratifiedMintthreshold', async () => {
      await controller.connect(mintKey).requestMint(otherWallet.address, parseEther('200'))
      await controller.connect(ratifier1).ratifyMint(0, otherWallet.address, parseEther('200'))
      await expectTokenBalance(token, otherWallet, 0)
    })

    it('single approval ratify mint does not finalize if over the ratifiedMintPool is dry', async () => {
      await controller.connect(mintKey).requestMint(otherWallet.address, parseEther('100'))
      await controller.connect(ratifier1).ratifyMint(0, otherWallet.address, parseEther('100'))
      await controller.connect(mintKey).requestMint(otherWallet.address, parseEther('100'))
      await controller.connect(ratifier1).ratifyMint(1, otherWallet.address, parseEther('100'))
      await controller.connect(mintKey).requestMint(otherWallet.address, parseEther('30'))
      await controller.connect(ratifier1).ratifyMint(2, otherWallet.address, parseEther('30'))
      await controller.connect(mintKey).requestMint(otherWallet.address, parseEther('50'))
      await controller.connect(ratifier1).ratifyMint(3, otherWallet.address, parseEther('50'))
      await expectTokenBalance(token, otherWallet, parseEther('230'))
    })

    it('cannot finalize mint without enough approvers', async () => {
      await controller.connect(mintKey).requestMint(otherWallet.address, parseEther('50'))
      await expect(controller.connect(mintKey).finalizeMint(0))
        .to.be.reverted
      await controller.connect(ratifier1).ratifyMint(0, otherWallet.address, parseEther('50'))
      await controller.connect(mintKey).requestMint(otherWallet.address, parseEther('500'))
      await controller.connect(ratifier1).ratifyMint(1, otherWallet.address, parseEther('500'))
      await controller.connect(ratifier2).ratifyMint(1, otherWallet.address, parseEther('500'))
      await expect(controller.connect(mintKey).finalizeMint(1))
        .to.be.reverted
      await controller.connect(ratifier3).ratifyMint(1, otherWallet.address, parseEther('500'))
    })

    it('owner can finalize mint without ratifiers', async () => {
      await controller.connect(mintKey).requestMint(otherWallet.address, parseEther('50'))
      await controller.finalizeMint(0)
      await controller.connect(mintKey).requestMint(otherWallet.address, parseEther('500'))
      await controller.finalizeMint(1)
    })

    it('does the entire multiSig mint process', async () => {
      await controller.connect(mintKey).requestMint(otherWallet.address, parseEther('200'))
      await controller.connect(ratifier1).ratifyMint(0, otherWallet.address, parseEther('200'))
      await controller.connect(ratifier2).ratifyMint(0, otherWallet.address, parseEther('200'))
      await controller.connect(ratifier3).ratifyMint(0, otherWallet.address, parseEther('200'))
      await expectTokenBalance(token, otherWallet, parseEther('200'))
      expect(await controller.multiSigMintPool()).to.equal(parseEther('2500'))
    })

    it('multiSig mint does not finalize if over the jumbpMintthreshold', async () => {
      await controller.connect(mintKey).requestMint(otherWallet.address, parseEther('2000'))
      await controller.connect(ratifier1).ratifyMint(0, otherWallet.address, parseEther('2000'))
      await controller.connect(ratifier2).ratifyMint(0, otherWallet.address, parseEther('2000'))
      await controller.connect(ratifier3).ratifyMint(0, otherWallet.address, parseEther('2000'))
      await expectTokenBalance(token, otherWallet, 0)
    })

    it('multiSig mint does not finalize if over the multiSigMintPool is dry', async () => {
      await controller.connect(mintKey).requestMint(otherWallet.address, parseEther('1000'))
      await controller.connect(ratifier1).ratifyMint(0, otherWallet.address, parseEther('1000'))
      await controller.connect(ratifier2).ratifyMint(0, otherWallet.address, parseEther('1000'))
      await controller.connect(ratifier3).ratifyMint(0, otherWallet.address, parseEther('1000'))
      await controller.connect(mintKey).requestMint(otherWallet.address, parseEther('1000'))
      await controller.connect(ratifier1).ratifyMint(1, otherWallet.address, parseEther('1000'))
      await controller.connect(ratifier2).ratifyMint(1, otherWallet.address, parseEther('1000'))
      await controller.connect(ratifier3).ratifyMint(1, otherWallet.address, parseEther('1000'))
      await controller.connect(mintKey).requestMint(otherWallet.address, parseEther('300'))
      await controller.connect(ratifier1).ratifyMint(2, otherWallet.address, parseEther('300'))
      await controller.connect(ratifier2).ratifyMint(2, otherWallet.address, parseEther('300'))
      await controller.connect(ratifier3).ratifyMint(2, otherWallet.address, parseEther('300'))
      await controller.connect(mintKey).requestMint(otherWallet.address, parseEther('500'))
      await controller.connect(ratifier1).ratifyMint(3, otherWallet.address, parseEther('500'))
      await controller.connect(ratifier2).ratifyMint(3, otherWallet.address, parseEther('500'))
      await controller.connect(ratifier3).ratifyMint(3, otherWallet.address, parseEther('500'))
      await expectTokenBalance(token, otherWallet, parseEther('2300'))
    })

    it('owner can mint unlimited amount', async () => {
      await controller.connect(mintKey).requestMint(thirdWallet.address, parseEther('10000'))
      await controller.ratifyMint(0, thirdWallet.address, parseEther('10000'))
    })

    it('pause key can pause specific mint', async () => {
      await controller.connect(mintKey).requestMint(thirdWallet.address, parseEther('10'))
      await controller.connect(pauseKey).pauseMint(0)
      await expect(controller.connect(ratifier1).ratifyMint(0, thirdWallet.address, parseEther('10')))
        .to.be.reverted
    })

    it('pause key cannot unpause specific mint', async () => {
      await controller.connect(mintKey).requestMint(thirdWallet.address, parseEther('10'))
      await controller.connect(pauseKey).pauseMint(0)
      await expect(controller.connect(pauseKey).unpauseMint(0))
        .to.be.reverted
    })

    it('owner can unpause specific mint', async () => {
      await controller.connect(mintKey).requestMint(thirdWallet.address, parseEther('10'))
      await controller.connect(pauseKey).pauseMint(0)
      await controller.unpauseMint(0)
      await controller.connect(ratifier1).ratifyMint(0, thirdWallet.address, parseEther('10'))
    })

    it('cannot finalize after all request invalidated', async () => {
      await controller.connect(mintKey).requestMint(thirdWallet.address, parseEther('10'))
      await controller.connect(mintKey).requestMint(thirdWallet.address, parseEther('10'))
      await controller.invalidateAllPendingMints()
      await expect(controller.connect(ratifier1).ratifyMint(0, thirdWallet.address, parseEther('10')))
        .to.be.reverted
      await expect(controller.connect(ratifier1).ratifyMint(1, thirdWallet.address, parseEther('10')))
        .to.be.reverted
    })
  })

  describe('setCanBurn', () => {
    it('sets whether address can burn', async () => {
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

  describe('setBlacklisted', () => {
    it('sets blacklisted status for the account', async () => {
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
