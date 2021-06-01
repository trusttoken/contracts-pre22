/**
 * PRIVATE_KEY={private_key} ts-node scripts/truefi_vault_deploy.ts "{network}"
 */
import { ethers, providers } from 'ethers'

import {
  OwnedUpgradeabilityProxy__factory,
  TrueFiVault__factory,
} from 'contracts'

// inputs
const beneficiary = ''
const amount = '10000000000'
const txnArgs = { gasLimit: 1_000_000, gasPrice: 60_000_000_000 }

// mainnet
const truMainnet = '0x4c19596f5aaff459fa38b0f7ed92f11ae6543784'
const stkTruMainnet = '0x23696914ca9737466d8553a2d619948f548ee424'

// ropsten
let truAddress = ''
let stkTruAddress = ''

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
  const vault = await (await new OwnedUpgradeabilityProxy__factory(wallet).deploy(txnArgs)).deployed()
  console.log(`vault: ${vault.address}`)
  await (await vault.upgradeTo(trueFiVaultImpl.address, txnArgs)).wait()
  console.log('Proxy upgrade: done')

  // initialize and transfer TRU
  await (await TrueFiVault__factory.connect(vault.address, wallet)
    .initialize(beneficiary, truAddress, stkTruAddress, txnArgs)).wait()
  console.log(`Initialized for: ${beneficiary}`)
  await (await TrueFiVault__factory.connect(vault.address, wallet)
    .lock(amount, txnArgs)).wait()
  console.log(`Locked: ${amount} TRU`)
}

deployTrueFiVault().catch(console.error)
