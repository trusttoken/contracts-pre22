import { AddressLike, ArtifactFrom, contract, createProxy, Transaction, TransactionOverrides } from 'ethereum-mars'
import { OwnedUpgradeabilityProxy } from '../../build/artifacts'
import { NoParams } from 'ethereum-mars/build/src/syntax/contract'

type Token = NoParams & {
  initialize(options?: TransactionOverrides): Transaction,
  transferOwnership(newOwner: AddressLike, options?: TransactionOverrides): Transaction,
}

export function deployToken<T extends Token>(tokenArtifact: ArtifactFrom<T>, controller: AddressLike) {
  const implementation = contract(tokenArtifact)
  const tokenProxy = createProxy(OwnedUpgradeabilityProxy, (proxy) => {
    proxy.upgradeTo(implementation)
    proxy.transferProxyOwnership(controller)
  })
  const proxy = tokenProxy(implementation, (token) => {
    token.initialize()
    token.transferOwnership(controller)
  })

  return {
    implementation,
    proxy,
  }
}
