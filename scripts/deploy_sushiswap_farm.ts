/**
 * PRIVATE_KEY={private_key} ts-node scripts/deploy_sushiswap_farm.ts "{network}"
 */
import { ethers, providers } from 'ethers'
import { waitForTx } from './utils/waitForTx'

import {
  SushiTimelock__factory,
  TruSushiswapRewarder__factory,
  OwnedUpgradeabilityProxy__factory,
} from '../build'

async function deploySushiswapFarm () {
  const txnArgs = { gasLimit: 3_500_000, gasPrice: 100_000_000_000 }
  const provider = new providers.InfuraProvider(process.argv[2], 'e33335b99d78415b82f8b9bc5fdc44c0')
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider)

  const ownerAddress = '0x16cEa306506c387713C70b9C1205fd5aC997E78E'
  const rewardMultiplier = 100
  const masterChefAddress = '0xc2EdaD668740f1aA35E4D8f227fB8E17dcA888Cd'
  const truAddress = '0x4c19596f5aaff459fa38b0f7ed92f11ae6543784'

  const sushiFarmImpl = await (await new TruSushiswapRewarder__factory(wallet).deploy(txnArgs)).deployed()
  console.log(`sushiFarmImpl: ${sushiFarmImpl.address}`)

  const sushiFarm = await (await new OwnedUpgradeabilityProxy__factory(wallet).deploy(txnArgs)).deployed()
  console.log(`sushiFarm: ${sushiFarm.address}`)

  const timelock = await (await new SushiTimelock__factory(wallet).deploy(ownerAddress, 172800, txnArgs)).deployed()
  console.log(`timelock: ${timelock.address}`)

  await waitForTx(sushiFarm.upgradeTo(sushiFarmImpl.address))
  await waitForTx(sushiFarm.initialize(rewardMultiplier, truAddress, masterChefAddress))
  await waitForTx(sushiFarm.transferOwnership(ownerAddress))
  await waitForTx(sushiFarm.transferProxyOwnership(ownerAddress))
}

deploySushiswapFarm().catch(console.error)
