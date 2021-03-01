/**
 * PRIVATE_KEY='' ts-node scripts/deploy_oracle.ts "ropsten"
 */
import { ethers, providers } from 'ethers'

import {
  TruPriceOracleFactory,
} from '../build'

async function deployTru () {
  const txnArgs = { gasLimit: 3_500_000, gasPrice: 200_000_000_000 }
  const provider = new providers.InfuraProvider(process.argv[2], 'e33335b99d78415b82f8b9bc5fdc44c0')
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider)

  const trustTokenImpl = await (await new TruPriceOracleFactory(wallet).deploy(txnArgs)).deployed()
  console.log(`Oracle contract: ${trustTokenImpl.address}`)
}

deployTru().catch(console.error)
