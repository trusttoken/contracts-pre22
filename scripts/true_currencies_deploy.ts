/**
 * ts-node scripts/true_currencies_deploy.ts "{private_key}" "{network}"
 */
import { ethers, providers } from 'ethers'

import {
  TrueAudFactory,
  TrueCadFactory,
  TrueGbpFactory,
  TrueHkdFactory,
  TrueUsdFactory,
} from 'contracts'

async function deployTrueCurrencies () {
  const txnArgs = { gasLimit: 5_000_000, gasPrice: 150_000_000_000 }
  const provider = new providers.InfuraProvider(process.argv[3], '81447a33c1cd4eb09efb1e8c388fb28e')
  const wallet = new ethers.Wallet(process.argv[2], provider)

  await deployTrueUSD(provider, wallet, txnArgs)
  await deployTrueAUD(provider, wallet, txnArgs)
  await deployTrueCAD(provider, wallet, txnArgs)
  await deployTrueGBP(provider, wallet, txnArgs)
  await deployTrueHKD(provider, wallet, txnArgs)
}

async function deployTrueUSD (provider, wallet, txnArgs) {
  const trueUsd = await (await new TrueUsdFactory(wallet).deploy(txnArgs)).deployed()
  console.log('TrueUSD at: ', trueUsd.address)
  return trueUsd
}

async function deployTrueAUD (provider, wallet, txnArgs) {
  const trueAud = await (await new TrueAudFactory(wallet).deploy(txnArgs)).deployed()
  console.log('TrueAud at: ', trueAud.address)
  return trueAud
}

async function deployTrueCAD (provider, wallet, txnArgs) {
  const trueCad = await (await new TrueCadFactory(wallet).deploy(txnArgs)).deployed()
  console.log('TrueCad at: ', trueCad.address)
  return trueCad
}

async function deployTrueGBP (provider, wallet, txnArgs) {
  const trueGbp = await (await new TrueGbpFactory(wallet).deploy(txnArgs)).deployed()
  console.log('TrueGbp at: ', trueGbp.address)
  return trueGbp
}

async function deployTrueHKD (provider, wallet, txnArgs) {
  const trueHkd = await (await new TrueHkdFactory(wallet).deploy(txnArgs)).deployed()
  console.log('TrueHkd at: ', trueHkd.address)
  return trueHkd
}

deployTrueCurrencies().catch(console.error)
