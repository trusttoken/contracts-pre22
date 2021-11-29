/**
 * PRIVATE_KEY={private_key} ts-node scripts/timelock_deploy.ts "{network}"
 */
import { ethers, providers } from 'ethers'

import {
  CurveYearnStrategy__factory,
} from '../build'

async function strategyDeploy () {
  const txnArgs = { gasLimit: 5_000_000, gasPrice: 120_000_000_000 }
  const provider = new providers.InfuraProvider(process.argv[2], 'e33335b99d78415b82f8b9bc5fdc44c0')
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider)

  const strategyImpl = await (await new CurveYearnStrategy__factory(wallet).deploy(txnArgs)).deployed()
  console.log(`Strategy Impl at: ${strategyImpl.address}`)
}

strategyDeploy().catch(console.error)
