import { contract, createProxy, ExecuteOptions } from 'ethereum-mars'
import { OwnedUpgradeabilityProxy, TokenControllerV3, TrueUSD } from '../../build/artifacts'

export function baseDeployment(deployer: string, options: ExecuteOptions) {
  const proxy = createProxy(OwnedUpgradeabilityProxy)

  const trueUSDImplementation = contract(TrueUSD)
  const trueUSDProxy = proxy(trueUSDImplementation)
  trueUSDProxy.initialize()

  const tokenControllerImplementation = contract(TokenControllerV3)
  const tokenControllerProxy = proxy(tokenControllerImplementation)
  tokenControllerProxy.initialize()
  tokenControllerProxy.setToken(trueUSDProxy)

  return {
    tokenControllerImplementation,
    tokenControllerProxy,
  }
}
