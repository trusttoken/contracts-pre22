/**
 * ts-node scripts/pause_contract_deploy.ts "{private_key}" "{network}"
 */
import { ethers, providers } from 'ethers'
import { PausedTrueUsdFactory } from '../build/types/PausedTrueUsdFactory'

async function deployPause () {
  const txnArgs = { gasLimit: 5_000_000, gasPrice: 16_000_000_000 }
  const provider = new providers.InfuraProvider(process.argv[3], '81447a33c1cd4eb09efb1e8c388fb28e')
  const wallet = new ethers.Wallet(process.argv[2], provider)

  const pausedTokenContract = await (await new PausedTrueUsdFactory(wallet).deploy(txnArgs)).deployed()
  console.log('PausedToken at: ', pausedTokenContract.address)
}

deployPause().catch(console.error)
