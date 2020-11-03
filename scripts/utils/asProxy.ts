import { Contract } from 'ethers'
import { OwnedUpgradeabilityProxyFactory } from '../../build/OwnedUpgradeabilityProxyFactory'
import { OwnedUpgradeabilityProxy } from '../../build/OwnedUpgradeabilityProxy'

export function asProxy (contract: Contract): OwnedUpgradeabilityProxy {
  return OwnedUpgradeabilityProxyFactory.connect(contract.address, contract.signer)
}
