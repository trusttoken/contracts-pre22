/* eslint-disable */
/**
 * PRIVATE_KEY={private_key} ts-node scripts/deploy_truefi2.ts "{network}"
 */
import { ethers, providers } from 'ethers'
import { waitForTx } from './utils/waitForTx'

import {
  OwnedUpgradeabilityProxy__factory,
  TrueFiPool__factory,
  TrueFiPool2__factory,
  TrueLender2__factory,
  Liquidator2__factory,
  LoanFactory2__factory,
  StkTruToken__factory,
  TrueRatingAgencyV2__factory,
  ImplementationReference__factory,
  PoolFactory__factory,
} from '../build'

// const txnArgs = { gasLimit: 1_500_000, gasPrice: 1_600_000_000_000 }
const txnArgs = { gasLimit: 1_500_000, gasPrice: 190_000_000_000 }
const contractArgs = { gasLimit: 5_000_000, gasPrice: txnArgs.gasPrice }

async function deployTruefi () {
  const provider = new providers.InfuraProvider(process.argv[2], 'ec659e9f6af4425c8a13aeb0af9f2809')
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider)
  await deployImplementations(wallet)
  // await deployProxies(wallet)
  // await deployProxiesWithImpl(wallet)
  // await deployLoan__factory(wallet)
  // await deployDistributor(wallet)
  // await deployAddressBehindProxy(wallet, '', 'TruePriceOracle')
}

async function deployImplementations (wallet) {
  /*
  const TrueRatingAgencyV2Impl = await (await new TrueRatingAgencyV2__factory(wallet).deploy(contractArgs)).deployed()
  console.log(`TrueRatingAgency: ${TrueRatingAgencyV2Impl.address}`)
  
  const TrueLender2Impl = await (await new TrueLender2__factory(wallet).deploy(contractArgs)).deployed()
  console.log(`TrueLender2Impl: ${TrueLender2Impl.address}`)
  */
  const Liquidator2Impl = await (await new Liquidator2__factory(wallet).deploy(contractArgs)).deployed()
  console.log(`Liquidator2Impl: ${Liquidator2Impl.address}`)
  /*
  const TrueFiPool2Impl = await (await new TrueFiPool2__factory(wallet).deploy(contractArgs)).deployed()
  console.log(`TrueFiPool2Impl: ${TrueFiPool2Impl.address}`)
  
  const LoanFactory2Impl = await (await new LoanFactory2__factory(wallet).deploy(contractArgs)).deployed()
  console.log(`LoanFactory2Impl: ${LoanFactory2Impl.address}`)

  const StkTruTokenImpl = await (await new StkTruToken__factory(wallet).deploy(contractArgs)).deployed()
  console.log(`StkTruTokenImpl: ${StkTruTokenImpl.address}`)
  
  const PoolFactoryImpl = await (await new PoolFactory__factory(wallet).deploy(contractArgs)).deployed()
  console.log(`PoolFactoryImpl: ${PoolFactoryImpl.address}`)
  

  const TrueFiPoolImpl = await (await new TrueFiPool__factory(wallet).deploy(contractArgs)).deployed()
  console.log(`TrueFiPoolImpl: ${TrueFiPoolImpl.address}`)
  */
}

async function deployContractBehindProxy(wallet, contract, name) {
  const proxy = await (await new OwnedUpgradeabilityProxy__factory(wallet).deploy(txnArgs)).deployed()
  await proxy.upgradeTo(contract.address, txnArgs)
  console.log(`${name} proxy at: ${proxy.address}`)
}

async function deployProxiesWithImpl(wallet) {
  const contracts = [
      { name: 'TrueLender2Impl', address: '0x23ade98FA576AcBab49A67d2E6d4159B89eE26b9'},
      { name: 'Liquidator2Impl', address: '0x319Aa2D6e282AB389df85fD7494D913C855ae4bf'},
      { name: 'TrueFiPool2Impl', address: '0x01BD87bC97e27CB11e3c45dAB9B59Bc44edC4fc6'},
      { name: 'LoanFactory2Impl', address: '0xcF14AbAAff220dD6059B54e5ACF356f516189AB6'},
      { name: 'PoolFactoryImpl', address: '0x1F2891069A0d5a01bE558737e05b49611E82d7a3'},
  ]
  for (let i = 0; i < contracts.length; i++) {
    await deployAddressBehindProxy(wallet, contracts[i].address, contracts[i].name)
  }
}

async function deployAddressBehindProxy(wallet, address, name) {
  const proxy = await (await new OwnedUpgradeabilityProxy__factory(wallet).deploy(txnArgs)).deployed()
  await waitForTx(proxy.upgradeTo(address, txnArgs))
  console.log(`${name} proxy at: ${proxy.address}`)
}

deployTruefi().catch(console.error)
