import { Wallet } from 'ethers'
import { MockProvider } from 'ethereum-waffle'
import { expect } from 'chai'
import { MockHookFactory } from '../../build/types/MockHookFactory'
import { MockHook } from '../../build/types/MockHook'
import { TokenControllerMock } from '../../build/types/TokenControllerMock'
import { TokenControllerMockFactory } from '../../build/types/TokenControllerMockFactory'
import { setupDeploy } from '../../scripts/utils'
import { MockGasRefundTokenFactory } from '../../build/types/MockGasRefundTokenFactory'
import { MockGasRefundToken } from '../../build/types/MockGasRefundToken'
import { beforeEachWithFixture } from '../utils/beforeEachWithFixture'

describe('TrueCurrency - ERC20 behaviour', () => {
  let deployer: Wallet
  let token: MockGasRefundToken
  let hookContract: MockHook
  let controller: TokenControllerMock

  beforeEachWithFixture(async (provider: MockProvider, wallets: Wallet[]) => {
    [deployer] = wallets
    const deployContract = setupDeploy(deployer)
    token = await deployContract(MockGasRefundTokenFactory)
    await token.initialize()
    hookContract = await deployContract(MockHookFactory)
    controller = await deployContract(TokenControllerMockFactory)
    await controller.initialize()
    await controller.setToken(token.address)
    await token.transferOwnership(controller.address)
    await controller.issueClaimOwnership(token.address)
  })

  it('gas cost with gas refund is smaller than calling without it', async () => {
    // first call may skew gas usage a little
    await hookContract.hook()
    const noRefundGasUse = (await (await hookContract.hook()).wait()).gasUsed
    await token.sponsorGas(200, {
      gasLimit: 5000000,
    })
    const freeGasBefore = await token.remainingGasRefundPool()
    const refundGasUse = (await (await controller.refundGasWithHook(hookContract.address)).wait()).gasUsed
    const freeGasAfter = await token.remainingGasRefundPool()
    expect(refundGasUse).to.be.lt(noRefundGasUse.mul(7).div(10))
    expect(freeGasAfter).to.be.lt(freeGasBefore)
  })

  it('does not consume more gas slots than available', async () => {
    await token.sponsorGas(10)
    await expect(controller.refundGasWithHook(hookContract.address)).to.be.not.reverted
    expect(await token.remainingGasRefundPool()).to.equal(0)
  })
})
