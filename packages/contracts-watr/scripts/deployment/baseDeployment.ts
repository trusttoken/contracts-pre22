import { contract, createProxy } from 'ethereum-mars'
import { OwnedUpgradeabilityProxy, Registry, TokenControllerV3, TrueUSD } from '../../build/artifacts'

export function baseDeployment() {
  const proxy = createProxy(OwnedUpgradeabilityProxy)

  const trueUSDImplementation = contract(TrueUSD)
  const trueUSDProxy = proxy(trueUSDImplementation)
  trueUSDProxy.initialize()

  const tokenControllerImplementation = contract(TokenControllerV3)
  const tokenControllerProxy = proxy(tokenControllerImplementation)
  tokenControllerProxy.initialize()

  const registryImplementation = contract(Registry)
  const registryProxy = proxy(registryImplementation)
  registryProxy.initialize()

  tokenControllerProxy.setRegistry(registryProxy)
  tokenControllerProxy.setToken(trueUSDProxy)
  trueUSDProxy['transferProxyOwnership'](tokenControllerProxy)
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
