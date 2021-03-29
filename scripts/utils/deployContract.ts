import { Contract, Signer } from 'ethers'

interface ContractFactory<C extends Contract> {
  deploy(...args: Parameters<C['deploy']>): Promise<C>,
  attach(address: string): C,
}

export interface ContractFactoryConstructor<C extends Contract> {
  new(signer?: Signer): ContractFactory<C>,
}

export async function deployContract<C extends Contract> (
  deployer: Signer,
  Factory: ContractFactoryConstructor<C>,
  args?: Parameters<C['deploy']>,
): Promise<C> {
  const factory = new Factory(deployer)
  const contract = await factory.deploy(...(args || [] as any))
  await contract.deployed()
  return contract
}
