import { Wallet, utils } from 'ethers'
import { MockProvider } from 'ethereum-waffle'

import { setupDeploy } from 'scripts/utils'

import {
  MockTrueCurrencyFactory,
  OwnedUpgradeabilityProxyFactory,
} from 'contracts'

export const initialSupply = utils.parseEther('1000')

export const trueCurrency = async (wallets: Wallet[], provider: MockProvider) => {
  const [owner] = wallets
  const deployContract = setupDeploy(owner)

  const implementation = await deployContract(MockTrueCurrencyFactory)
  const proxy = await deployContract(OwnedUpgradeabilityProxyFactory)
  const token = implementation.attach(proxy.address)
  await proxy.upgradeTo(implementation.address)
  await token.initialize()
  await token.mint(owner.address, initialSupply)

  return { wallets, provider, token }
}
