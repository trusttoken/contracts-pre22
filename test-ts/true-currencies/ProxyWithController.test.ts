import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { Wallet } from 'ethers'
import { parseEther } from '@ethersproject/units'
import { formatBytes32String } from '@ethersproject/strings'

import {
  beforeEachWithFixture,
} from 'utils'

import {
  RegistryMock,
  MockTrueCurrency,
  OwnedUpgradeabilityProxy,
  TokenControllerMock,
  RegistryMockFactory,
  MockTrueCurrencyFactory,
  OwnedUpgradeabilityProxyFactory,
  TokenControllerMockFactory,
} from 'contracts'

use(solidity)

describe('ProxyWithController', () => {
  let owner: Wallet
  let otherWallet: Wallet
  let thirdWallet: Wallet
  let mintKey: Wallet
  let pauseKey: Wallet
  let approver1: Wallet
  let approver2: Wallet
  let approver3: Wallet

  let registry: RegistryMock

  let tokenProxy: OwnedUpgradeabilityProxy
  let tusdImplementation: MockTrueCurrency
  let token: MockTrueCurrency

  let controllerProxy: OwnedUpgradeabilityProxy
  let controllerImplementation: TokenControllerMock
  let controller: TokenControllerMock

  const notes = formatBytes32String('some notes')
  const CAN_BURN = formatBytes32String('canBurn')

  beforeEachWithFixture(async (wallets) => {
    [owner, otherWallet, thirdWallet, mintKey, pauseKey, approver1, approver2, approver3] = wallets
    registry = await new RegistryMockFactory(owner).deploy()

    tokenProxy = await new OwnedUpgradeabilityProxyFactory(owner).deploy()
    tusdImplementation = await new MockTrueCurrencyFactory(owner).deploy()
    await tokenProxy.upgradeTo(tusdImplementation.address)
    token = new MockTrueCurrencyFactory(owner).attach(tokenProxy.address)
    await token.initialize()

    controllerProxy = await new OwnedUpgradeabilityProxyFactory(owner).deploy()
    controllerImplementation = await new TokenControllerMockFactory(owner).deploy()
    await controllerProxy.upgradeTo(controllerImplementation.address)
    controller = new TokenControllerMockFactory(owner).attach(controllerProxy.address)

    await controller.initialize()
    await controller.setToken(token.address)
    await controller.transferMintKey(mintKey.address)
  })

  describe('Set up proxy', () => {
    it('controller cannot be reinitialized', async () => {
      await expect(controller.initialize())
        .to.be.reverted
    })

    it('owner can transfer ownership to pending owner', async () => {
      await controller.transferOwnership(otherWallet.address)
    })

    it('non owner cannot transfer ownership', async () => {
      await expect(controller.connect(otherWallet).transferOwnership(otherWallet.address))
        .to.be.reverted
    })

    it('pending owner can claim ownerhship', async () => {
      await controller.transferOwnership(otherWallet.address)
      await controller.connect(otherWallet).claimOwnership()
    })

    it('non pending owner cannot claim ownership', async () => {
      await controller.transferOwnership(otherWallet.address)
      await expect(controller.connect(thirdWallet).claimOwnership())
        .to.be.reverted
    })

    it('token can transfer ownership to controller', async () => {
      await token.transferOwnership(controller.address)
      expect(await token.pendingOwner()).to.equal(controller.address)

      await controller.issueClaimOwnership(token.address)
      expect(await token.owner()).to.equal(controller.address)
    })

    describe('TokenController functions', () => {
      beforeEach(async function () {
        await registry.setAttribute(thirdWallet.address, CAN_BURN, 1, notes)
        await registry.setAttribute(approver1.address, formatBytes32String('isTUSDMintApprover'), 1, notes)
        await registry.setAttribute(approver2.address, formatBytes32String('isTUSDMintApprover'), 1, notes)
        await registry.setAttribute(approver3.address, formatBytes32String('isTUSDMintApprover'), 1, notes)
        await registry.setAttribute(pauseKey.address, formatBytes32String('isTUSDMintPausers'), 1, notes)
        await token.mint(thirdWallet.address, parseEther('1000'))
        await token.transferOwnership(controller.address)
        await controller.issueClaimOwnership(token.address)
        await controller.setMintThresholds(parseEther('100'), parseEther('1000'), parseEther('10000'))
        await controller.setMintLimits(parseEther('300'), parseEther('3000'), parseEther('30000'))
      })

      it('non mintKey/owner cannot request mint', async () => {
        await expect(controller.connect(otherWallet).requestMint(otherWallet.address, parseEther('100')))
          .to.be.reverted
      })

      it('request a mint', async () => {
        expect(await controller.mintOperationCount()).to.equal(0)
        await controller.requestMint(thirdWallet.address, parseEther('100'))
        const mintOperation = await controller.mintOperations(0)
        expect(mintOperation[0]).to.equal(thirdWallet.address)
        expect(mintOperation[1]).to.equal(parseEther('100'))
        expect(mintOperation[3]).to.equal(0)
        expect(await controller.mintOperationCount()).to.equal(1)
      })
    })
  })
})
