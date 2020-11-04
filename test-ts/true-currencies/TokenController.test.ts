import { expect } from 'chai'
import { Wallet } from 'ethers'
import { loadFixture } from 'ethereum-waffle'

import { trueCurrency } from '../fixtures/trueCurrency'

import { TrueCurrency } from 'contracts/types/TrueCurrency'
import {
  TokenControllerMockFactory,
  TokenControllerMock,
} from 'contracts/types'

describe('TokenController', () => {
  let owner: Wallet
  let otherAccount: Wallet
  let registryAdmin: Wallet
  let token: TrueCurrency
  let controller: TokenControllerMock

  beforeEach(async () => {
    ({ wallets: [owner, registryAdmin, otherAccount], token } = await loadFixture(trueCurrency))
    controller = await new TokenControllerMockFactory(owner).deploy()
    await token.transferOwnership(controller.address)
    await controller.initialize()
    await controller.setToken(token.address)
    await controller.issueClaimOwnership(token.address)
    await controller.setRegistryAdmin(registryAdmin.address)
  })

  describe('setCanBurn', function () {
    it('sets whether address can burn', async function () {
      await controller.setCanBurn(otherAccount.address, true)
      expect(await token.canBurn(otherAccount.address)).to.be.true
      await controller.connect(registryAdmin).setCanBurn(otherAccount.address, false)
      expect(await token.canBurn(otherAccount.address)).to.be.false
    })

    it('emits event', async () => {
      await expect(controller.setCanBurn(otherAccount.address, true)).to.emit(controller, 'CanBurn')
        .withArgs(otherAccount.address, true)
    })

    it('rejects when called by non owner or registry admin', async () => {
      await expect(controller.connect(otherAccount).setCanBurn(otherAccount.address, true))
        .to.be.revertedWith('must be registry admin or owner')
    })
  })

  describe('setBlacklisted', function () {
    it('sets blacklisted status for the account', async function () {
      await expect(controller.setBlacklisted(otherAccount.address, true)).to.emit(token, 'Blacklisted')
        .withArgs(otherAccount.address, true)
      await expect(controller.setBlacklisted(otherAccount.address, false)).to.emit(token, 'Blacklisted')
        .withArgs(otherAccount.address, false)
    })

    it('rejects when called by non owner or registry admin', async () => {
      await expect(controller.connect(otherAccount).setBlacklisted(otherAccount.address, true)).to.be.revertedWith('must be registry admin or owner')
    })
  })
})
