/**
 * PRIVATE_KEY={private_key} ts-node scripts/timelock_deploy.ts "{network}"
 */
import { ethers, providers } from 'ethers'

import {
  TrustTokenFactory,
  TimeLockRegistryFactory,
  OwnedUpgradeabilityProxyFactory,
} from 'contracts'

async function deployTimeLockRegistry () {
  const txnArgs = { gasLimit: 5_000_000, gasPrice: 16_000_000_000 }
  const provider = new providers.InfuraProvider(process.argv[2], 'e33335b99d78415b82f8b9bc5fdc44c0')
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider)

  const trustTokenImpl = await (await new TrustTokenFactory(wallet).deploy(txnArgs)).deployed()
  console.log(`TrustToken Impl at: ${trustTokenImpl.address}`)
  const timeLockRegistry = await (await new TimeLockRegistryFactory(wallet).deploy(txnArgs)).deployed()
  console.log(`TimeLockRegistry Impl at: ${timeLockRegistry.address}`)
  const proxy = await (await new OwnedUpgradeabilityProxyFactory(wallet).deploy(txnArgs)).deployed()
  console.log(`Proxy at: ${proxy.address}`)
  await (await proxy.upgradeTo(timeLockRegistry.address, txnArgs)).wait()
  console.log('Proxy upgrade: done')
  await (await TimeLockRegistryFactory.connect(proxy.address, wallet).initialize(trustTokenImpl.address, txnArgs)).wait()
  console.log('Registry initialization: done')
}

deployTimeLockRegistry().catch(console.error)
