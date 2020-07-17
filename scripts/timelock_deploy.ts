/**
 * ts-node scripts/timelock_deploy.ts "{private_key}" "{network}"
 */
import { ethers, providers } from 'ethers'
import { TrustTokenFactory } from '../build/types/TrustTokenFactory'
import { TimeLockRegistryFactory } from '../build/types/TimeLockRegistryFactory'

async function deployPause () {
  const txnArgs = { gasLimit: 5_000_000, gasPrice: 16_000_000_000 }
  const provider = new providers.InfuraProvider(process.argv[3], 'e33335b99d78415b82f8b9bc5fdc44c0')
  const wallet = new ethers.Wallet(process.argv[2], provider)

  const trustTokenImpl = await (await new TrustTokenFactory(wallet).deploy(txnArgs)).deployed()
  console.log('TrustToken Impl at: ', trustTokenImpl.address)
  const timeLockRegistry = await (await new TimeLockRegistryFactory(wallet).deploy(trustTokenImpl.address, txnArgs)).deployed()
  console.log('TimeLockRegistry Impl at: ', timeLockRegistry.address)
}

deployPause().catch(console.error)
