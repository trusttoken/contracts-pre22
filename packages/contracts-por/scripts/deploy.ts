import { deployContract, MockProvider } from 'ethereum-waffle'
import { BigNumber, getDefaultProvider, Wallet } from 'ethers'
import { OwnedUpgradeabilityProxy__factory } from '../build/types/factories/OwnedUpgradeabilityProxy__factory'
import { providers } from 'ethers'
//import { InfuraProvider } from 'ethers/providers'

export async function deploy() {
  /*
  what we need to configure:
    1. private key of wallet that we want to use for contract deployment
    2. infura key
    3. contract factory - factory of contract that we want to deploy
   */
  const goerliChainId = 5
  const provider = new providers.InfuraProvider(goerliChainId, process.env.INFURA_KEY)
  // const provider = getDefaultProvider(5)
  const wallet = new Wallet(process.env.PRIVATE_KEY, provider)
  const result = await deployContract(wallet, OwnedUpgradeabilityProxy__factory, [BigNumber.from(1000)] as any, { gasLimit: 2_000_000 })

}

deploy()
