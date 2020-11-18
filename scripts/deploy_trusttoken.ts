/* eslint-disable */
/**
 * ts-node scripts/deploy_trusttoken.ts "{private_key}" "{network}"
 */
import { ethers, providers } from 'ethers'
import { TrustTokenFactory } from '../build/types'
import { MockTrustTokenFactory } from '../build/types'

async function deploy() {
  // await deployTrustToken().catch(console.error)
  await deployMockTrustToken().catch(console.error)
}

async function deployTrustToken () {
  const txnArgs = { gasLimit: 4_500_000, gasPrice: 20_000_000_000 }
  const provider = new providers.InfuraProvider(process.argv[3], '81447a33c1cd4eb09efb1e8c388fb28e')
  const wallet = new ethers.Wallet(process.argv[2], provider)

  const tru = await (await new TrustTokenFactory(wallet).deploy(txnArgs)).deployed()
  console.log('tru address: ', tru.address)
}

async function deployMockTrustToken () {
  const txnArgs = { gasLimit: 4_500_000, gasPrice: 1_000_000_000 }
  const provider = new providers.InfuraProvider(process.argv[3], '81447a33c1cd4eb09efb1e8c388fb28e')
  const wallet = new ethers.Wallet(process.argv[2], provider)

  const tru = await (await new MockTrustTokenFactory(wallet).deploy(txnArgs)).deployed()
  console.log('tru address: ', tru.address)
}

deploy().catch(console.error)
