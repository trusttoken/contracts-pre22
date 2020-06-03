/**
 * ts-node scripts/multisig_deploy.ts "{private_key}" "{network}"
 */
import { ethers, providers } from 'ethers'
import { PausedDelegateERC20Factory } from '../build/types/PausedDelegateERC20Factory'

async function deployPause () {
  const provider = new providers.InfuraProvider(process.argv[3], '81447a33c1cd4eb09efb1e8c388fb28e')
  const wallet = new ethers.Wallet(process.argv[2], provider)

  const pausedTokenContract = await (await new PausedDelegateERC20Factory(wallet).deploy()).deployed()
  console.log("PausedToken at: ", pausedTokenContract.address)
}

deployPause().catch(console.error)
