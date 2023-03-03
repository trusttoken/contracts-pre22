import { AddressLike, ArtifactFrom, contract, createProxy, Transaction, TransactionOverrides } from 'ethereum-mars'
import { OwnedUpgradeabilityProxy } from '../../build/artifacts'
import { NoParams } from 'ethereum-mars/build/src/syntax/contract'
import {utils} from "ethers";

type Token = NoParams & {
  initialize(nativeToken: AddressLike, options?: TransactionOverrides): Transaction,
  transferOwnership(newOwner: AddressLike, options?: TransactionOverrides): Transaction,
}

export function deployToken<T extends Token>(tokenArtifact: ArtifactFrom<T>, controller: AddressLike) {
  const implementation = contract(tokenArtifact)
  const tokenProxy = createProxy(OwnedUpgradeabilityProxy, (proxy) => {
    proxy.upgradeTo(implementation)
    proxy.transferProxyOwnership(controller)
  })
  const proxy = tokenProxy(implementation, (token) => {
    token.initialize(generatePrecompileAddress(1983))
    token.transferOwnership(controller)
  })

  return {
    implementation,
    proxy,
  }
}

function generatePrecompileAddress(assetId: number) {
  const idHex = (1983).toString(16)
  return utils.getAddress('0xffffffff' + Array.from({ length: 32-idHex.length }, () => '0').join('') + idHex)
}
