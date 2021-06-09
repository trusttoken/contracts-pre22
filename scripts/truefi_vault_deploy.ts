/**
 * PRIVATE_KEY={private_key} ts-node scripts/truefi_vault_deploy.ts "{network}"
 */
import { ethers, providers } from 'ethers'

import {
  OwnedUpgradeabilityProxy__factory,
  TrustToken__factory,
  TrueFiVault__factory,
} from '../build'

// inputs
const beneficiary = '0x58f5F0684C381fCFC203D77B2BbA468eBb29B098' // blocktower
const amount = '4210526315000000' // 42,105,263.15 TRU (8 Decimals)
const start = '1623211200' // 9:00PM PT
const txnArgs = { gasLimit: 1_000_000, gasPrice: 20_000_000_000 }

// mainnet
const truMainnet = '0x4c19596f5aaff459fa38b0f7ed92f11ae6543784'
const stkTruMainnet = '0x23696914ca9737466d8553a2d619948f548ee424'
const finalOwner = '0x16cEa306506c387713C70b9C1205fd5aC997E78E' // multisig

// ropsten
let truAddress = '0x12b2f909D9eA91C86DC7FBba272D8aBbcDDfd72C'
let stkTruAddress = '0xccf081F684b3481503080Ca4240F76d8381A7eF5'

const contractArgs = { gasLimit: 5_000_000, gasPrice: txnArgs.gasPrice }

async function deployTrueFiVault () {
  const network = process.argv[2]
  const provider = new providers.InfuraProvider(network, 'e33335b99d78415b82f8b9bc5fdc44c0')
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider)

  if (network === 'mainnet') {
    truAddress = truMainnet
    stkTruAddress = stkTruMainnet
  }

  // deploy
  const trueFiVaultImpl = await (await new TrueFiVault__factory(wallet).deploy(contractArgs)).deployed()
  console.log(`trueFiVaultImpl: ${trueFiVaultImpl.address}`)
  const vaultProxy = await (await new OwnedUpgradeabilityProxy__factory(wallet).deploy(txnArgs)).deployed()
  console.log(`vault: ${vaultProxy.address}`)
  await (await vaultProxy.upgradeTo(trueFiVaultImpl.address, txnArgs)).wait()
  console.log('Proxy upgrade: done')
  const tru = await TrustToken__factory.connect(truAddress, wallet)
  const vault = await TrueFiVault__factory.connect(vaultProxy.address, wallet)

  // initialize and transfer
  await (await tru.approve(vault.address, amount)).wait()
  console.log(`Approved: ${amount} TRU`)
  await (await vault.initialize(beneficiary, finalOwner, amount, start, truAddress, stkTruAddress, txnArgs)).wait()
  console.log(`Locked: ${amount} TRU`)
  if (network === 'mainnet') {
    await (await vaultProxy.transferProxyOwnership(finalOwner)).wait()
    console.log(`Transfereed Proxy Ownership to: ${finalOwner}`)
  }
}

deployTrueFiVault().catch(console.error)
