/* eslint-disable no-redeclare */
import { BigNumberish, Contract, providers } from 'ethers'
import { ContractFactoryConstructor, deployContract } from 'scripts/utils/deployContract'
import ganache from 'ganache-core'
import { OwnedUpgradeabilityProxy__factory } from 'contracts'
import { expect } from 'chai'
import { parseEth } from 'utils'

export const CONTRACTS_OWNER = '0x16cEa306506c387713C70b9C1205fd5aC997E78E'
export const ETHER_HOLDER = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'

export function forkChain (rpc: string, unlockedAccounts: string[] = [], blockNumber?: BigNumberish,
) {
  return new providers.Web3Provider(ganache.provider({
    fork: blockNumber ? `${rpc}@${blockNumber.toString()}` : rpc,
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

export const TEST_STATE_BLOCK_NUMBER = 12010725

export function upgradeSuite<T extends Contract>(blockNumber: number, Factory: ContractFactoryConstructor<T>, currentAddress: string,
  getters: Getter<T>[], contractsOwner?: string): Promise<T>
export function upgradeSuite<T extends Contract>(Factory: ContractFactoryConstructor<T>, currentAddress: string,
  getters: Getter<T>[], contractsOwner?: string): Promise<T>
export function upgradeSuite (...args: any[]): any {
  if (typeof args[0] === 'number') {
    const [bn, factory, address, getters, owner] = args
    return _upgradeSuite(factory, address, getters, owner, bn)
  }
  const [factory, address, getters, owner] = args
  return _upgradeSuite(factory, address, getters, owner)
}

async function _upgradeSuite<T extends Contract> (
  Factory: ContractFactoryConstructor<T>,
  currentAddress: string,
  getters: Getter<T>[],
  contractsOwner: string = CONTRACTS_OWNER,
  blockNumber?: number | undefined,
) {
  const provider = forkChain('https://eth-mainnet.alchemyapi.io/v2/Vc3xNXIWdxEbDOToa69DhWeyhgFVBDWl', [contractsOwner, ETHER_HOLDER], blockNumber)
  const owner = provider.getSigner(contractsOwner)
  const holder = provider.getSigner(ETHER_HOLDER)
  await holder.sendTransaction({ value: parseEth(100), to: contractsOwner })
  const newContract = await deployContract(owner, Factory)
  const existingContract = new Factory(owner).attach(currentAddress)
  const oldValues = await Promise.all(getters.map(execGetter(existingContract)))
  const proxy = new OwnedUpgradeabilityProxy__factory(owner).attach(currentAddress)
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
