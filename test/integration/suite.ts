import { Contract, providers } from 'ethers'
import { ContractFactoryConstructor, deployContract } from 'scripts/utils/deployContract'
import ganache from 'ganache-core'
import { OwnedUpgradeabilityProxyFactory } from 'contracts'
import { expect } from 'chai'
import { parseEth } from 'utils'

export const CONTRACTS_OWNER = '0x16cEa306506c387713C70b9C1205fd5aC997E78E'
export const ETHER_HOLDER = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'

export function forkChain (rpc: string, unlockedAccounts: string[] = []) {
  return new providers.Web3Provider(ganache.provider({
    fork: rpc,
    unlocked_accounts: unlockedAccounts,
  }))
}

type Getter<T extends Contract> = keyof T['callStatic'] | ((contract: T) => any)

const execGetter = <T extends Contract>(contract: T) => async (getter: Getter<T>) => {
  if (typeof getter === 'function') {
    return getter(contract)
  }
  return contract[getter]()
}

export async function upgradeSuite<T extends Contract> (
  Factory: ContractFactoryConstructor<T>,
  currentAddress: string,
  getters: Getter<T>[],
) {
  const provider = forkChain('https://eth-mainnet.alchemyapi.io/v2/Vc3xNXIWdxEbDOToa69DhWeyhgFVBDWl', [CONTRACTS_OWNER, ETHER_HOLDER])
  const owner = provider.getSigner(CONTRACTS_OWNER)
  const holder = provider.getSigner(ETHER_HOLDER)
  await holder.sendTransaction({ value: parseEth(100), to: CONTRACTS_OWNER })
  const newContract = await deployContract(owner, Factory)
  const existingContract = new Factory(owner).attach(currentAddress)
  const oldValues = await Promise.all(getters.map(execGetter(existingContract)))
  const proxy = new OwnedUpgradeabilityProxyFactory(owner).attach(currentAddress)
  await (await proxy.upgradeTo(newContract.address)).wait()
  const newValues = await Promise.all(getters.map(execGetter(existingContract)))
  for (let i = 0; i < oldValues.length; i++) {
    expect(oldValues[i], `Possible corrupted storage:
Getter: ${getters[i]}
Current: ${oldValues[i].toString()}
Post upgrade: ${newValues[i].toString()}\n`).to.deep.equal(newValues[i])
  }
  return existingContract
}
