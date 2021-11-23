/**
 * PRIVATE_KEY={private_key} ts-node scripts/avalanche_script.ts
 */
import { ethers, providers, Contract } from 'ethers'
import { waitForTx } from './utils/waitForTx'
import { deployContract } from './utils/deployContract'

import {
  AvalancheTokenController__factory,
  OwnedUpgradeabilityProxy__factory,
  TrueUsd__factory,
} from '../build'

const txnArgs = { gasPrice: 100_000_000_000, gasLimit: 1_000_000 }
const contractArgs = { gasPrice: 100_000_000_000, gasLimit: 6_000_000 }

// this script was  originally used to transfer ownership of all avalanche TUSD to 0xf6E2Da7D82ee49f76CE652bc0BeB546Cbe0Ea521
// this script can verify the owner & pending owners of the TUSD controller & token
async function avalanche () {
  const network = {
    chainId: 43114,
    name: 'ava-c-chain',
  }

  const provider = new providers.JsonRpcProvider('https://api.avax.network/ext/bc/C/rpc', network)
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider)

  let controller = AvalancheTokenController__factory.connect('0xc3a247acE92A6A36FB69F70873A85fB8a66aDC1c', wallet)
  const proxy = OwnedUpgradeabilityProxy__factory.connect('0xc3a247acE92A6A36FB69F70873A85fB8a66aDC1c', wallet)
  const token = TrueUsd__factory.connect('0x1C20E891Bab6b1727d14Da358FAe2984Ed9B59EB', wallet)
  const tokenProxy = OwnedUpgradeabilityProxy__factory.connect('0x1C20E891Bab6b1727d14Da358FAe2984Ed9B59EB', wallet)

  // deploy, upgrade, set ratifiers
  // controller = await deployController(wallet)
  // await upgradeController(proxy, controller.address)
  // await setIsMintRatifier('0x083B59F244f8BAcbc79282Cdd623686324C962AC', 1, controller)
  // await setIsMintRatifier('0xb47DeA8731Fd846065294771Ab68B3Ee1FC6E880', 1, controller)

  await logData(controller, proxy, token, tokenProxy)

}

// refill ratified mint pool
async function refillRatifiedMintPool(controller) {
  await waitForTx(controller.refillRatifiedMintPool())
  console.log("ratified mint pool refilled")
}

// deploy new token controller
async function deployController(wallet) {
  const controllerImpl = await (await new AvalancheTokenController__factory(wallet).deploy(contractArgs)).deployed()
  console.log("new controller at: ", controllerImpl.address)
  return controllerImpl
}

// upgrade proxy
async function upgradeController(proxy, newImplementation) {
  await waitForTx(proxy.upgradeTo(newImplementation))
  console.log('upgraded proxy to: ', newImplementation.address)
}

// set mint ratifier status
async function setIsMintRatifier(account, status, controller) {
  await waitForTx(controller.setIsMintRatifier(account, status, txnArgs))
  console.log('\nset ratifier ', account, " to status: ", status)
}

// transfer all ownership to a new account
async function transferAllOwnership (account, controller, proxy, tokenProxy) {
  await waitForTx(controller.transferOwnership(account, txnArgs))
  await waitForTx(proxy.transferProxyOwnership(account, txnArgs))
  await waitForTx(tokenProxy.transferProxyOwnership(account, txnArgs))
  await waitForTx(controller.transferTrueCurrencyProxyOwnership(account, txnArgs))
}

async function logData (controller, proxy, token, tokenProxy) {
  console.log('\nlogging information about Avalanche TUSD...')

  console.log('\ncontroller 0xc3a247acE92A6A36FB69F70873A85fB8a66aDC1c\n')
  console.log('registryAdmin', await controller.registryAdmin())
  console.log('mintKey', await controller.mintKey())
  console.log('owner', await controller.owner())
  console.log('pendingOwner', await controller.pendingOwner())
  console.log('proxyOwner', await proxy.proxyOwner())
  console.log('pendingProxyOwner', await proxy.pendingProxyOwner())

  console.log('\ntoken 0x1C20E891Bab6b1727d14Da358FAe2984Ed9B59EB\n')
  console.log('owner', await token.owner())
  console.log('pendingOwner', await token.pendingOwner())
  console.log('proxyOwner', await tokenProxy.proxyOwner())
  console.log('pendingProxyOwner', await tokenProxy.pendingProxyOwner())
  console.log('\n')

  console.log('mint configuration\n')
  console.log('instantMintThreshold', (await controller.instantMintThreshold()).toString())
  console.log('ratifiedMintThreshold', (await controller.ratifiedMintThreshold()).toString())
  console.log('multiSigMintThreshold', (await controller.multiSigMintThreshold()).toString())
  console.log('\n')

  console.log('instantMintLimit', (await controller.instantMintLimit()).toString())
  console.log('ratifiedMintLimit', (await controller.ratifiedMintLimit()).toString())
  console.log('multiSigMintLimit', (await controller.multiSigMintLimit()).toString())
  console.log('\n')

  console.log('instantMintPool', (await controller.instantMintPool()).toString())
  console.log('ratifiedMintPool', (await controller.ratifiedMintPool()).toString())
  console.log('multiSigMintPool', (await controller.multiSigMintPool()).toString())
  console.log('\n')
}

avalanche().catch(console.error)
