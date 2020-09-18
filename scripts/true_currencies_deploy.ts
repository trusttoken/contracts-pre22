/**
 * ts-node scripts/true_currencies_deploy.ts "{private_key}" "{network}"
 */
import { ethers, providers } from 'ethers'
import { TrueAudFactory } from '../build/types/TrueAudFactory'
import { TrueCadFactory } from '../build/types/TrueCadFactory'
import { TrueGbpFactory } from '../build/types/TrueGbpFactory'
import { TrueHkdFactory } from '../build/types/TrueHkdFactory'

async function deployTrueCurrencies () {
  const txnArgs = { gasLimit: 5_000_000, gasPrice: 52_000_000_000 }
  const provider = new providers.InfuraProvider(process.argv[3], '81447a33c1cd4eb09efb1e8c388fb28e')
  const wallet = new ethers.Wallet(process.argv[2], provider)

  const trueAud = await (await new TrueAudFactory(wallet).deploy(txnArgs)).deployed()
  console.log('TrueAud at: ', trueAud.address)

  const trueCad = await (await new TrueCadFactory(wallet).deploy(txnArgs)).deployed()
  console.log('TrueCad at: ', trueCad.address)

  const trueGbp = await (await new TrueGbpFactory(wallet).deploy(txnArgs)).deployed()
  console.log('TrueGbp at: ', trueGbp.address)

  const trueHkd = await (await new TrueHkdFactory(wallet).deploy(txnArgs)).deployed()
  console.log('TrueHkd at: ', trueHkd.address)
}

deployTrueCurrencies().catch(console.error)
