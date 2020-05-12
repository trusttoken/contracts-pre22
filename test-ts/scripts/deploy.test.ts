import { expect, use } from 'chai'
import { Wallet } from 'ethers'
import { parseEther } from 'ethers/utils'
import { MockProvider, solidity } from 'ethereum-waffle'
import { beforeEachWithFixture } from '../utils'
import { deploy } from '../../scripts/deploy'
import { upgrade } from '../../scripts/upgrade'
import { TrueUsdFactory } from '../../build/types/TrueUsdFactory'
import { TokenControllerFactory } from '../../build/types/TokenControllerFactory'
import { AssuredFinancialOpportunityFactory } from '../../build/types/AssuredFinancialOpportunityFactory'
import { OwnedUpgradeabilityProxyFactory } from '../../build/types/OwnedUpgradeabilityProxyFactory'
import { ProvisionalRegistryImplementationFactory } from '../../build/types/ProvisionalRegistryImplementationFactory'

use(solidity)

describe('Deploying', () => {
  let deployer: Wallet
  let provider: MockProvider

  beforeEachWithFixture(async (_provider, wallets) => {
    ([deployer] = wallets)
    provider = _provider
    const registryImplementation = await new ProvisionalRegistryImplementationFactory(deployer).deploy()
    const registryProxy = await new OwnedUpgradeabilityProxyFactory(deployer).deploy()
    const registry = registryImplementation.attach(registryProxy.address)

    const trueUSDImplementation = await deploy('TrueUSD')
    const trueUSDProxy = await deploy('OwnedUpgradeabilityProxy')
    const trueUSD = trueUSDImplementation.attach(trueUSDProxy.address)

    const lendingPoolCoreMock = await deploy('LendingPoolCoreMock')
    const aTokenMock = await deploy('ATokenMock', trueUSDProxy.address, lendingPoolCoreMock.address)
    const lendingPoolMock = await deploy('LendingPoolMock', lendingPoolCoreMock.address, aTokenMock.address)

    // uniswapFactory

    await deploy(deployer.privateKey, provider, 'rinkeby')
  })

  it('contracts storage is not corrupted by upgrade', async () => {
  })
})
