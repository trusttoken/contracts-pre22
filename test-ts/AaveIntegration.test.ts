import { expect, use } from 'chai'
import { solidity, MockProvider } from 'ethereum-waffle'
import { Wallet } from 'ethers'
import { parseEther } from 'ethers/utils'
import { AaveFinancialOpportunity } from '../build/types/AaveFinancialOpportunity'
import { AaveFinancialOpportunityFactory } from '../build/types/AaveFinancialOpportunityFactory'
import { AssuredFinancialOpportunityFactory } from '../build/types/AssuredFinancialOpportunityFactory'
import { FractionalExponentsFactory } from '../build/types/FractionalExponentsFactory'
import { OwnedUpgradeabilityProxyFactory } from '../build/types/OwnedUpgradeabilityProxyFactory'
import { RegistryMockFactory } from '../build/types/RegistryMockFactory'
import { SimpleLiquidatorMockFactory } from '../build/types/SimpleLiquidatorMockFactory'
import { TrueRewardBackedToken } from '../build/types/TrueRewardBackedToken'
import { TrueUsdFactory } from '../build/types/TrueUsdFactory'
import { setupDeploy } from '../scripts/utils'
import { AssuredFinancialOpportunity } from '../build/types/AssuredFinancialOpportunity'
import { SimpleLiquidatorMock } from '../build/types/SimpleLiquidatorMock'
import { deployAave } from './utils/deployAave'
import { LendingPoolCore } from '../build/types/LendingPoolCore'
import { LendingPool } from '../build/types/LendingPool'
import { AToken } from '../build/types/AToken'

use(solidity)

describe('AAveIntegrationTest: TrueRewardBackedToken with real Aave contracts', () => {
  let owner: Wallet, holder: Wallet, holder2: Wallet
  let token: TrueRewardBackedToken
  let financialOpportunity: AssuredFinancialOpportunity
  const mockPoolAddress = Wallet.createRandom().address
  const WHITELIST_TRUEREWARD = '0x6973547275655265776172647357686974656c69737465640000000000000000'

  let lendingPoolCore: LendingPoolCore
  let lendingPool: LendingPool
  let sharesToken: AToken
  let aaveFinancialOpportunity: AaveFinancialOpportunity
  let liquidator: SimpleLiquidatorMock
  let provider: MockProvider

  beforeEach(async () => {
    provider = new MockProvider({
      allowUnlimitedContractSize: true,
    });
    ([owner, holder, holder2] = provider.getWallets())
    const deployContract = setupDeploy(owner)
    token = await deployContract(TrueUsdFactory, { gasLimit: 5_000_000 })
    const registry = await deployContract(RegistryMockFactory)
    const fractionalExponents = await deployContract(FractionalExponentsFactory)
    liquidator = await deployContract(SimpleLiquidatorMockFactory, token.address)
    ;({ lendingPool, lendingPoolCore, aTUSD: sharesToken } = await deployAave(owner, token.address))
    const aaveFinancialOpportunityImpl = await deployContract(AaveFinancialOpportunityFactory)
    const aaveFinancialOpportunityProxy = await deployContract(OwnedUpgradeabilityProxyFactory)
    aaveFinancialOpportunity = aaveFinancialOpportunityImpl.attach(aaveFinancialOpportunityProxy.address)
    await aaveFinancialOpportunityProxy.upgradeTo(aaveFinancialOpportunityImpl.address)

    const financialOpportunityImpl = await deployContract(AssuredFinancialOpportunityFactory)
    const financialOpportunityProxy = await deployContract(OwnedUpgradeabilityProxyFactory)
    financialOpportunity = financialOpportunityImpl.attach(financialOpportunityProxy.address)
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

    await token.setOpportunityAddress(financialOpportunity.address)

    await token.mint(liquidator.address, parseEther('1000'))
    await token.mint(holder.address, parseEther('200'))
    await token.setRegistry(registry.address)
    await token.connect(holder).transfer(holder2.address, parseEther('100'))

    await token.connect(owner).mint(owner.address, parseEther('200'))
    await token.connect(owner).approve(lendingPoolCore.address, parseEther('200'))
    await lendingPool.connect(owner).deposit(token.address, parseEther('100'), 0)
    await lendingPool.connect(owner).setUserUseReserveAsCollateral(token.address, true)

    await token.connect(holder2).approve(lendingPoolCore.address, parseEther('100'))
    await lendingPool.connect(holder2).deposit(token.address, parseEther('50'), 0, { gasLimit: 5000000 })
    await lendingPool.connect(holder2).borrow(token.address, parseEther('45'), 2, 0, { gasLimit: 5000000 })

    await registry.setAttributeValue(owner.address, WHITELIST_TRUEREWARD, 1)
    await registry.setAttributeValue(holder.address, WHITELIST_TRUEREWARD, 1)
    await registry.setAttributeValue(holder2.address, WHITELIST_TRUEREWARD, 1)
  })

  it('disableTrueReward does not trigger liquidation', async () => {
    for (let rewardBasis = 1; rewardBasis < 10; rewardBasis++) {
      await token.connect(holder).enableTrueReward({ gasLimit: 5000000 })
      await financialOpportunity.setRewardBasis(rewardBasis * 10, { gasLimit: 5000000 })
      await token.connect(holder).disableTrueReward({ gasLimit: 5000000 })
      expect('reclaim').to.be.not.calledOnContract(liquidator)
    }
  })
})
