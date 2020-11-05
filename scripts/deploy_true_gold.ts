/* eslint-disable max-len */
import { BigNumberish, Wallet } from 'ethers'

import { Address } from 'scripts/model/Address'
import { deployContract } from 'scripts/utils/deployContract'
import { waitForTx } from 'scripts/utils/waitForTx'
import { asProxy } from 'scripts/utils/asProxy'

import {
  TrueGoldFactory,
  OwnedUpgradeabilityProxyFactory,
  TrueGoldControllerFactory,
  TrueGoldController,
  TrueGold,
} from 'contracts'

interface DeploymentParams {
  controllerOwner: Address,
  implContractsOwner: Address,
  initialBurnBounds: {
    min: BigNumberish,
    max: BigNumberish,
  },
}

interface DeploymentResult {
  controller: TrueGoldController,
  token: TrueGold,
}

export async function deployTrueGold (deployer: Wallet, params: DeploymentParams): Promise<DeploymentResult> {
  const { token, tokenImpl } = await deployTokenBehindProxy(deployer, params.initialBurnBounds)
  const { controller, controllerImpl } = await deployControllerBehindProxy(deployer)
  await waitForTx(controller.setToken(token.address))

  await transferImplContractsOwnership(tokenImpl, controllerImpl, params.implContractsOwner)
  await transferTokenOwnership(token, controller)
  await transferControllerOwnership(controller, params.controllerOwner)

  return { controller, token }
}

async function deployControllerBehindProxy (deployer: Wallet) {
  const controllerImpl = await deployContract(deployer, TrueGoldControllerFactory)
  await waitForTx(controllerImpl.initialize()) // controllerImpl.owner = deployer

  const proxy = await deployContract(deployer, OwnedUpgradeabilityProxyFactory) // controller.proxyOwner = deployer
  await waitForTx(proxy.upgradeTo(controllerImpl.address))

  const controller = TrueGoldControllerFactory.connect(proxy.address, deployer)
  await waitForTx(controller.initialize()) // controller.owner = deployer

  return { controller, controllerImpl }
}

async function deployTokenBehindProxy (deployer: Wallet, burnBounds: DeploymentParams['initialBurnBounds']) {
  const tokenImpl = await deployContract(deployer, TrueGoldFactory)
  await waitForTx(tokenImpl.initialize(0, 0)) // tokenImpl._owner = deployer

  const proxy = await deployContract(deployer, OwnedUpgradeabilityProxyFactory) // token.proxyOwner = deployer
  await waitForTx(proxy.upgradeTo(tokenImpl.address))

  const token = TrueGoldFactory.connect(proxy.address, deployer)
  await waitForTx(token.initialize(burnBounds.min, burnBounds.max)) // token._owner = deployer

  return { token, tokenImpl }
}

async function transferImplContractsOwnership (tokenImpl: TrueGold, controllerImpl: TrueGoldController, implContractsOwner: Address) {
  await waitForTx(tokenImpl.transferOwnership(implContractsOwner)) // tokenImpl._owner = implContractsOwner
  await waitForTx(controllerImpl.transferOwnership(implContractsOwner)) // controllerImpl.pendingOwner = implContractsOwner
}

async function transferTokenOwnership (token: TrueGold, controller: TrueGoldController) {
  await waitForTx(token.transferOwnership(controller.address)) // token._owner = controller
  await waitForTx(asProxy(token).transferProxyOwnership(controller.address)) // token.pendingProxyOwner = controller
  await waitForTx(controller.claimTokenProxyOwnership()) // token.pendingProxyOwner = address(0), token.proxyOwner = controller
}

async function transferControllerOwnership (controller: TrueGoldController, controllerOwner: Address) {
  await waitForTx(controller.transferOwnership(controllerOwner)) // controller.pendingOwner = controllerOwner
  await waitForTx(asProxy(controller).transferProxyOwnership(controllerOwner)) // controller.pendingProxyOwner = controllerOwner
}
