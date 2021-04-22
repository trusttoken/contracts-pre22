/**
 * PRIVATE_KEY={private_key} ts-node scripts/deploy_true_lender_reclaimer.ts "{network}"
 */
import { ethers, providers } from 'ethers'

import {
  TrueLenderReclaimer__factory,
} from '../build'

async function deployTrueLenderReclaimer () {
  const TRUE_LENDER_ADDRESS = '0xb1f283F554995F666bD3238F229ADf0aF7d54fC4'
  const INFURA_ENDPOINT = 'ec659e9f6af4425c8a13aeb0af9f2809'
  const GAS_LIMIT = 3_500_000
  const GAS_PRICE = 1_000_000_000
  const txnArgs = { gasLimit: GAS_LIMIT, gasPrice: GAS_PRICE }
  const provider = new providers.InfuraProvider(process.argv[2], INFURA_ENDPOINT)
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider)

  const trueLenderReclaimerImpl = await (await new TrueLenderReclaimer__factory(wallet).deploy(TRUE_LENDER_ADDRESS, txnArgs)).deployed()
  console.log(`TrueLenderReclaimer: ${trueLenderReclaimerImpl.address}`)
}

deployTrueLenderReclaimer().catch(console.error)
