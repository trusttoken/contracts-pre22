import { Wallet } from 'ethers'
import { expect } from 'chai'

import { setupDeploy } from 'scripts/utils'

import { beforeEachWithFixture } from 'utils'

import {
  MockHookFactory,
  MockHook,
  TokenControllerMock,
  TokenControllerMockFactory,
  MockGasRefundTokenFactory,
  MockGasRefundToken,
} from 'contracts'

describe('TrueCurrency - ERC20', () => {
  let deployer: Wallet
  let refunder: Wallet
  let otherAccount: Wallet
  let token: MockGasRefundToken
  let hookContract: MockHook
  let controller: TokenControllerMock

  beforeEachWithFixture(async (wallets: Wallet[]) => {
    [deployer, refunder, otherAccount] = wallets
    const deployContract = setupDeploy(deployer)
    token = await deployContract(MockGasRefundTokenFactory)
    await token.initialize()
    hookContract = await deployContract(MockHookFactory)
    controller = await deployContract(TokenControllerMockFactory)
    await controller.initialize()
    await controller.setToken(token.address)
    await token.transferOwnership(controller.address)
    await controller.issueClaimOwnership(token.address)
    await controller.setGasRefunder(refunder.address)
    // first call may skew gas usage a little
    await hookContract.hook()
  })

  describe('refund from preallocated slots', () => {
    it('gas cost with gas refund is smaller than calling without it', async () => {
      const noRefundGasUse = (await (await hookContract.hook()).wait()).gasUsed
      await token.sponsorGas(200, {
        gasLimit: 5000000,
      })
      const freeGasBefore = await token.remainingGasRefundPool()
      const refundGasUse = (await (await controller.connect(refunder).refundGasWithHook(hookContract.address)).wait()).gasUsed
      const freeGasAfter = await token.remainingGasRefundPool()
      expect(refundGasUse).to.be.lt(noRefundGasUse.mul(7).div(10))
      expect(freeGasAfter).to.be.lt(freeGasBefore)
    })

    it('does not consume more gas slots than available', async () => {
      await token.sponsorGas(10)
      await expect(controller.connect(refunder).refundGasWithHook(hookContract.address)).to.be.not.reverted
      expect(await token.remainingGasRefundPool()).to.equal(0)
    })

    it('cannot be called by non owner or gasRefund account', async () => {
      await expect(controller.connect(otherAccount).refundGasWithHook(hookContract.address)).to.be.revertedWith('must be gas refunder or owner')
    })
  })

  describe('refund by killing sheep', () => {
    it('refunds gas by calling selfdestruct', async () => {
      await token.sponsorGas2(100, {
        gasLimit: 6000000,
      })
      expect(await token.remainingSheepRefundPool()).to.equal(100)
      const noRefundGasUse = (await (await hookContract.hook()).wait()).gasUsed
      const refundGasUse = (await (await controller.refundGasWithHook(hookContract.address)).wait()).gasUsed
      expect(refundGasUse).to.be.lt(noRefundGasUse.mul(7).div(10))
      expect(await token.remainingSheepRefundPool()).to.be.lt(100)
    })

    it('works with empty pool', async () => {
      await expect(controller.connect(refunder).refundGasWithHook(hookContract.address)).to.be.not.reverted
    })
  })
})
