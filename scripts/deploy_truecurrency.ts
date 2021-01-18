/**
 * ts-node scripts/deploy_truecurrency.ts "{private_key}" "{network}"
 */
// import { ethers, providers } from 'ethers'
// import { TrueAudFactory } from 'contracts/types/TrueAUDFactory'
// import { TrueCadFactory } from 'contracts/types/TrueCADFactory'
// import { TrueGbpFactory } from 'contracts/types/TrueGBPFactory'
// import { TrueHkdFactory } from 'contracts/types/TrueHKDFactory'
// import { TrueUsdFactory } from 'contracts/types/TrueUSDFactory'

// async function deployTrueCurrency () {
//   const txnArgs = { gasLimit: 2_500_000, gasPrice: 100_000_000_000 }
//   const provider = new providers.InfuraProvider(process.argv[3], '81447a33c1cd4eb09efb1e8c388fb28e')
//   const wallet = new ethers.Wallet(process.argv[2], provider)

// const taud = await (await new TrueAudFactory(wallet).deploy()).deployed()
// const tcad = await (await new TrueCadFactory(wallet).deploy()).deployed()
// const tgbp = await (await new TrueGbpFactory(wallet).deploy()).deployed()
// const thkd = await (await new TrueHkdFactory(wallet).deploy()).deployed()
// const tusd = await (await new TrueUsdFactory(wallet).deploy(txnArgs)).deployed()

// console.log('tusd address: ', tusd.address)
// console.log(tcad.address)
// console.log(tgbp.address)
// console.log(thkd.address)
// }

// deployTrueCurrency().catch(console.error)
