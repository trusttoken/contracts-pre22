import { AddressLike, ArtifactFrom, contract, createProxy, Transaction, TransactionOverrides } from 'ethereum-mars'
import { OwnedUpgradeabilityProxy } from '../../build/artifacts'
import { NoParams } from 'ethereum-mars/build/src/syntax/contract'
import {generatePrecompileAddress} from "../../utils/generatePrecompileAddress";

type Token = NoParams & {
  initialize(nativeToken: AddressLike, options?: TransactionOverrides): Transaction,
  transferOwnership(newOwner: AddressLike, options?: TransactionOverrides): Transaction,
}

export function deployToken<T extends Token>(tokenArtifact: ArtifactFrom<T>, controller: AddressLike, assetId: number) {
  const implementation = contract(tokenArtifact)
  const tokenProxy = createProxy(OwnedUpgradeabilityProxy, (proxy) => {
    proxy.upgradeTo(implementation)
    proxy.transferProxyOwnership(controller)
  })
  const proxy = tokenProxy(implementation, (token) => {
    token.initialize(generatePrecompileAddress(assetId))
    token.transferOwnership(controller)
  })

  return {
    implementation,
    proxy,
  }
}
