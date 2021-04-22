/* eslint-disable max-len */
import { BigNumber, BigNumberish, providers, Wallet } from 'ethers'

import { Address, makeAddress } from 'scripts/model/Address'
import { deployContract } from 'scripts/utils/deployContract'
import { waitForTx } from 'scripts/utils/waitForTx'
import { asProxy } from 'scripts/utils/asProxy'

import {
  TrueGold__factory,
  OwnedUpgradeabilityProxy__factory,
  TrueGoldController__factory,
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

// TODO change
const MIN_MINT_BOUND = 0
const MAX_MINT_BOUND = BigNumber.from(12_441_000).mul(1e8)

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
  const controllerImpl = await deployContract(deployer, TrueGoldController__factory)
  await waitForTx(controllerImpl.initialize()) // controllerImpl.owner = deployer

  const proxy = await deployContract(deployer, OwnedUpgradeabilityProxy__factory) // controller.proxyOwner = deployer
  await waitForTx(proxy.upgradeTo(controllerImpl.address))

  const controller = TrueGoldController__factory.connect(proxy.address, deployer)
  await waitForTx(controller.initialize()) // controller.owner = deployer

  console.log(`Controller address: ${proxy.address}`)
  return { controller, controllerImpl }
}

async function deployTokenBehindProxy (deployer: Wallet, burnBounds: DeploymentParams['initialBurnBounds']) {
  const tokenImpl = await deployContract(deployer, TrueGold__factory)
  await waitForTx(tokenImpl.initialize(0, 0)) // tokenImpl._owner = deployer

  const proxy = await deployContract(deployer, OwnedUpgradeabilityProxy__factory) // token.proxyOwner = deployer
  await waitForTx(proxy.upgradeTo(tokenImpl.address))

  const token = TrueGold__factory.connect(proxy.address, deployer)
  await waitForTx(token.initialize(burnBounds.min, burnBounds.max)) // token._owner = deployer

  console.log(`TrueGold address: ${proxy.address}`)
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

if (require.main === module) {
  const provider = new providers.InfuraProvider('ropsten', '81447a33c1cd4eb09efb1e8c388fb28e')
  const wallet = new Wallet(process.env.PRIVATE_KEY, provider)
  const owner = makeAddress(process.env.OWNER || wallet.address)
  deployTrueGold(wallet, {
    controllerOwner: owner,
    implContractsOwner: owner,
    initialBurnBounds: {
      min: MIN_MINT_BOUND,
      max: MAX_MINT_BOUND,
    },
  })
}
