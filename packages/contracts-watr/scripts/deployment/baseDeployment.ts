import { PausedTrueUSD, TrueUSD } from '../../build/artifacts'
import { deployToken } from './deployToken'
import {
  deployTokenController,
  setupMintThresholds, setupTokenController,
} from './deployTokenController'
import { deployRegistry } from './deployRegistry'
import { contract } from 'ethereum-mars'

export function baseDeployment() {
  const tokenId = parseInt(process.env['TRUE_USD_ASSET_ID'])
  if (isNaN(tokenId)) {
    throw new Error('TRUE_USD_ASSET_ID not provided or invalid')
  }

  const pausedImplementation = contract(PausedTrueUSD)
  const {
    implementation: tokenControllerImplementation,
    proxy: tokenControllerProxy,
  } = deployTokenController(pausedImplementation)

  const { implementation: trueUSDImplementation, proxy: trueUSDProxy } = deployToken(TrueUSD, tokenControllerProxy, tokenId)

  const {
    implementation: registryImplementation,
    proxy: registryProxy,
  } = deployRegistry()

  setupTokenController(tokenControllerProxy, trueUSDProxy, registryProxy)
  setupMintThresholds(tokenControllerProxy)

  return {
    trueUSDImplementation,
    trueUSDProxy,
    tokenControllerImplementation,
    tokenControllerProxy,
    registryImplementation,
    registryProxy,
  }
}
