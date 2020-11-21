/* eslint-disable */
/**
 * ts-node scripts/distribute_tru.ts "{private_key}" "{network}" "{path_to_csv}"
 */

import fs from 'fs'
import { BigNumber, constants, providers, Wallet } from 'ethers'
import { toTrustToken, ask } from './utils'

import { TrustTokenFactory, TrustToken } from '../build/types'

export interface Account {
  address: string,
  amount: string,
}

export const wait = async <T>(tx: Promise<{wait: () => Promise<T>}>): Promise<T> => (await tx).wait()

async function deploy() {
  const txnArgs = { gasLimit: 500_000, gasPrice: 40_000_000_000 }
  const provider = new providers.InfuraProvider(process.argv[3], '81447a33c1cd4eb09efb1e8c388fb28e')
  const wallet = new Wallet(process.argv[2], provider)
  const path = process.argv[4]

  const truAddress = '0x4C19596f5aAfF459fA38B0f7eD92F11AE6543784'
  const tru = await TrustTokenFactory.connect(truAddress, wallet)

  let balance = await tru.balanceOf(wallet.address)

  console.log('your address: ', tru.address)
  console.log('your balance: ', balance.toString(), 'TRU')

  const accounts = readAccountList(path)

  for (let i = 0; i < accounts.length; i++) {
    await sendTru(wallet, provider, tru, accounts[i]).catch(console.error)
  }
  console.log('\nsuccessfully transferred TRU')
}

async function sendTru(wallet, provider, tru: TrustToken, account: Account) {
  const { address, amount } = account
  let truAmount = toTrustToken(amount)
  console.log('address:', address, 'amount', amount)
  await ask('press any key to transfer...')
  let txn = await wait(tru.transfer(address, truAmount))
  console.log('success: ', txn.transactionHash)
}

export const parseAccountList = (text: string): Account[] =>
  text
    .split('\n')
    .filter((line) => line.split(',').length > 1)
    .map((line) => ({
      address: line.split(',')[0].trim(),
      amount: line.split(',')[1].trim(),
    }))

const readAccountList = (filePath: string) => parseAccountList(fs.readFileSync(filePath).toString())

deploy().catch(console.error)
