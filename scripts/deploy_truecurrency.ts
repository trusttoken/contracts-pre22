/**
 * ts-node scripts/deploy_truecurrency.ts "{private_key}" "{network}"
 */
import { ethers, providers } from 'ethers'
// import { TrueAudFactory } from '../build/types/TrueAUDFactory'
// import { TrueCadFactory } from '../build/types/TrueCADFactory'
// import { TrueGbpFactory } from '../build/types/TrueGBPFactory'
// import { TrueHkdFactory } from '../build/types/TrueHKDFactory'
import { TrueUsdFactory } from '../build/types/TrueUSDFactory'

async function deployTrueCurrency () {
  const txnArgs = { gasLimit: 2_500_000, gasPrice: 100_000_000_000 }
  const provider = new providers.InfuraProvider(process.argv[3], '81447a33c1cd4eb09efb1e8c388fb28e')
  const wallet = new ethers.Wallet(process.argv[2], provider)

  // const taud = await (await new TrueAudFactory(wallet).deploy()).deployed()
  // const tcad = await (await new TrueCadFactory(wallet).deploy()).deployed()
  // const tgbp = await (await new TrueGbpFactory(wallet).deploy()).deployed()
  // const thkd = await (await new TrueHkdFactory(wallet).deploy()).deployed()
  const tusd = await (await new TrueUsdFactory(wallet).deploy(txnArgs)).deployed()

  console.log('tusd address: ', tusd.address)
  // console.log(tcad.address)
  // console.log(tgbp.address)
  // console.log(thkd.address)
}

deployTrueCurrency().catch(console.error)
