/**
 * PRIVATE_KEY={private_key} ts-node scripts/deploy_tru_price_oracle.ts "{network}"
 */
import { ethers, providers } from 'ethers'

import {
  TruPriceOracle__factory,
} from '../build'

async function deployTruPriceOracle () {
  const INFURA_ENDPOINT = 'ec659e9f6af4425c8a13aeb0af9f2809'
  const GAS_LIMIT = 3_500_000
  const GAS_PRICE = 1_000_000_000
  const txnArgs = { gasLimit: GAS_LIMIT, gasPrice: GAS_PRICE }
  const provider = new providers.InfuraProvider(process.argv[2], INFURA_ENDPOINT)
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider)

  const truPriceOracleImpl = await (await new TruPriceOracle__factory(wallet).deploy(txnArgs)).deployed()
  console.log(`TruPriceOracle: ${truPriceOracleImpl.address}`)
}

deployTruPriceOracle().catch(console.error)
