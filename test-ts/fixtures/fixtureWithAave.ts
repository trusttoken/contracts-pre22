import { Wallet } from 'ethers'
import { AaveFinancialOpportunityFactory } from '../../build/types/AaveFinancialOpportunityFactory'
import { AssuredFinancialOpportunityFactory } from '../../build/types/AssuredFinancialOpportunityFactory'
import { ATokenMockFactory } from '../../build/types/ATokenMockFactory'
import { FractionalExponentsFactory } from '../../build/types/FractionalExponentsFactory'
import { LendingPoolCoreMockFactory } from '../../build/types/LendingPoolCoreMockFactory'
import { LendingPoolMockFactory } from '../../build/types/LendingPoolMockFactory'
import { OwnedUpgradeabilityProxyFactory } from '../../build/types/OwnedUpgradeabilityProxyFactory'
import { RegistryMockFactory } from '../../build/types/RegistryMockFactory'
import { SimpleLiquidatorMockFactory } from '../../build/types/SimpleLiquidatorMockFactory'
import { TrueUsdFactory } from '../../build/types/TrueUsdFactory'
import { setupDeploy } from '../../scripts/utils'

export const fixtureWithAave = async (owner: Wallet) => {
  const deployContract = setupDeploy(owner)

  const token = await deployContract(TrueUsdFactory, { gasLimit: 5_000_000 })
  const mockPoolAddress = Wallet.createRandom().address

  const registry = await deployContract(RegistryMockFactory)
  const fractionalExponents = await deployContract(FractionalExponentsFactory)
  const liquidator = await deployContract(SimpleLiquidatorMockFactory, token.address)
  const lendingPoolCore = await deployContract(LendingPoolCoreMockFactory)
  const sharesToken = await deployContract(ATokenMockFactory, token.address, lendingPoolCore.address)
  const lendingPool = await deployContract(LendingPoolMockFactory, lendingPoolCore.address, sharesToken.address)

  const aaveFinancialOpportunityImpl = await deployContract(AaveFinancialOpportunityFactory)
  const aaveFinancialOpportunityProxy = await deployContract(OwnedUpgradeabilityProxyFactory)
  const aaveFinancialOpportunity = aaveFinancialOpportunityImpl.attach(aaveFinancialOpportunityProxy.address)
  await aaveFinancialOpportunityProxy.upgradeTo(aaveFinancialOpportunityImpl.address)

  const financialOpportunityImpl = await deployContract(AssuredFinancialOpportunityFactory)
  const financialOpportunityProxy = await deployContract(OwnedUpgradeabilityProxyFactory)
  const financialOpportunity = financialOpportunityImpl.attach(financialOpportunityProxy.address)
  await financialOpportunityProxy.upgradeTo(financialOpportunityImpl.address)

  await aaveFinancialOpportunity.configure(sharesToken.address, lendingPool.address, token.address, financialOpportunity.address)
  await financialOpportunity.configure(
    aaveFinancialOpportunity.address,
    mockPoolAddress,
    liquidator.address,
    fractionalExponents.address,
    token.address,
    token.address,
  )
  await token.setRegistry(registry.address)

  return { token, registry, lendingPoolCore, sharesToken, aaveFinancialOpportunity, financialOpportunity, liquidator }
}
