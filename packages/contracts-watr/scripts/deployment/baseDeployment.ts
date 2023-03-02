import { contract, createProxy } from 'ethereum-mars'
import { OwnedUpgradeabilityProxy, Registry, TokenControllerV3, TrueUSD } from '../../build/artifacts'

export function baseDeployment() {
  const proxy = createProxy(OwnedUpgradeabilityProxy)

  const tokenControllerImplementation = contract(TokenControllerV3)
  const tokenControllerProxy = proxy(tokenControllerImplementation)
  tokenControllerProxy.initialize()

  const tokenProxy = createProxy(OwnedUpgradeabilityProxy, (proxy) => {
    proxy.transferProxyOwnership(tokenControllerProxy)
  })

  const trueUSDImplementation = contract(TrueUSD)
  const trueUSDProxy = tokenProxy(trueUSDImplementation, (token) => {
    token.initialize()
  })

  const registryImplementation = contract(Registry)
  const registryProxy = proxy(registryImplementation, (registry) => {
    registry.initialize()
  })

  tokenControllerProxy.setRegistry(registryProxy)
  tokenControllerProxy.setToken(trueUSDProxy)
  tokenControllerProxy.claimTrueCurrencyProxyOwnership()

  return {
    trueUSDImplementation,
    trueUSDProxy,
    tokenControllerImplementation,
    tokenControllerProxy,
    registryImplementation,
    registryProxy,
  }
}
