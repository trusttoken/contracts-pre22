import { expect, use } from 'chai'
import { Contract, ContractFactory, Wallet } from 'ethers'
import { solidity } from 'ethereum-waffle'
import { beforeEachWithFixture } from './utils/beforeEachWithFixture'
import { parseEther } from 'ethers/utils'
import { Newable, setupDeploy } from '../scripts/utils'
import { TrueUsdFactory } from '../build/types/TrueUsdFactory'
import { TrueUsd } from '../build/types/TrueUsd'
import { ProvisionalRegistryMock } from '../build/types/ProvisionalRegistryMock'
import { ProvisionalRegistryMockFactory } from '../build/types/ProvisionalRegistryMockFactory'
import { FractionalExponentsFactory } from '../build/types/FractionalExponentsFactory'
import { LendingPoolMockFactory } from '../build/types/LendingPoolMockFactory'
import { ATokenMockFactory } from '../build/types/ATokenMockFactory'
import { SimpleLiquidatorMockFactory } from '../build/types/SimpleLiquidatorMockFactory'
import { LendingPoolCoreMockFactory } from '../build/types/LendingPoolCoreMockFactory'
import { AaveFinancialOpportunityFactory } from '../build/types/AaveFinancialOpportunityFactory'
import { OwnedUpgradeabilityProxyFactory } from '../build/types/OwnedUpgradeabilityProxyFactory'
import { AssuredFinancialOpportunityFactory } from '../build/types/AssuredFinancialOpportunityFactory'
import { AssuredFinancialOpportunity } from '../build/types/AssuredFinancialOpportunity'
import { AaveFinancialOpportunity } from '../build/types/AaveFinancialOpportunity'
import { StakedToken } from '../build/types/StakedToken'
import { MockTrustTokenFactory } from '../build/types/MockTrustTokenFactory'
import { MockTrustToken } from '../build/types/MockTrustToken'
import { StakedTokenFactory } from '../build/types/StakedTokenFactory'
import { RegistryAttributes } from '../scripts/attributes'
import { TimeOwnedUpgradeabilityProxyFactory } from '../build/types/TimeOwnedUpgradeabilityProxyFactory'

use(solidity)
const BTC1000 = parseEther('1000').div(1e10)

describe('Staking', () => {
  let owner: Wallet, holder: Wallet, staker: Wallet
  let trueUsd: TrueUsd
  let trustToken: MockTrustToken
  let stakedToken: StakedToken
  let registry: ProvisionalRegistryMock
  let assuredFinancialOpportunity: AssuredFinancialOpportunity
  const mockPoolAddress = Wallet.createRandom().address

  describe('with Aave and AssuredFinancialOpportunity', () => {
    let aaveLendingPoolCore: Contract
    let aTusd: Contract
    let aaveFinancialOpportunity: AaveFinancialOpportunity

    beforeEachWithFixture(async (provider, wallets) => {
      ([owner, holder, staker] = wallets)

      const deployContract = setupDeploy(owner)

      async function deployBehindProxy <T extends ContractFactory> (Factory: Newable<T>, ...args: Parameters<T['deploy']>): Promise<ReturnType<T['deploy']>> {
        const impl = await deployContract(Factory, ...args)
        const proxy = await deployContract(OwnedUpgradeabilityProxyFactory)
        const implWithProxyStorage = impl.attach(proxy.address)
        await proxy.upgradeTo(impl.address)
        return implWithProxyStorage
      }

      async function deployBehindTimeProxy <T extends ContractFactory> (Factory: Newable<T>, ...args: Parameters<T['deploy']>): Promise<ReturnType<T['deploy']>> {
        const impl = await deployContract(Factory, ...args)
        const proxy = await deployContract(TimeOwnedUpgradeabilityProxyFactory)
        const implWithProxyStorage = impl.attach(proxy.address)
        await proxy.upgradeTo(impl.address)
        return implWithProxyStorage
      }

      trueUsd = await deployContract(TrueUsdFactory, { gasLimit: 5_000_000 })

      registry = await deployContract(ProvisionalRegistryMockFactory)
      const fractionalExponents = await deployContract(FractionalExponentsFactory)
      const liquidator = await deployContract(SimpleLiquidatorMockFactory, trueUsd.address)
      aaveLendingPoolCore = await deployContract(LendingPoolCoreMockFactory)
      aTusd = await deployContract(ATokenMockFactory, trueUsd.address, aaveLendingPoolCore.address)
      const aaveLendingPool = await deployContract(LendingPoolMockFactory, aaveLendingPoolCore.address, aTusd.address)

      await trueUsd.setRegistry(registry.address)

      aaveFinancialOpportunity = await deployBehindProxy(AaveFinancialOpportunityFactory)
      assuredFinancialOpportunity = await deployBehindProxy(AssuredFinancialOpportunityFactory)

      await aaveFinancialOpportunity.configure(aTusd.address, aaveLendingPool.address, trueUsd.address, assuredFinancialOpportunity.address)
      await assuredFinancialOpportunity.configure(
        aaveFinancialOpportunity.address,
        mockPoolAddress,
        liquidator.address,
        fractionalExponents.address,
        trueUsd.address,
        trueUsd.address,
      )

      await trueUsd.setOpportunityAddress(assuredFinancialOpportunity.address)

      trustToken = await deployBehindTimeProxy(MockTrustTokenFactory)
      await trustToken.initialize(registry.address)
      stakedToken = await deployBehindProxy(StakedTokenFactory)
      await stakedToken.configure(trustToken.address, trueUsd.address, registry.address, liquidator.address)

      await registry.setAttributeValue(holder.address, RegistryAttributes.isTrueRewardsWhitelisted.hex, 1)

      await registry.subscribe(RegistryAttributes.isRegisteredContract.hex, trustToken.address)
      await registry.setAttributeValue(stakedToken.address, RegistryAttributes.isRegisteredContract.hex, 1)

      expect(await registry.subscriberCount(RegistryAttributes.isRegisteredContract.hex)).to.eq(1)
      expect(await registry.getAttributeValue(stakedToken.address, RegistryAttributes.isRegisteredContract.hex)).to.eq(1)
      expect(await registry.hasAttribute(stakedToken.address, RegistryAttributes.isRegisteredContract.hex)).to.be.true
    })

    context('one staker', () => {
      beforeEach(async () => {
        await assuredFinancialOpportunity.setRewardBasis(700)
        await trustToken.connect(staker).approve(stakedToken.address, BTC1000)
        await trustToken.faucet(staker.address, BTC1000)
        expect(await trustToken.balanceOf(stakedToken.address)).to.eq(0)
        expect(await stakedToken.totalSupply()).to.eq(0)

        await stakedToken.connect(staker).deposit(BTC1000)
        expect(await stakedToken.balanceOf(staker.address)).to.equal(BTC1000.mul(1000))
        expect(await assuredFinancialOpportunity.poolAwardBalance()).to.eq(0)
      })

      it('earns part of the reward', async () => {
        await trueUsd.mint(holder.address, parseEther('100'))

        await aaveLendingPoolCore.setReserveNormalizedIncome(parseEther('1000000000'))
        await trueUsd.connect(holder).enableTrueReward()
        await aaveLendingPoolCore.setReserveNormalizedIncome(parseEther('2000000000'))

        expect(await assuredFinancialOpportunity.totalSupply()).to.eq(parseEther('100'))
        expect(await aaveFinancialOpportunity.totalSupply()).to.eq(parseEther('100'))
        expect(await aaveFinancialOpportunity.aTokenBalance()).to.eq(parseEther('200'))

        const expectedHolderBalance = parseEther('162.450479271247104500') // 100 * 2 ^ 0.7
        expect(await trueUsd.balanceOf(holder.address)).to.equal(expectedHolderBalance)
        expect(await assuredFinancialOpportunity.poolAwardBalance()).to.eq(parseEther('200').sub(expectedHolderBalance))
      })
    })
  })
})
