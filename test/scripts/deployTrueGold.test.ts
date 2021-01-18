import { MockProvider } from 'ethereum-waffle'
import { expect } from 'chai'

import { deployTrueGold } from 'scripts/deploy_true_gold'
import { makeAddress } from 'scripts/model/Address'
import { asProxy } from 'scripts/utils/asProxy'

import { toHex, MAX_BURN_BOUND } from 'utils'

import {
  TrueGold,
  TrueGoldController,
  TrueGoldFactory,
  TrueGoldControllerFactory,
  OwnedUpgradeabilityProxyJson,
  TrueGoldJson,
  TrueGoldControllerJson,
} from 'contracts'

describe('deployTrueGold', () => {
  const proxyBytecode = toHex(OwnedUpgradeabilityProxyJson.evm.deployedBytecode.object)
  const tokenBytecode = toHex(TrueGoldJson.evm.deployedBytecode.object)
  const controllerBytecode = toHex(TrueGoldControllerJson.evm.deployedBytecode.object)

  const provider = new MockProvider()
  const [deployer, controllerOwner, implContractsOwner] = provider.getWallets()

  const params = {
    controllerOwner: makeAddress(controllerOwner.address),
    implContractsOwner: makeAddress(implContractsOwner.address),
    initialBurnBounds: {
      min: 0,
      max: MAX_BURN_BOUND,
    },
  }

  let controller: TrueGoldController
  let token: TrueGold

  before(async () => {
    ({ controller, token } = await deployTrueGold(deployer, params))
  })

  it('deploys all contracts', async () => {
    expect(await provider.getCode(controller.address)).to.eq(proxyBytecode)
    expect(await provider.getCode(token.address)).to.eq(proxyBytecode)

    expect(await provider.getCode(await asProxy(controller).implementation())).to.eq(controllerBytecode)
    expect(await provider.getCode(await asProxy(token).implementation())).to.eq(tokenBytecode)
  })

  it('initializes token implementation contract', async () => {
    const tokenImplAddress = await asProxy(token).implementation()
    const tokenImpl = TrueGoldFactory.connect(tokenImplAddress, deployer)

    await expect(tokenImpl.initialize(0, 10)).to.be.revertedWith('Contract instance has already been initialized')
  })

  it('initializes controller implementation contract', async () => {
    const controllerImplAddress = await asProxy(controller).implementation()
    const controllerImpl = TrueGoldControllerFactory.connect(controllerImplAddress, deployer)

    await expect(controllerImpl.initialize()).to.be.revertedWith('already initialized')
  })

  it('sets token in controller', async () => {
    expect(await controller.token()).to.eq(token.address)
  })

  it('transfers token ownership to controller', async () => {
    expect(await token.owner()).to.eq(controller.address)
    expect(await asProxy(token).proxyOwner()).to.eq(controller.address)
  })

  it('transfers controller ownership to specified owner', async () => {
    expect(await controller.pendingOwner()).to.eq(controllerOwner.address)
    expect(await asProxy(controller).pendingProxyOwner()).to.eq(controllerOwner.address)
  })

  it('transfers token implementation contract ownership to specified owner', async () => {
    const tokenImplAddress = await asProxy(token).implementation()
    const tokenImpl = TrueGoldFactory.connect(tokenImplAddress, deployer)

    expect(await tokenImpl.owner()).to.eq(implContractsOwner.address)
  })

  it('transfers controller implementation contract ownership to specified owner', async () => {
    const controllerImplAddress = await asProxy(controller).implementation()
    const controllerImpl = TrueGoldControllerFactory.connect(controllerImplAddress, deployer)

    expect(await controllerImpl.pendingOwner()).to.eq(implContractsOwner.address)
  })
})
