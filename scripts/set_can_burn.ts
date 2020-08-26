/**
 * Set canBurn addresses script
 *
 * PRIVATE_KEY="private key" ts-node scripts/set_can_burn.ts "network" "path to file with separated by ','" "token controller address"
 */

import fs from 'fs'
import { providers, Wallet } from 'ethers'
import { TokenController } from '../build/types/TokenController'
import { TokenControllerFactory } from '../build/types/TokenControllerFactory'
import { TrueCurrencyFactory } from '../build/types/TrueCurrencyFactory'

export const txnArgs = { gasLimit: 2_000_000, gasPrice: 20_000_000_000 }

export const setCanBurn = async (wallet: Wallet, controller: TokenController, accounts: string[]) => {
  let nonce = await wallet.getTransactionCount()
  const token = TrueCurrencyFactory.connect(await controller.token(), wallet)
  const pendingTransactions = []
  for (const address of accounts) {
    if (await token.canBurn(address) === true) {
      console.log(`${address} canBurn is set to true, skipping`)
      continue
    }
    pendingTransactions.push((await controller.setCanBurn(address, true, { ...txnArgs, nonce: nonce + 1 })).wait()
      .then(() => console.log(`Done: ${address} can burn`))
      .catch((err) => console.error(`Failed for ${address}`, err)),
    )
    nonce++
  }
  await Promise.all(pendingTransactions)
}

export const parseAccounts = (text: string): string[] =>
  text
    .split(',')
    .filter((address) => address.length > 0)
    .map((address) => address.trim())

if (require.main === module) {
  const provider = new providers.InfuraProvider(process.argv[2], '81447a33c1cd4eb09efb1e8c388fb28e')
  const wallet = new Wallet(process.env.PRIVATE_KEY, provider)
  const controller = TokenControllerFactory.connect(process.argv[4], wallet)
  const addresses = parseAccounts(fs.readFileSync(process.argv[3]).toString())
  setCanBurn(wallet, controller, addresses).then(() => console.log('Done.'))
}
