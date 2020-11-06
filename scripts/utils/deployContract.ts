import { Contract, Signer, Wallet } from 'ethers'

interface ContractFactory<C extends Contract> {
  deploy(): Promise<C>,
}

interface ContractFactoryConstructor<C extends Contract> {
  new(signer?: Signer): ContractFactory<C>,
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
