import { contract, createProxy, deploy } from 'ethereum-mars'
import {
  AvalancheTrueUSD,
  AvalancheTokenController,
  OwnedUpgradeabilityProxy,
} from '../build/artifacts'

deploy({}, () => {
  const proxy = createProxy(OwnedUpgradeabilityProxy)
  const tusd = proxy(contract(AvalancheTrueUSD), 'initialize', [])
  const controller = proxy(contract(AvalancheTokenController), 'initialize', [])
  tusd.transferOwnership(controller)
  controller.issueClaimOwnership(tusd)
  controller.setToken(tusd)
})
