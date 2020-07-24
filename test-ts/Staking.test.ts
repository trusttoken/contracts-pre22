import { expect, use } from 'chai'
import { ContractFactory, providers, Wallet } from 'ethers'
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
import { LendingPoolCoreMock } from '../build/types/LendingPoolCoreMock'
import { ATokenMock } from '../build/types/ATokenMock'
import { timeTravel } from './utils/timeTravel'

use(solidity)
const BTC1000 = parseEther('1000').div(1e10)

describe('Staking', () => {
  let owner: Wallet, holder: Wallet, staker: Wallet, secondStaker: Wallet
  let provider: providers.Web3Provider
  let trueUsd: TrueUsd
  let trustToken: MockTrustToken
  let stakedToken: StakedToken
  let registry: ProvisionalRegistryMock
  let assuredFinancialOpportunity: AssuredFinancialOpportunity

  describe('with Aave and AssuredFinancialOpportunity', () => {
    let aaveLendingPoolCore: LendingPoolCoreMock
    let aTusd: ATokenMock
    let aaveFinancialOpportunity: AaveFinancialOpportunity

    const stakeAll = async (staker: Wallet) => trustToken.connect(staker).transfer(stakedToken.address, await trustToken.balanceOf(staker.address))

    beforeEachWithFixture(async (_provider, wallets) => {
      ([owner, holder, staker, secondStaker] = wallets)
      provider = _provider

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
      await trueUsd.mint(aTusd.address, parseEther('1000'))
      const aaveLendingPool = await deployContract(LendingPoolMockFactory, aaveLendingPoolCore.address, aTusd.address)

      await trueUsd.setRegistry(registry.address)

      aaveFinancialOpportunity = await deployBehindProxy(AaveFinancialOpportunityFactory)
      assuredFinancialOpportunity = await deployBehindProxy(AssuredFinancialOpportunityFactory)

      await trueUsd.setOpportunityAddress(assuredFinancialOpportunity.address)

      trustToken = await deployBehindTimeProxy(MockTrustTokenFactory)
      await trustToken.initialize(registry.address)
      stakedToken = await deployBehindProxy(StakedTokenFactory)
      await stakedToken.configure(trustToken.address, trueUsd.address, registry.address, liquidator.address)

      await aaveFinancialOpportunity.configure(aTusd.address, aaveLendingPool.address, trueUsd.address, assuredFinancialOpportunity.address)
      await assuredFinancialOpportunity.configure(
        aaveFinancialOpportunity.address,
        stakedToken.address,
        liquidator.address,
        fractionalExponents.address,
        trueUsd.address,
        trueUsd.address,
      )

      await registry.setAttributeValue(holder.address, RegistryAttributes.isTrueRewardsWhitelisted.hex, 1)

      await registry.subscribe(RegistryAttributes.isRegisteredContract.hex, trustToken.address)
      await registry.subscribe(RegistryAttributes.isRegisteredContract.hex, trueUsd.address)

      await registry.setAttributeValue(staker.address, RegistryAttributes.hasPassedKYCAML.hex, 1)
      await registry.setAttributeValue(secondStaker.address, RegistryAttributes.hasPassedKYCAML.hex, 1)
      await registry.setAttributeValue(stakedToken.address, RegistryAttributes.isRegisteredContract.hex, 1)

      expect(await registry.subscriberCount(RegistryAttributes.isRegisteredContract.hex)).to.eq(2)
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

      it('cannot unstake more than own balance', async () => {
        await expect(stakeAll(staker)).to.emit(stakedToken, 'Mint')
        await trueUsd.connect(holder).enableTrueReward()
        const balance = await stakedToken.balanceOf(staker.address)
        const { timestamp } = await provider.getBlock('latest')
        await expect(stakedToken.connect(staker).initUnstake(balance.add(1))).to.emit(stakedToken, 'PendingWithdrawal').withArgs(staker.address, timestamp, balance)
      })

      it('cannot unstake twice', async () => {
        await stakeAll(staker)
        const balance = await stakedToken.balanceOf(staker.address)
        await stakedToken.connect(staker).initUnstake(balance)
        const { timestamp } = await provider.getBlock('latest')
        await expect(stakedToken.connect(staker).initUnstake(1))
          .to.emit(stakedToken, 'PendingWithdrawal').withArgs(staker.address, timestamp, 0)
      })

      const TWO_WEEKS = 60 * 60 * 24 * 14

      it('cannot finalize unstake for 14 days', async () => {
        await stakeAll(staker)
        const balance = await stakedToken.balanceOf(staker.address)
        const { blockNumber } = await stakedToken.connect(staker).initUnstake(balance)
        const { timestamp } = await provider.getBlock(blockNumber)
        await expect(stakedToken.connect(staker).finalizeUnstake(staker.address, [timestamp]))
          .to.be.revertedWith('must wait 2 weeks to unstake')
        await timeTravel(provider, TWO_WEEKS - 10)
        await expect(stakedToken.connect(staker).finalizeUnstake(staker.address, [timestamp]))
          .to.be.revertedWith('must wait 2 weeks to unstake')
      })

      it('can finalize unstake after 14 days', async () => {
        await stakeAll(staker)
        const balance = await stakedToken.balanceOf(staker.address)
        const { blockNumber } = await stakedToken.connect(staker).initUnstake(balance)
        const { timestamp } = await staker.provider.getBlock(blockNumber)
        const truBalanceBefore = await trustToken.balanceOf(staker.address)
        await timeTravel(provider, TWO_WEEKS)
        await stakedToken.connect(staker).finalizeUnstake(staker.address, [timestamp])
        const truBalanceAfter = await trustToken.balanceOf(staker.address)
        expect(truBalanceAfter).to.equal(truBalanceBefore.add(balance.div(1000)))
      })

      it('can stake multiple times', async () => {
        await stakeAll(staker)
        const balance = await stakedToken.balanceOf(staker.address)
        const { blockNumber: bn1 } = await stakedToken.connect(staker).initUnstake(balance.div(2))
        const { timestamp: t1 } = await staker.provider.getBlock(bn1)
        const { blockNumber: bn2 } = await stakedToken.connect(staker).initUnstake(balance.div(2))
        const { timestamp: t2 } = await staker.provider.getBlock(bn2)
        const truBalanceBefore = await trustToken.balanceOf(staker.address)
        await timeTravel(provider, TWO_WEEKS)
        await stakedToken.connect(staker).finalizeUnstake(staker.address, [t1, t2])
        const truBalanceAfter = await trustToken.balanceOf(staker.address)
        expect(truBalanceAfter).to.equal(truBalanceBefore.add(balance.div(1000)))
      })

      it('receives reward', async () => {
        await stakeAll(staker)

        await trueUsd.mint(holder.address, parseEther('100'))
        await aaveLendingPoolCore.setReserveNormalizedIncome(parseEther('1000000000'))
        await trueUsd.connect(holder).enableTrueReward()
        await aaveLendingPoolCore.setReserveNormalizedIncome(parseEther('2000000000'))

        expect(await stakedToken.unclaimedRewards(staker.address)).to.equal(0)
        await assuredFinancialOpportunity.awardPool()
        expect(await stakedToken.unclaimedRewards(staker.address)).to.equal(parseEther('37.5495')) // 100 * (2 - 2 ^ 0.7)
        await stakedToken.connect(staker).claimRewards(staker.address)
        expect(await stakedToken.unclaimedRewards(staker.address)).to.equal(0)
        expect(await trueUsd.balanceOf(staker.address)).to.equal(parseEther('37.5495'))
      })
    })

    context('two stakers', () => {
      beforeEach(async () => {
        await assuredFinancialOpportunity.setRewardBasis(700)
        await trustToken.connect(staker).approve(stakedToken.address, BTC1000)
        await trustToken.connect(secondStaker).approve(stakedToken.address, BTC1000.div(4))
        await trustToken.faucet(staker.address, BTC1000)
        await trustToken.faucet(secondStaker.address, BTC1000.div(4))
        expect(await trustToken.balanceOf(stakedToken.address)).to.eq(0)
        expect(await stakedToken.totalSupply()).to.eq(0)

        await stakedToken.connect(staker).deposit(BTC1000)
        await stakedToken.connect(secondStaker).deposit(BTC1000.div(4))
        expect(await stakedToken.balanceOf(staker.address)).to.equal(BTC1000.mul(1000))
        expect(await stakedToken.balanceOf(secondStaker.address)).to.equal(BTC1000.div(4).mul(1000))
        expect(await assuredFinancialOpportunity.poolAwardBalance()).to.eq(0)
      })

      it('receives reward', async () => {
        await stakeAll(staker)
        await stakeAll(secondStaker)

        await trueUsd.mint(holder.address, parseEther('100'))
        await aaveLendingPoolCore.setReserveNormalizedIncome(parseEther('1000000000'))
        await trueUsd.connect(holder).enableTrueReward()
        await aaveLendingPoolCore.setReserveNormalizedIncome(parseEther('2000000000'))

        expect(await stakedToken.unclaimedRewards(staker.address)).to.equal(0)
        expect(await stakedToken.unclaimedRewards(secondStaker.address)).to.equal(0)
        await assuredFinancialOpportunity.awardPool()

        expect(await stakedToken.unclaimedRewards(staker.address)).to.equal(parseEther('30.0396')) // 100 * (2 - 2 ^ 0.7) * 4/5
        await stakedToken.connect(staker).claimRewards(staker.address)
        expect(await stakedToken.unclaimedRewards(staker.address)).to.equal(0)
        expect(await trueUsd.balanceOf(staker.address)).to.equal(parseEther('30.0396'))

        expect(await stakedToken.unclaimedRewards(secondStaker.address)).to.equal(parseEther('7.5099')) // 100 * (2 - 2 ^ 0.7) * 1/5
        await stakedToken.connect(secondStaker).claimRewards(secondStaker.address)
        expect(await stakedToken.unclaimedRewards(secondStaker.address)).to.equal(0)
        expect(await trueUsd.balanceOf(secondStaker.address)).to.equal(parseEther('7.5099'))
      })

      it('transfer stake without rewards', async () => {
        await stakeAll(staker)

        await stakedToken.connect(staker).transfer(secondStaker.address, await stakedToken.balanceOf(staker.address))

        expect(await stakedToken.balanceOf(staker.address)).to.equal(0)
        expect(await stakedToken.balanceOf(secondStaker.address)).to.equal(BTC1000.mul(1000).mul(5).div(4)) // 1 + 1/4
      })

      it('transfer stake with rewards', async () => {
        await stakeAll(staker)

        await trueUsd.mint(holder.address, parseEther('100'))
        await aaveLendingPoolCore.setReserveNormalizedIncome(parseEther('1000000000'))
        await trueUsd.connect(holder).enableTrueReward()
        await aaveLendingPoolCore.setReserveNormalizedIncome(parseEther('2000000000'))
        await assuredFinancialOpportunity.awardPool()

        await stakedToken.connect(staker).transfer(secondStaker.address, await stakedToken.balanceOf(staker.address))

        expect(await stakedToken.balanceOf(staker.address)).to.equal(0)
        expect(await stakedToken.balanceOf(secondStaker.address)).to.equal(BTC1000.mul(1000).mul(5).div(4))

        expect(await stakedToken.unclaimedRewards(staker.address)).to.equal(parseEther('0'))
        expect(await stakedToken.unclaimedRewards(secondStaker.address)).to.equal(parseEther('37.5495'))

        await stakedToken.connect(secondStaker).claimRewards(secondStaker.address)
        expect(await trueUsd.balanceOf(secondStaker.address)).to.equal(parseEther('37.5495'))
      })
    })
  })
})
