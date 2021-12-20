import { contract, createProxy, deploy } from 'ethereum-mars'
import {
  AvalancheTrueUSD,
  AvalancheTokenController,
  OwnedUpgradeabilityProxy,
} from '../build/artifacts'

// Example usage:
//   $ ./marsDeploy.sh deploy/avalanche.ts --network https://api.avax.network/ext/bc/C/rpc --dry-run
//   PRIVATE_KEY=0x123..64

deploy({}, () => {
  const proxy = createProxy(OwnedUpgradeabilityProxy)
  const tusd = proxy(contract(AvalancheTrueUSD), 'initialize', [])
  const controller = proxy(contract(AvalancheTokenController), 'initialize', [])
  tusd.transferOwnership(controller)
  controller.issueClaimOwnership(tusd)
  controller.setToken(tusd)
})
