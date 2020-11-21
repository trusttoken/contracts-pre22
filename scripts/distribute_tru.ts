/* eslint-disable */
/**
 * ts-node scripts/distribute_tru.ts "{private_key}" "{network}" "{path_to_csv}"
*/

import { BigNumberish } from 'ethers'
import { parseUnits } from '@ethersproject/units'
import { BigNumber, constants, providers, Wallet } from 'ethers'
import { ask } from './utils'
import fs from 'fs'

import { TrustTokenFactory, TrustToken } from '../build/types'

const txnArgs = { gasLimit: 200_000, gasPrice: 90_000_000_000 }

export interface Account {
  address: string,
  amount: string,
}

export const wait = async <T>(tx: Promise<{wait: () => Promise<T>}>): Promise<T> => (await tx).wait()

export const preciseTrustToken = (amount: BigNumberish) => parseUnits(amount.toString(), 6)

async function deploy() {
  
  const network = process.argv[3]
  const provider = new providers.InfuraProvider(network, '81447a33c1cd4eb09efb1e8c388fb28e')
  const wallet = new Wallet(process.argv[2], provider)
  const path = process.argv[4]
  console.log(path)

  let truAddress = '0x4C19596f5aAfF459fA38B0f7eD92F11AE6543784'

  if (network == 'ropsten') {
    truAddress = '0x12b2f909D9eA91C86DC7FBba272D8aBbcDDfd72C'
  }

  const tru = await TrustTokenFactory.connect(truAddress, wallet)

  let balance = await tru.balanceOf(wallet.address)

  console.log('tru address: ', tru.address)
  console.log('your address: ', wallet.address)
  console.log('your balance: ', balance.toString(), 'TRU')

  // const accounts = readAccountList(path)
  const accounts = dictAccountList

  for (let i = 0; i < accounts.length; i++) {
    await sendTru(wallet, provider, tru, accounts[i]).catch(console.error)
  }
  console.log('\nsuccessfully transferred TRU')
}

const formatTrustToken = (amount: string) => {
  let front = amount.substring(0, amount.length-2)
  let end = amount.substring(amount.length - 2, amount.length);
  return front + '.' + end
}

async function sendTru(wallet, provider, tru: TrustToken, account: Account) {
  const { address, amount } = account
  let truAmount = preciseTrustToken(amount)
  console.log('\naddress:', address, '\namount:', formatTrustToken(amount))
  await ask('press any key to transfer...')
  let txn = await wait(tru.transfer(address, truAmount, txnArgs))
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

const toAddress= (address: string, amount: string): Account => {return { address: address, amount: amount} }

// 2 digits
// 100 = 1 TRU
const dictAccountList: Account[] = [
    toAddress('0x5bE769783bBF5c74410288D334D526687B29F2F6', '100'),
    toAddress('0xf6E2Da7D82ee49f76CE652bc0BeB546Cbe0Ea521', '100'),
    toAddress('0x03bD39a306DfE74937033d50eB278623D8b60804', '100')
]

deploy().catch(console.error)
