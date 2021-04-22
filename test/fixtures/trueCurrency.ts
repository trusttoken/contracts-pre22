import { Wallet, utils } from 'ethers'
import { MockProvider } from 'ethereum-waffle'

import { setupDeploy } from 'scripts/utils'

import {
  MockTrueCurrency__factory,
  OwnedUpgradeabilityProxy__factory,
} from 'contracts'

export const initialSupply = utils.parseEther('1000')

export const trueCurrency = async (wallets: Wallet[], provider: MockProvider) => {
  const [owner] = wallets
  const deployContract = setupDeploy(owner)

  const implementation = await deployContract(MockTrueCurrency__factory)
  const proxy = await deployContract(OwnedUpgradeabilityProxy__factory)
  const token = implementation.attach(proxy.address)
  await proxy.upgradeTo(implementation.address)
  await token.initialize()
  await token.mint(owner.address, initialSupply)

  return { wallets, provider, token }
}
