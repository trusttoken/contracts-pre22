/**
 * Register SAFT accounts script
 *
 * ts-node scripts/register_saft_addresses.ts "network" "path to csv with addresses"
 */

import fs from 'fs'
import { BigNumber, constants, providers, Wallet } from 'ethers'

import { toTrustToken } from './utils'

import {
  TimeLockRegistry,
  TimeLockRegistryFactory,
  TrustToken,
  TrustTokenFactory,
} from 'contracts'

export const txnArgs = { gasLimit: 2_000_000, gasPrice: 20_000_000_000 }

export interface SaftAccount {
  address: string,
  amount: string,
}

const sum = (numbers: BigNumber[]) => numbers.reduce((a, b) => a.add(b), constants.Zero)

export const registerSaftAccounts = async (registry: TimeLockRegistry, trustToken: TrustToken, accounts: SaftAccount[]) => {
  const totalAllowance = sum(accounts.map(({ amount }) => toTrustToken(amount)))
  const tx = await trustToken.approve(registry.address, totalAllowance, txnArgs)
  await tx.wait()
  console.log('Transfers approved')
  let { nonce } = tx
  const pendingTransactions = []
  for (const { address, amount } of accounts) {
    pendingTransactions.push((await registry.register(address, toTrustToken(amount), { ...txnArgs, nonce: nonce + 1 })).wait()
      .then(() => console.log(`Done: ${address} for ${amount} TRU`))
      .catch((err) => console.error(`Failed for ${address}`, err)),
    )
    nonce++
  }
  await Promise.all(pendingTransactions)
}

export const parseAccountList = (text: string): SaftAccount[] =>
  text
    .split('\n')
    .filter((line) => line.split(',').length > 1)
    .map((line) => ({
      address: line.split(',')[0].trim(),
      amount: line.split(',')[1].trim(),
    }))

const readAccountList = (filePath: string) => parseAccountList(fs.readFileSync(filePath).toString())

if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const deployedAddresses = require(`./deploy/${process.argv[2]}.json`)
  const provider = new providers.InfuraProvider(process.argv[2], '81447a33c1cd4eb09efb1e8c388fb28e')
  const wallet = new Wallet(process.env.PRIVATE_KEY, provider)
  const registry = TimeLockRegistryFactory.connect(deployedAddresses.timeLockRegistry, wallet)
  const trustToken = TrustTokenFactory.connect(deployedAddresses.trustToken, wallet)
  registerSaftAccounts(registry, trustToken, readAccountList(process.argv[3])).then(() => console.log('Done.'))
}
