/**
 * Ethers Deploy Script
 *
 * ts-node scripts/deploy_liquidator_reset.ts "{private_key}" "{network}"
 *
 */

import { ethers } from 'ethers'
import { JsonRpcProvider } from 'ethers/providers'
import { LiquidatorRegistryResetFactory } from '../build/types/LiquidatorRegistryResetFactory'
import { setupDeploy, txnArgs, validatePrivateKey } from './utils'

async function deployLiquidator (accountPrivateKey: string, provider: JsonRpcProvider) {
  validatePrivateKey(accountPrivateKey)
  const wallet = new ethers.Wallet(accountPrivateKey, provider)
  const deploy = setupDeploy(wallet)
  const liquidatorResetImplementation = await deploy(LiquidatorRegistryResetFactory, txnArgs)
  console.log(`Deployed LiquidatorRegistryReset at: ${liquidatorResetImplementation.address}`)
}

if (require.main === module) {
  if (!['mainnet', 'kovan', 'ropsten', 'rinkeby'].includes(process.argv[3])) {
    throw new Error(`Unknown network: ${process.argv[3]}`)
  }

  const provider = new ethers.providers.InfuraProvider(process.argv[3], '81447a33c1cd4eb09efb1e8c388fb28e')
  deployLiquidator(process.argv[2], provider)
    .catch(console.error)
}
