/**
 * PRIVATE_KEY={private_key} ts-node scripts/deploy_mock_governance.ts "{network}"
 */
import { ethers, providers } from 'ethers'

import {
  TestTrustTokenFactory,
  MockTimeLockFactory,
  GovernorAlphaFactory,
  OwnedUpgradeabilityProxyFactory,
} from '../build'

async function deployMockGovernance () {
  const txnArgs = { gasLimit: 4_500_000, gasPrice: 1_000_000_000 }
  const provider = new providers.InfuraProvider(process.argv[2], 'e33335b99d78415b82f8b9bc5fdc44c0')
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider)

  const trustTokenImpl = await (await new TestTrustTokenFactory(wallet).deploy(txnArgs)).deployed()
  console.log(`TRU: ${trustTokenImpl.address}`)

  const timelockImpl = await (await new MockTimeLockFactory(wallet).deploy(txnArgs)).deployed()
  console.log(`Timelock: ${timelockImpl.address}`)

  const governanceImpl = await (await new GovernorAlphaFactory(wallet).deploy(txnArgs)).deployed()
  console.log(`Governance: ${governanceImpl.address}`)

  const tru = OwnedUpgradeabilityProxyFactory.connect('0x12b2f909d9ea91c86dc7fbba272d8abbcddfd72c', wallet)
  const timelock = OwnedUpgradeabilityProxyFactory.connect('0x418Daf88CCfe083324f8c91e6FE8da3e86d9a182', wallet)
  const governance = OwnedUpgradeabilityProxyFactory.connect('0x01cACF74540154B7c759657A73f74a578CFEA69b', wallet)

  await tru.upgradeTo(trustTokenImpl.address)
  await timelock.upgradeTo('0x2eF8FF8D4cd628948891e37f3AAc3d76bF14E4a0')
  await governance.upgradeTo(governanceImpl.address)
}

deployMockGovernance().catch(console.error)
