/**
 * PRIVATE_KEY={private_key} ts-node scripts/deploy_mock_governance.ts "{network}"
 */
import { ethers, providers } from 'ethers'

import {
  GovernorAlpha__factory,
  OwnedUpgradeabilityProxy__factory,
} from '../build'

async function deployMockGovernance () {
  const txnArgs = { gasLimit: 4_500_000, gasPrice: 1_000_000_000 }
  const provider = new providers.InfuraProvider(process.argv[2], 'e33335b99d78415b82f8b9bc5fdc44c0')
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider)

  const governanceImpl = await (await new GovernorAlpha__factory(wallet).deploy(txnArgs)).deployed()
  console.log(`Governance: ${governanceImpl.address}`)

  const governance = OwnedUpgradeabilityProxy__factory.connect('0x01cACF74540154B7c759657A73f74a578CFEA69b', wallet)

  await governance.upgradeTo(governanceImpl.address)
}

deployMockGovernance().catch(console.error)
