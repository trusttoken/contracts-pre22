import { Wallet, utils } from 'ethers'
import { MockTrueCurrencyFactory } from '../../build/types/MockTrueCurrencyFactory'
import { OwnedUpgradeabilityProxyFactory } from '../../build/types/OwnedUpgradeabilityProxyFactory'
import { setupDeploy } from '../../scripts/utils'
import { MockProvider } from 'ethereum-waffle'

export const initialSupply = utils.parseEther('1000')

export const trueCurrency = async (provider: MockProvider, wallets: Wallet[]) => {
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
