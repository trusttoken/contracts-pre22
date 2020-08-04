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
import { MockTrustTokenFactory } from '../../build/types/MockTrustTokenFactory'
import { StakedTokenFactory } from '../../build/types/StakedTokenFactory'

export const deployAll = async (provider, wallets) => {
  const [owner] = wallets
  const deployContract = setupDeploy(owner)

  const registry = await deployContract(RegistryMockFactory)

  const token = await deployContract(TrueUsdFactory, { gasLimit: 5_000_000 })
  await token.setRegistry(registry.address)

  const fractionalExponents = await deployContract(FractionalExponentsFactory)
  const liquidator = await deployContract(SimpleLiquidatorMockFactory, token.address)

  const lendingPoolCore = await deployContract(LendingPoolCoreMockFactory)
  const sharesToken = await deployContract(ATokenMockFactory, token.address, lendingPoolCore.address)
  const lendingPool = await deployContract(LendingPoolMockFactory, lendingPoolCore.address, sharesToken.address)

  const trustToken = await deployContract(MockTrustTokenFactory)
  await trustToken.initialize(registry.address)

  const stakedToken = await deployContract(StakedTokenFactory)
  await stakedToken.configure(trustToken.address, token.address, registry.address, liquidator.address)

  const assuredFinancialOpportunity = await deployContract(AssuredFinancialOpportunityFactory)
  await token.setOpportunityAddress(assuredFinancialOpportunity.address)

  const aaveFinancialOpportunityProxy = await deployContract(OwnedUpgradeabilityProxyFactory)
  const aaveFinancialOpportunityImpl = await deployContract(AaveFinancialOpportunityFactory)
  await aaveFinancialOpportunityProxy.upgradeTo(aaveFinancialOpportunityImpl.address)
  const aaveFinancialOpportunity = AaveFinancialOpportunityFactory.connect(aaveFinancialOpportunityProxy.address, owner)

  return { wallets, token, registry, lendingPoolCore, sharesToken, aaveFinancialOpportunity, assuredFinancialOpportunity, liquidator, lendingPool, stakedToken, trustToken, fractionalExponents }
}
