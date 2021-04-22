import { Contract } from 'ethers'
import { OwnedUpgradeabilityProxy__factory, OwnedUpgradeabilityProxy } from 'contracts'

export function asProxy (contract: Contract): OwnedUpgradeabilityProxy {
  return OwnedUpgradeabilityProxy__factory.connect(contract.address, contract.signer)
}
