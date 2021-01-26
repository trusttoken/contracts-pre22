/**
 * PRIVATE_KEY={private_key} ts-node scripts/deploy_tru.ts "{network}"
 */
import { ethers, providers } from 'ethers'

import {
  TrustTokenFactory,
} from '../build'

async function deployTru () {
  const txnArgs = { gasLimit: 3_500_000, gasPrice: 100_000_000_000 }
  const provider = new providers.InfuraProvider(process.argv[2], 'e33335b99d78415b82f8b9bc5fdc44c0')
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider)

  const trustTokenImpl = await (await new TrustTokenFactory(wallet).deploy(txnArgs)).deployed()
  console.log(`TrustToken: ${trustTokenImpl.address}`)
}

deployTru().catch(console.error)
