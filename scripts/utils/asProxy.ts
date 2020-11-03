import { Contract } from 'ethers'
import { OwnedUpgradeabilityProxyFactory } from '../../build/types/OwnedUpgradeabilityProxyFactory'
import { OwnedUpgradeabilityProxy } from '../../build/types/OwnedUpgradeabilityProxy'

export function asProxy (contract: Contract): OwnedUpgradeabilityProxy {
  return OwnedUpgradeabilityProxyFactory.connect(contract.address, contract.signer)
}
