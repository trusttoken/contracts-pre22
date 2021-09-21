/**
 * PRIVATE_KEY={private_key} ts-node scripts/avalanche_rescue.ts
 */
import { ethers, providers } from 'ethers'

import {
  TokenController__factory,
  OwnedUpgradeabilityProxy__factory,
  TrueUsd__factory,
} from '../build'

// this script was used to transfer ownership of all avalanche TUSD to 0xf6E2Da7D82ee49f76CE652bc0BeB546Cbe0Ea521
// the previous key was used (in commented out lines) to transfer ownership
// ownership was claimed in commented out lines as well
// this script can verify the owner & pending owners of the TUSD controller & token
async function avalancheRescue () {
  const network = {
    chainId: 43114,
    name: 'ava-c-chain',
  }

  const provider = new providers.JsonRpcProvider('https://api.avax.network/ext/bc/C/rpc', network)
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider)

  const controller = TokenController__factory.connect('0xc3a247acE92A6A36FB69F70873A85fB8a66aDC1c', wallet)
  const proxy = OwnedUpgradeabilityProxy__factory.connect('0xc3a247acE92A6A36FB69F70873A85fB8a66aDC1c', wallet)
  const token = TrueUsd__factory.connect('0x1C20E891Bab6b1727d14Da358FAe2984Ed9B59EB', wallet)
  const tokenProxy = OwnedUpgradeabilityProxy__factory.connect('0x1C20E891Bab6b1727d14Da358FAe2984Ed9B59EB', wallet)
  // await(await controller.transferOwnership('0xf6E2Da7D82ee49f76CE652bc0BeB546Cbe0Ea521', txnArgs)).wait()
  // await (await proxy.transferProxyOwnership('0xf6E2Da7D82ee49f76CE652bc0BeB546Cbe0Ea521', txnArgs)).wait()
  // await(await controller.claimOwnership(txnArgs)).wait()
  // await(await proxy.claimProxyOwnership(txnArgs)).wait()
  // await (await tokenProxy.transferProxyOwnership('0xf6E2Da7D82ee49f76CE652bc0BeB546Cbe0Ea521', txnArgs)).wait()
  // await(await tokenProxy.claimProxyOwnership(txnArgs)).wait()
  // await(await controller.transferTrueCurrencyProxyOwnership('0xf6E2Da7D82ee49f76CE652bc0BeB546Cbe0Ea521', txnArgs)).wait()

  console.log('\ncontroller 0xc3a247acE92A6A36FB69F70873A85fB8a66aDC1c\n')
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
}

avalancheRescue().catch(console.error)
