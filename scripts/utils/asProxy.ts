import { Contract } from 'ethers'
import { OwnedUpgradeabilityProxyFactory } from 'contracts/types/OwnedUpgradeabilityProxyFactory'
import { OwnedUpgradeabilityProxy } from 'contracts/types/OwnedUpgradeabilityProxy'

export function asProxy (contract: Contract): OwnedUpgradeabilityProxy {
  return OwnedUpgradeabilityProxyFactory.connect(contract.address, contract.signer)
}
