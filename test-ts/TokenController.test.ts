import { Wallet } from 'ethers'
import { loadFixture } from 'ethereum-waffle'
import { expect } from 'chai'
import { TrueCurrency } from '../build/types/TrueCurrency'
import { trueCurrency } from './fixtures/trueCurrency'
import { TokenControllerMockFactory } from '../build/types/TokenControllerMockFactory'
import { TokenControllerMock } from '../build/types/TokenControllerMock'

describe('TrueCurrency - ERC20 behaviour', () => {
  let owner: Wallet
  let otherAccount: Wallet
  let token: TrueCurrency
  let controller: TokenControllerMock

  beforeEach(async () => {
    ({ wallets: [owner, otherAccount], token } = await loadFixture(trueCurrency))
    controller = await new TokenControllerMockFactory(owner).deploy()
    await token.transferOwnership(controller.address)
    await controller.initialize()
    await controller.setToken(token.address)
    await controller.issueClaimOwnership(token.address)
  })

  describe('setCanBurn', function () {
    it('sets whether address can burn', async function () {
      await controller.setCanBurn(otherAccount.address, true)
      expect(await token.canBurn(otherAccount.address)).to.be.true
      await controller.setCanBurn(otherAccount.address, false)
      expect(!await token.canBurn(otherAccount.address)).to.be.true
    })

    it('rejects when called by non owner', async () => {
      await expect(controller.connect(otherAccount).setCanBurn(otherAccount.address, true)).to.be.revertedWith('only Owner')
    })
  })
})
