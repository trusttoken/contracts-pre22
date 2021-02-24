import { Contract, Signer } from 'ethers'

interface ContractFactory<C extends Contract> {
  deploy(): Promise<C>,
  attach(address: string): C,
}

export interface ContractFactoryConstructor<C extends Contract> {
  new(signer?: Signer): ContractFactory<C>,
}

export async function deployContract<C extends Contract> (
  deployer: Signer,
  Factory: ContractFactoryConstructor<C>,
): Promise<C> {
  const factory = new Factory(deployer)
  const contract = await factory.deploy()
  await contract.deployed()
  return contract
}
