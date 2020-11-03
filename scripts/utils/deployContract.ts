import { Contract, Signer, Wallet } from 'ethers'

interface ContractFactoryConstructor<C extends Contract> {
  new(signer?: Signer): ContractFactory<C>,
}

interface ContractFactory<C extends Contract> {
  deploy(): Promise<C>,
}

export async function deployContract<C extends Contract> (
  deployer: Wallet,
  Factory: ContractFactoryConstructor<C>,
): Promise<C> {
  const factory = new Factory(deployer)
  const contract = await factory.deploy()
  await contract.deployed()
  return contract
}
