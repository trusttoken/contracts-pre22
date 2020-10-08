/**
 * Register SAFT accounts script
 *
 * ts-node scripts/register_saft_addresses.ts "network" "path to csv with addresses"
 */

import fs from 'fs'
import { utils, providers } from 'ethers'
import { Erc20Factory } from '../build/types/Erc20Factory'

export const doWork = async (provider: providers.InfuraProvider, addresses: string[]) => {
  const token = Erc20Factory.connect('0x0000000000085d4780b73119b644ae5ecd22b376', provider)
  for (const address of addresses) {
    const code = await provider.getCode(address)
    const isContract = code !== '' && code !== '0x'
    const balance = await token.balanceOf(address)
    console.log(address, isContract ? 'contract' : 'not contract', utils.formatEther(balance))
  }
}

if (require.main === module) {
  const provider = new providers.InfuraProvider(process.argv[2], '81447a33c1cd4eb09efb1e8c388fb28e')
  const addresses = fs.readFileSync('./addresses.csv').toString().split('\n').filter(s => s.length > 0)
  doWork(provider, addresses)
}
