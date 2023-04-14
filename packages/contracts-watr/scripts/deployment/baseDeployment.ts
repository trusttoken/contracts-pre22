import { TrueUSD } from '../../build/artifacts'
import { deployToken } from './deployToken'
import { deployTokenController, setupTokenController } from './deployTokenController'
import { deployRegistry } from './deployRegistry'

export function baseDeployment() {
  const {
    implementation: tokenControllerImplementation,
    proxy: tokenControllerProxy,
  } = deployTokenController()

  const { implementation: trueUSDImplementation, proxy: trueUSDProxy } = deployToken(TrueUSD, tokenControllerProxy)

  const {
    implementation: registryImplementation,
    proxy: registryProxy,
  } = deployRegistry()

  setupTokenController(tokenControllerProxy, trueUSDProxy, registryProxy)

  return {
    trueUSDImplementation,
    trueUSDProxy,
    tokenControllerImplementation,
    tokenControllerProxy,
    registryImplementation,
    registryProxy,
  }
}