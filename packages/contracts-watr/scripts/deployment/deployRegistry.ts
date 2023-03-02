import { contract, createProxy } from 'ethereum-mars'
import { OwnedUpgradeabilityProxy, Registry } from '../../build/artifacts'

export function deployRegistry() {
  const ownedUpgradabilityProxy = createProxy(OwnedUpgradeabilityProxy)

  const implementation = contract(Registry)
  const proxy = ownedUpgradabilityProxy(implementation, (registry) => {
    registry.initialize()
  })

  return {
    implementation,
    proxy,
  }
}
