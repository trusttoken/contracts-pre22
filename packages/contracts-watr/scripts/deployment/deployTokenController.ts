import { AddressLike, contract, createProxy } from 'ethereum-mars'
import { OwnedUpgradeabilityProxy, TokenControllerV3 } from '../../build/artifacts'

export function deployTokenController() {
  const ownedUpgradabilityProxy = createProxy(OwnedUpgradeabilityProxy)

  const implementation = contract(TokenControllerV3)
  const proxy = ownedUpgradabilityProxy(implementation, (controller) => {
    controller.initialize()
  })

  return {
    implementation,
    proxy,
  }
}

export function setupTokenController(controller: ReturnType<typeof deployTokenController>['proxy'], token: AddressLike, registry: AddressLike) {
  controller.setRegistry(registry)
  controller.setToken(token)
  controller.claimTrueCurrencyProxyOwnership()
  controller.claimTrueCurrencyOwnership()
}
