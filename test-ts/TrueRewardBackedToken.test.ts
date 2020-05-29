import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { Contract, Wallet } from 'ethers'
import { parseEther } from 'ethers/utils'
import { AaveFinancialOpportunity } from '../build/types/AaveFinancialOpportunity'
import { AaveFinancialOpportunityFactory } from '../build/types/AaveFinancialOpportunityFactory'
import { AssuredFinancialOpportunityFactory } from '../build/types/AssuredFinancialOpportunityFactory'
import { ATokenMock } from '../build/types/ATokenMock'
import { ATokenMockFactory } from '../build/types/ATokenMockFactory'
import { ConfigurableFinancialOpportunityMockFactory } from '../build/types/ConfigurableFinancialOpportunityMockFactory'
import { FinancialOpportunity } from '../build/types/FinancialOpportunity'
import { FractionalExponentsFactory } from '../build/types/FractionalExponentsFactory'
import { LendingPoolCoreMock } from '../build/types/LendingPoolCoreMock'
import { LendingPoolCoreMockFactory } from '../build/types/LendingPoolCoreMockFactory'
import { LendingPoolMockFactory } from '../build/types/LendingPoolMockFactory'
import { OwnedUpgradeabilityProxyFactory } from '../build/types/OwnedUpgradeabilityProxyFactory'
import { RegistryMock } from '../build/types/RegistryMock'
import { RegistryMockFactory } from '../build/types/RegistryMockFactory'
import { SimpleLiquidatorMockFactory } from '../build/types/SimpleLiquidatorMockFactory'
import { TrueRewardBackedToken } from '../build/types/TrueRewardBackedToken'
import { TrueUsdFactory } from '../build/types/TrueUsdFactory'
import { setupDeploy } from '../scripts/utils'
import { beforeEachWithFixture } from './utils'

use(solidity)

describe('TrueRewardBackedToken', () => {
  let owner: Wallet, holder: Wallet, holder2: Wallet, sender: Wallet, recipient: Wallet, notWhitelisted: Wallet
  let token: TrueRewardBackedToken
  let registry: RegistryMock
  let financialOpportunity: FinancialOpportunity
  const mockPoolAddress = Wallet.createRandom().address
  const WHITELIST_TRUEREWARD = '0x6973547275655265776172647357686974656c69737465640000000000000000'

  describe('with AssuredFinancialOpportunity', () => {
    let configurableFinancialOpportunity: Contract

    beforeEachWithFixture(async (provider, wallets) => {
      ([owner, holder, holder2, sender, recipient, notWhitelisted] = wallets)
      const deployContract = setupDeploy(owner)
      token = await deployContract(TrueUsdFactory, { gasLimit: 5_000_000 })
      await token.mint(holder.address, parseEther('100'))
      registry = await deployContract(RegistryMockFactory)
      await token.setRegistry(registry.address)

      const fractionalExponents = await deployContract(FractionalExponentsFactory)
      const liquidator = await deployContract(SimpleLiquidatorMockFactory, token.address)
      await token.mint(liquidator.address, parseEther('1000'))

      configurableFinancialOpportunity = await deployContract(ConfigurableFinancialOpportunityMockFactory, token.address)
      await token.mint(configurableFinancialOpportunity.address, parseEther('100'))

      const financialOpportunityImpl = await deployContract(AssuredFinancialOpportunityFactory)
      const financialOpportunityProxy = await deployContract(OwnedUpgradeabilityProxyFactory)
      financialOpportunity = financialOpportunityImpl.attach(financialOpportunityProxy.address)
      await financialOpportunityProxy.upgradeTo(financialOpportunityImpl.address)
      await financialOpportunity.configure(
        configurableFinancialOpportunity.address,
        mockPoolAddress,
        liquidator.address,
        fractionalExponents.address,
        token.address,
        token.address,
      )
      await token.setOpportunityAddress(financialOpportunity.address)

      await registry.setAttributeValue(owner.address, WHITELIST_TRUEREWARD, 1)
      await registry.setAttributeValue(holder.address, WHITELIST_TRUEREWARD, 1)
      await registry.setAttributeValue(holder2.address, WHITELIST_TRUEREWARD, 1)
      await registry.setAttributeValue(sender.address, WHITELIST_TRUEREWARD, 1)
      await registry.setAttributeValue(recipient.address, WHITELIST_TRUEREWARD, 1)
    })

    it('holder enables trueReward with 0 balance', async () => {
      expect(await token.trueRewardEnabled(holder2.address)).to.be.false

      await token.connect(holder2).enableTrueReward()
      expect(await token.trueRewardEnabled(holder2.address)).to.be.true
    })

    it('holder enables trueReward with 100 balance', async () => {
      await token.connect(holder).enableTrueReward()
      expect(await token.trueRewardEnabled(holder.address)).to.be.true
      expect(await token.rewardTokenBalance(holder.address, financialOpportunity.address)).to.equal(parseEther('100'))
      expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal(parseEther('100'))
      expect(await token.totalSupply()).to.equal(parseEther('1300'))
      expect(await token.balanceOf(holder.address)).to.equal(parseEther('100'))
    })

    it('holder disables trueReward', async () => {
      expect(await token.balanceOf(holder.address)).to.equal(parseEther('100'))
      await expect(token.connect(holder).enableTrueReward()).to.emit(financialOpportunity, 'Deposit').withArgs(holder.address, parseEther('100'), parseEther('100'))
      expect(await token.trueRewardEnabled(holder.address)).to.be.true
      await expect(token.connect(holder).disableTrueReward()).to.emit(financialOpportunity, 'Redemption').withArgs(holder.address, parseEther('100'), parseEther('100'))
      expect(await token.trueRewardEnabled(holder.address)).to.be.false
      expect(await token.rewardTokenBalance(holder.address, financialOpportunity.address)).to.equal(0)
      expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal(0)
      expect(await token.totalSupply()).to.equal(parseEther('1200'))
      expect(await token.balanceOf(holder.address)).to.equal(parseEther('100'))
    })

    it('holder fails to enable trueReward when not whitelisted', async () => {
      expect(await token.trueRewardEnabled(notWhitelisted.address)).to.be.false

      await expect(token.connect(notWhitelisted).enableTrueReward()).to.be.revertedWith(
        'must be whitelisted to enable TrueRewards')
      expect(await token.trueRewardEnabled(notWhitelisted.address)).to.be.false
    })
  })

  describe('with Aave', () => {
    let sharesToken: Contract
    let lendingPoolCore: Contract
    let lendingPool: Contract

    beforeEachWithFixture(async (provider, wallets) => {
      ([owner, holder, holder2, sender, recipient] = wallets)
      const deployContract = setupDeploy(owner)
      token = await deployContract(TrueUsdFactory, { gasLimit: 5_000_000 })
      await token.mint(holder.address, parseEther('300'))

      registry = await deployContract(RegistryMockFactory)
      await token.setRegistry(registry.address)

      lendingPoolCore = await deployContract(LendingPoolCoreMockFactory)
      sharesToken = await deployContract(ATokenMockFactory, token.address, lendingPoolCore.address)
      lendingPool = await deployContract(LendingPoolMockFactory, lendingPoolCore.address, sharesToken.address)

      await token.connect(holder).transfer(sharesToken.address, parseEther('100'))
      await token.connect(holder).transfer(holder2.address, parseEther('100'))

      const financialOpportunityImpl = await deployContract(AaveFinancialOpportunityFactory)
      const financialOpportunityProxy = await deployContract(OwnedUpgradeabilityProxyFactory)
      financialOpportunity = financialOpportunityImpl.attach(financialOpportunityProxy.address)
      await financialOpportunityProxy.upgradeTo(financialOpportunityImpl.address)
      await financialOpportunity.configure(sharesToken.address, lendingPool.address, token.address, token.address)
      await token.setOpportunityAddress(financialOpportunity.address)

      await registry.setAttributeValue(owner.address, WHITELIST_TRUEREWARD, 1)
      await registry.setAttributeValue(holder.address, WHITELIST_TRUEREWARD, 1)
      await registry.setAttributeValue(holder2.address, WHITELIST_TRUEREWARD, 1)
      await registry.setAttributeValue(sender.address, WHITELIST_TRUEREWARD, 1)
      await registry.setAttributeValue(recipient.address, WHITELIST_TRUEREWARD, 1)
    })

    it('holder enables truereward', async () => {
      expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal(0)
      await token.connect(holder).enableTrueReward()
      expect(await financialOpportunity.tokenValue()).to.equal(parseEther('1'))
      expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal(parseEther('100'))
      expect(await token.balanceOf(financialOpportunity.address)).to.equal(0)
      expect(await token.rewardTokenBalance(holder.address, financialOpportunity.address)).to.equal(parseEther('100'))
      expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal(parseEther('100'))
      expect(await token.totalSupply()).to.equal(parseEther('400'))
      expect(await token.balanceOf(holder.address)).to.equal(parseEther('100'))
    })

    it('two holders enable truereward', async () => {
      await token.connect(holder).enableTrueReward()
      await token.connect(holder2).enableTrueReward()
      expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal(parseEther('200'))
      expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal(parseEther('200'))
      expect(await token.totalSupply()).to.equal(parseEther('500'))
    })

    it('holders balance increases after tokenValue increases', async () => {
      expect(await token.balanceOf(holder.address)).to.equal(parseEther('100'))
      await lendingPoolCore.setReserveNormalizedIncome(parseEther('1500000000'))
      await token.connect(holder).enableTrueReward()
      expect(await token.balanceOf(holder.address)).to.equal('99999999999999999999')
      await lendingPoolCore.setReserveNormalizedIncome(parseEther('1600000000'))
      expect(await token.balanceOf(holder.address)).to.equal('106666666666666666665')
    })

    it('holders with trudereward disabled transfer funds between each other', async () => {
      const asHolder = token.connect(holder)
      await asHolder.transfer(recipient.address, parseEther('42'))
      expect(await token.balanceOf(recipient.address)).to.equal(parseEther('42'))
      expect(await token.balanceOf(holder.address)).to.equal(parseEther('58'))
    })

    describe('tokenValue == 1', () => {
      beforeEach(async () => {
        await token.connect(holder).transfer(sender.address, parseEther('100'))
      })

      it('sender with truereward enabled sends to recipient with truereward disabled', async () => {
        await token.connect(sender).enableTrueReward()
        expect(await token.totalSupply()).to.equal(parseEther('400'))

        await token.connect(sender).transfer(recipient.address, parseEther('50'))

        expect(await token.balanceOf(sender.address)).to.equal(parseEther('50'))
        expect(await token.balanceOf(recipient.address)).to.equal(parseEther('50'))
        expect(await token.rewardTokenBalance(sender.address, financialOpportunity.address)).to.equal(parseEther('50'))
        expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal(parseEther('50'))
        expect(await token.totalSupply()).to.equal(parseEther('350'))
        expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal(parseEther('50'))
      })

      it('holders with trudereward enabled transfer funds between each other', async () => {
        await token.connect(sender).enableTrueReward()
        await token.connect(recipient).enableTrueReward()
        await token.connect(sender).transfer(recipient.address, parseEther('50'))

        expect(await token.balanceOf(sender.address)).to.equal(parseEther('50'))
        expect(await token.balanceOf(recipient.address)).to.equal(parseEther('50'))
        expect(await token.rewardTokenBalance(sender.address, financialOpportunity.address)).to.equal(parseEther('50'))
        expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal(parseEther('100'))
        expect(await token.totalSupply()).to.equal(parseEther('400'))
        expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal(parseEther('100'))
      })

      it('sender with truereward disabled sends to recipient with truereward enabled', async () => {
        await token.connect(recipient).enableTrueReward()
        await token.connect(sender).transfer(recipient.address, parseEther('50'))

        expect(await token.balanceOf(sender.address)).to.equal(parseEther('50'))
        expect(await token.balanceOf(recipient.address)).to.equal(parseEther('50'))
        expect(await token.rewardTokenBalance(recipient.address, financialOpportunity.address)).to.equal(parseEther('50'))
        expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal(parseEther('50'))
        expect(await token.totalSupply()).to.equal(parseEther('350'))
        expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal(parseEther('50'))
      })
    })

    describe('tokenValue != 1', () => {
      beforeEach(async () => {
        await lendingPoolCore.setReserveNormalizedIncome(parseEther('1500000000'))
        await token.connect(holder).transfer(sender.address, parseEther('100'))
      })

      it('sender with truereward enabled sends to recipient with truereward disabled', async () => {
        await token.connect(sender).enableTrueReward()
        await token.connect(sender).transfer(recipient.address, parseEther('50'))

        expect(await token.balanceOf(sender.address), 'sender').to.equal('49999999999999999999')
        expect(await token.balanceOf(recipient.address), 'recipient').to.equal('49999999999999999998')
        expect(await token.rewardTokenBalance(sender.address, financialOpportunity.address)).to.equal('33333333333333333333') // 50 / 1.5
        expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal('33333333333333333333')
        expect(await token.totalSupply()).to.equal('349999999999999999999')
        expect(await sharesToken.balanceOf(financialOpportunity.address), 'shares').to.equal('50000000000000000001')
      })

      it('holders with trudereward enabled transfer funds between each other', async () => {
        await token.connect(sender).enableTrueReward()
        await token.connect(recipient).enableTrueReward()
        await token.connect(sender).transfer(recipient.address, parseEther('50'))

        expect(await token.balanceOf(sender.address)).to.equal('49999999999999999999')
        expect(await token.balanceOf(recipient.address)).to.equal('49999999999999999999')
        expect(await token.rewardTokenBalance(sender.address, financialOpportunity.address)).to.equal('33333333333333333333')
        expect(await token.rewardTokenBalance(recipient.address, financialOpportunity.address)).to.equal('33333333333333333333')
        expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal('66666666666666666666')
        expect(await token.totalSupply()).to.equal('399999999999999999999')
        expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal('99999999999999999999')
      })

      it('sender with truereward disabled sends to recipient with truereward enabled', async () => {
        await token.connect(recipient).enableTrueReward()
        await token.connect(sender).transfer(recipient.address, parseEther('50'))

        expect(await token.balanceOf(sender.address)).to.equal(parseEther('50'))
        expect(await token.balanceOf(recipient.address)).to.equal('49999999999999999998')
        expect(await token.rewardTokenBalance(sender.address, financialOpportunity.address)).to.equal('0')
        expect(await token.rewardTokenBalance(recipient.address, financialOpportunity.address)).to.equal('33333333333333333332')
        expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal('33333333333333333332')
        expect(await token.totalSupply()).to.equal('349999999999999999998')
        expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal('49999999999999999999')
      })
    })

    describe('Aave earns interest', () => {
      beforeEach(async () => {
        await lendingPoolCore.setReserveNormalizedIncome(parseEther('1500000000'))
        await token.connect(holder).transfer(sender.address, parseEther('100'))
      })

      it('sender with truereward enabled sends to recipient with truereward disabled', async () => {
        await token.connect(sender).enableTrueReward()
        await lendingPoolCore.setReserveNormalizedIncome(parseEther('1600000000'))
        await token.connect(sender).transfer(recipient.address, parseEther('50'))

        expect(await token.balanceOf(sender.address)).to.equal('56666666666666666665') // (100/1.5)*1.6 - 50
        expect(await token.balanceOf(recipient.address)).to.equal(parseEther('50'))
        expect(await token.rewardTokenBalance(sender.address, financialOpportunity.address)).to.equal('35416666666666666666') // 56666666666666660000/1.6
        expect(await token.rewardTokenBalance(recipient.address, financialOpportunity.address)).to.equal('0')
        expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal('35416666666666666666')
        expect(await token.totalSupply()).to.equal('356666666666666666665')
        expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal('56666666666666666666')
      })

      it('holders with trudereward enabled transfer funds between each other', async () => {
        await token.connect(sender).enableTrueReward()
        await token.connect(recipient).enableTrueReward()
        await lendingPoolCore.setReserveNormalizedIncome(parseEther('1600000000'))
        await token.connect(sender).transfer(recipient.address, parseEther('50'))

        expect(await token.balanceOf(sender.address)).to.equal('56666666666666666665')
        expect(await token.balanceOf(recipient.address)).to.equal('50000000000000000000')
        expect(await token.rewardTokenBalance(sender.address, financialOpportunity.address)).to.equal('35416666666666666666')
        expect(await token.rewardTokenBalance(recipient.address, financialOpportunity.address)).to.equal('31250000000000000000')
        expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal('66666666666666666666')
        expect(await token.totalSupply()).to.equal('406666666666666666665')
        expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal('106666666666666666666')
      })

      it('sender with truereward disabled sends to recipient with truereward enabled', async () => {
        await token.connect(recipient).enableTrueReward()
        await lendingPoolCore.setReserveNormalizedIncome(parseEther('1600000000'))
        await token.connect(sender).transfer(recipient.address, parseEther('50'))

        expect(await token.balanceOf(sender.address)).to.equal(parseEther('50'))
        expect(await token.balanceOf(recipient.address)).to.equal(parseEther('50'))
        expect(await token.rewardTokenBalance(sender.address, financialOpportunity.address)).to.equal(0)
        expect(await token.rewardTokenBalance(recipient.address, financialOpportunity.address)).to.equal(parseEther('31.25')) // 31.25*1.6
        expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal(parseEther('31.25'))
        expect(await token.totalSupply()).to.equal(parseEther('350'))
        expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal(parseEther('50'))
      })
    })
  })

  describe('with Aave and AssuredFinancialOpportunity', () => {
    let lendingPoolCore: LendingPoolCoreMock
    let sharesToken: ATokenMock
    let aaveFinancialOpportunity: AaveFinancialOpportunity

    beforeEachWithFixture(async (provider, wallets) => {
      ([owner, holder, holder2, sender, recipient] = wallets)
      const deployContract = setupDeploy(owner)

      token = await deployContract(TrueUsdFactory, { gasLimit: 5_000_000 })

      const registry = await deployContract(RegistryMockFactory)
      const fractionalExponents = await deployContract(FractionalExponentsFactory)
      const liquidator = await deployContract(SimpleLiquidatorMockFactory, token.address)
      lendingPoolCore = await deployContract(LendingPoolCoreMockFactory)
      sharesToken = await deployContract(ATokenMockFactory, token.address, lendingPoolCore.address)
      const lendingPool = await deployContract(LendingPoolMockFactory, lendingPoolCore.address, sharesToken.address)

      await token.mint(liquidator.address, parseEther('1000'))
      await token.mint(holder.address, parseEther('300'))
      await token.setRegistry(registry.address)
      await token.connect(holder).transfer(sharesToken.address, parseEther('100'))
      await token.connect(holder).transfer(holder2.address, parseEther('100'))

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

      await registry.setAttributeValue(owner.address, WHITELIST_TRUEREWARD, 1)
      await registry.setAttributeValue(holder.address, WHITELIST_TRUEREWARD, 1)
      await registry.setAttributeValue(holder2.address, WHITELIST_TRUEREWARD, 1)
      await registry.setAttributeValue(sender.address, WHITELIST_TRUEREWARD, 1)
      await registry.setAttributeValue(recipient.address, WHITELIST_TRUEREWARD, 1)
    })

    it('account with 0 balance enables and disables trueReward', async () => {
      await token.connect(recipient).enableTrueReward()
      await token.connect(recipient).disableTrueReward()
    })

    it('holder enables truereward', async () => {
      expect(await sharesToken.balanceOf(aaveFinancialOpportunity.address)).to.equal(0)
      await token.connect(holder).enableTrueReward()

      expect(await financialOpportunity.tokenValue()).to.equal(parseEther('1'))
      expect(await sharesToken.balanceOf(aaveFinancialOpportunity.address)).to.equal(parseEther('100'))
      expect(await token.balanceOf(financialOpportunity.address)).to.equal(0)
      expect(await token.rewardTokenBalance(holder.address, financialOpportunity.address)).to.equal(parseEther('100'))
      expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal(parseEther('100'))
      expect(await token.totalSupply()).to.equal(parseEther('1400'))
      expect(await token.balanceOf(holder.address)).to.equal(parseEther('100'))
    })

    it('two holders enable truereward', async () => {
      await token.connect(holder).enableTrueReward()
      await token.connect(holder2).enableTrueReward()

      expect(await sharesToken.balanceOf(aaveFinancialOpportunity.address)).to.equal(parseEther('200'))
      expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal(parseEther('200'))
      expect(await token.totalSupply()).to.equal(parseEther('1500'))
    })

    it('holders balance increases after tokenValue increases', async () => {
      expect(await token.balanceOf(holder.address)).to.equal(parseEther('100'))
      await lendingPoolCore.setReserveNormalizedIncome(parseEther('1500000000'))
      await token.connect(holder).enableTrueReward()
      expect(await token.balanceOf(holder.address)).to.equal('99999999999999999999')
      await lendingPoolCore.setReserveNormalizedIncome(parseEther('1600000000'))
      expect(await token.balanceOf(holder.address)).to.equal('106666666666666666665')
    })

    it('holders with trudereward disabled transfer funds between each other', async () => {
      const asHolder = token.connect(holder)
      await asHolder.transfer(recipient.address, parseEther('42'))
      expect(await token.balanceOf(recipient.address)).to.equal(parseEther('42'))
      expect(await token.balanceOf(holder.address)).to.equal(parseEther('58'))
    })

    it('minting for account with trueReward enabled', async () => {
      await token.connect(sender).enableTrueReward()
      await token.mint(sender.address, parseEther('1.5'))
      expect(await token.balanceOf(sender.address)).to.equal(parseEther('1.5'))
      expect(await token.trueRewardEnabled(sender.address)).to.equal(true)
    })

    it('minting for account with trueReward enabled that had some mints before', async () => {
      await token.connect(holder).enableTrueReward()
      await token.mint(holder.address, parseEther('1.5'))
      expect(await token.balanceOf(holder.address)).to.equal(parseEther('101.5'))
      expect(await token.trueRewardEnabled(holder.address)).to.equal(true)
    })

    it('transfer to financial opportunity with trueReward enabled', async () => {
      await token.connect(holder).enableTrueReward()
      await token.connect(holder).transfer(financialOpportunity.address, 1)
      expect(await token.balanceOf(holder.address)).to.equal(parseEther('100').sub(1))
    })

    describe('tokenValue == 1', () => {
      beforeEach(async () => {
        await token.connect(holder).transfer(sender.address, parseEther('100'))
      })

      it('sender with truereward enabled sends to recipient with truereward disabled', async () => {
        await token.connect(sender).enableTrueReward()
        expect(await token.totalSupply()).to.equal(parseEther('1400'))

        await token.connect(sender).transfer(recipient.address, parseEther('50'))

        expect(await token.balanceOf(sender.address)).to.equal(parseEther('50'))
        expect(await token.balanceOf(recipient.address)).to.equal(parseEther('50'))
        expect(await token.rewardTokenBalance(sender.address, financialOpportunity.address)).to.equal(parseEther('50'))
        expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal(parseEther('50'))
        expect(await token.totalSupply()).to.equal(parseEther('1350'))
        expect(await sharesToken.balanceOf(aaveFinancialOpportunity.address)).to.equal(parseEther('50'))
      })

      it('holders with trudereward enabled transfer funds between each other', async () => {
        await token.connect(sender).enableTrueReward()
        await token.connect(recipient).enableTrueReward()
        await token.connect(sender).transfer(recipient.address, parseEther('50'))

        expect(await token.balanceOf(sender.address)).to.equal(parseEther('50'))
        expect(await token.balanceOf(recipient.address)).to.equal(parseEther('50'))
        expect(await token.rewardTokenBalance(sender.address, financialOpportunity.address)).to.equal(parseEther('50'))
        expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal(parseEther('100'))
        expect(await token.totalSupply()).to.equal(parseEther('1400'))
        expect(await sharesToken.balanceOf(aaveFinancialOpportunity.address)).to.equal(parseEther('100'))
      })

      it('sender with truereward disabled sends to recipient with truereward enabled', async () => {
        await token.connect(recipient).enableTrueReward()
        await token.connect(sender).transfer(recipient.address, parseEther('50'))

        expect(await token.balanceOf(sender.address)).to.equal(parseEther('50'))
        expect(await token.balanceOf(recipient.address)).to.equal(parseEther('50'))
        expect(await token.rewardTokenBalance(recipient.address, financialOpportunity.address)).to.equal(parseEther('50'))
        expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal(parseEther('50'))
        expect(await token.totalSupply()).to.equal(parseEther('1350'))
        expect(await sharesToken.balanceOf(aaveFinancialOpportunity.address)).to.equal(parseEther('50'))
      })
    })

    describe('tokenValue != 1', () => {
      beforeEach(async () => {
        await lendingPoolCore.setReserveNormalizedIncome(parseEther('1500000000'))
        await token.connect(holder).transfer(sender.address, parseEther('100'))
      })

      it('sender with truereward enabled sends to recipient with truereward disabled', async () => {
        await token.connect(sender).enableTrueReward()
        await token.connect(sender).transfer(recipient.address, parseEther('50'))

        expect(await token.balanceOf(sender.address), 'sender').to.equal('49999999999999999999')
        expect(await token.balanceOf(recipient.address), 'recipient').to.equal('49999999999999999999')
        expect(await token.rewardTokenBalance(sender.address, financialOpportunity.address)).to.equal('33333333333333333333') // 50 / 1.5
        expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal('33333333333333333333')
        expect(await token.totalSupply()).to.equal('1349999999999999999999')
        expect(await sharesToken.balanceOf(aaveFinancialOpportunity.address), 'shares').to.equal('50000000000000000001')
      })

      it('holders with trudereward enabled transfer funds between each other', async () => {
        await token.connect(sender).enableTrueReward()
        await token.connect(recipient).enableTrueReward()
        await token.connect(sender).transfer(recipient.address, parseEther('50'))

        expect(await token.balanceOf(sender.address)).to.equal('49999999999999999999')
        expect(await token.balanceOf(recipient.address)).to.equal('49999999999999999999')
        expect(await token.rewardTokenBalance(sender.address, financialOpportunity.address)).to.equal('33333333333333333333')
        expect(await token.rewardTokenBalance(recipient.address, financialOpportunity.address)).to.equal('33333333333333333333')
        expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal('66666666666666666666')
        expect(await token.totalSupply()).to.equal('1399999999999999999999')
        expect(await sharesToken.balanceOf(aaveFinancialOpportunity.address)).to.equal('99999999999999999999')
      })

      it('sender with truereward disabled sends to recipient with truereward enabled', async () => {
        await token.connect(recipient).enableTrueReward()
        await token.connect(sender).transfer(recipient.address, parseEther('50'))

        expect(await token.balanceOf(sender.address)).to.equal(parseEther('50'))
        expect(await token.balanceOf(recipient.address)).to.equal('49999999999999999999')
        expect(await token.rewardTokenBalance(sender.address, financialOpportunity.address)).to.equal('0')
        expect(await token.rewardTokenBalance(recipient.address, financialOpportunity.address)).to.equal('33333333333333333333')
        expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal('33333333333333333333')
        expect(await token.totalSupply()).to.equal('1349999999999999999999')
        expect(await sharesToken.balanceOf(aaveFinancialOpportunity.address)).to.equal('49999999999999999999')
      })
    })

    describe('Aave earns interest', () => {
      beforeEach(async () => {
        await lendingPoolCore.setReserveNormalizedIncome(parseEther('1500000000'))
        await token.connect(holder).transfer(sender.address, parseEther('100'))
      })

      it('sender with truereward enabled sends to recipient with truereward disabled', async () => {
        await token.connect(sender).enableTrueReward()
        await lendingPoolCore.setReserveNormalizedIncome(parseEther('1600000000'))
        await token.connect(sender).transfer(recipient.address, parseEther('50'))

        expect(await token.balanceOf(sender.address)).to.equal('56666666666666666665') // (100/1.5)*1.6 - 50
        expect(await token.balanceOf(recipient.address)).to.equal(parseEther('50'))
        expect(await token.rewardTokenBalance(sender.address, financialOpportunity.address)).to.equal('35416666666666666666') // 56666666666666660000/1.6
        expect(await token.rewardTokenBalance(recipient.address, financialOpportunity.address)).to.equal('0')
        expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal('35416666666666666666')
        expect(await token.totalSupply()).to.equal('1356666666666666666665')
        expect(await sharesToken.balanceOf(aaveFinancialOpportunity.address)).to.equal('56666666666666666666')
      })

      it('holders with trudereward enabled transfer funds between each other', async () => {
        await token.connect(sender).enableTrueReward()
        await token.connect(recipient).enableTrueReward()
        await lendingPoolCore.setReserveNormalizedIncome(parseEther('1600000000'))
        await token.connect(sender).transfer(recipient.address, parseEther('50'))

        expect(await token.balanceOf(sender.address)).to.equal('56666666666666666665')
        expect(await token.balanceOf(recipient.address)).to.equal('50000000000000000000')
        expect(await token.rewardTokenBalance(sender.address, financialOpportunity.address)).to.equal('35416666666666666666')
        expect(await token.rewardTokenBalance(recipient.address, financialOpportunity.address)).to.equal('31250000000000000000')
        expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal('66666666666666666666')
        expect(await token.totalSupply()).to.equal('1406666666666666666665')
        expect(await sharesToken.balanceOf(aaveFinancialOpportunity.address)).to.equal('106666666666666666666')
      })

      it('sender with truereward disabled sends to recipient with truereward enabled', async () => {
        await token.connect(recipient).enableTrueReward()
        await lendingPoolCore.setReserveNormalizedIncome(parseEther('1600000000'))
        await token.connect(sender).transfer(recipient.address, parseEther('50'))

        expect(await token.balanceOf(sender.address)).to.equal(parseEther('50'))
        expect(await token.balanceOf(recipient.address)).to.equal(parseEther('50'))
        expect(await token.rewardTokenBalance(sender.address, financialOpportunity.address)).to.equal(0)
        expect(await token.rewardTokenBalance(recipient.address, financialOpportunity.address)).to.equal(parseEther('31.25')) // 31.25*1.6
        expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal(parseEther('31.25'))
        expect(await token.totalSupply()).to.equal(parseEther('1350'))
        expect(await sharesToken.balanceOf(aaveFinancialOpportunity.address)).to.equal(parseEther('50'))
      })
    })

    describe('Transfers using reserve mechanism', () => {
      let reserveAddress: string

      beforeEach(async () => {
        reserveAddress = await token.RESERVE()
      })

      describe('sender with truereward enabled sends to recipient with truereward disabled', async () => {
        beforeEach(async () => {
          await token.connect(holder).transfer(sender.address, parseEther('40'))
          await token.connect(holder).transfer(reserveAddress, parseEther('60'))
          await token.connect(sender).enableTrueReward()
        })

        describe('tokenValue = 1', () => {
          it('total token supply should remain the same', async () => {
            expect(await token.totalSupply()).to.equal(parseEther('1340'))
            await token.connect(sender).transfer(recipient.address, parseEther('40'))
            expect(await token.totalSupply()).to.equal(parseEther('1340'))
          })

          it('token reserve should decrease', async () => {
            expect(await token.balanceOf(reserveAddress)).to.equal(parseEther('60'))
            await token.connect(sender).transfer(recipient.address, parseEther('40'))
            expect(await token.balanceOf(reserveAddress)).to.equal(parseEther('20'))
          })

          it('zToken reserve should increase', async () => {
            expect(await token.rewardTokenBalance(reserveAddress, financialOpportunity.address)).to.equal('0')
            await token.connect(sender).transfer(recipient.address, parseEther('40'))
            expect(await token.rewardTokenBalance(reserveAddress, financialOpportunity.address)).to.equal(parseEther('40'))
          })

          it('token balance of the sender should decrease', async () => {
            expect(await token.balanceOf(sender.address)).to.equal(parseEther('40'))
            await token.connect(sender).transfer(recipient.address, parseEther('40'))
            expect(await token.balanceOf(sender.address)).to.equal('0')
          })

          it('token balance of the recipient should increase', async () => {
            expect(await token.balanceOf(recipient.address)).to.equal('0')
            await token.connect(sender).transfer(recipient.address, parseEther('40'))
            expect(await token.balanceOf(recipient.address)).to.equal(parseEther('40'))
          })

          it('loan backed balance of the sender should decrease', async () => {
            expect(await token.rewardTokenBalance(sender.address, financialOpportunity.address)).to.equal(parseEther('40'))
            await token.connect(sender).transfer(recipient.address, parseEther('40'))
            expect(await token.rewardTokenBalance(sender.address, financialOpportunity.address)).to.equal('0')
          })

          it('loan backed balance of the recipient should remain the same', async () => {
            expect(await token.rewardTokenBalance(recipient.address, financialOpportunity.address)).to.equal('0')
            await token.connect(sender).transfer(recipient.address, parseEther('40'))
            expect(await token.rewardTokenBalance(recipient.address, financialOpportunity.address)).to.equal('0')
          })

          it('total aave supply should remain the same', async () => {
            expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal(parseEther('40'))
            await token.connect(sender).transfer(recipient.address, parseEther('40'))
            expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal(parseEther('40'))
          })

          it('balance of the shares token should remain the same', async () => {
            expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal('0')
            await token.connect(sender).transfer(recipient.address, parseEther('40'))
            expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal('0')
          })
        })

        describe('tokenValue != 1', () => {
          beforeEach(async () => {
            await lendingPoolCore.setReserveNormalizedIncome(parseEther('1500000000'))
          })

          it('total token supply should remain the same', async () => {
            expect(await token.totalSupply()).to.equal(parseEther('1360'))
            await token.connect(sender).transfer(recipient.address, parseEther('40'))
            expect(await token.totalSupply()).to.equal(parseEther('1360'))
          })

          it('token reserve should decrease', async () => {
            expect(await token.balanceOf(reserveAddress)).to.equal(parseEther('60'))
            await token.connect(sender).transfer(recipient.address, parseEther('40'))
            expect(await token.balanceOf(reserveAddress)).to.equal(parseEther('20'))
          })

          it('zToken reserve should increase', async () => {
            expect(await token.rewardTokenBalance(reserveAddress, financialOpportunity.address)).to.equal('0')
            await token.connect(sender).transfer(recipient.address, parseEther('30'))
            expect(await token.rewardTokenBalance(reserveAddress, financialOpportunity.address)).to.equal(parseEther('20'))
          })

          it('token balance of the sender should decrease', async () => {
            expect(await token.balanceOf(sender.address)).to.equal(parseEther('60'))
            await token.connect(sender).transfer(recipient.address, parseEther('60'))
            expect(await token.balanceOf(sender.address)).to.equal('0')
          })

          it('token balance of the recipient should increase', async () => {
            expect(await token.balanceOf(recipient.address)).to.equal('0')
            await token.connect(sender).transfer(recipient.address, parseEther('40'))
            expect(await token.balanceOf(recipient.address)).to.equal(parseEther('40'))
          })

          it('loan backed balance of the sender should decrease', async () => {
            expect(await token.rewardTokenBalance(sender.address, financialOpportunity.address)).to.equal(parseEther('40'))
            await token.connect(sender).transfer(recipient.address, parseEther('60'))
            expect(await token.rewardTokenBalance(sender.address, financialOpportunity.address)).to.equal('0')
          })

          it('loan backed balance of the recipient should remain the same', async () => {
            expect(await token.rewardTokenBalance(recipient.address, financialOpportunity.address)).to.equal('0')
            await token.connect(sender).transfer(recipient.address, parseEther('40'))
            expect(await token.rewardTokenBalance(recipient.address, financialOpportunity.address)).to.equal('0')
          })

          it('total aave supply should remain the same', async () => {
            expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal(parseEther('40'))
            await token.connect(sender).transfer(recipient.address, parseEther('40'))
            expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal(parseEther('40'))
          })

          it('balance of the shares token should remain the same', async () => {
            expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal('0')
            await token.connect(sender).transfer(recipient.address, parseEther('40'))
            expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal('0')
          })
        })
      })

      describe('sender with truereward disabled sends to recipient with truereward enabled', async () => {
        beforeEach(async () => {
          await token.connect(holder).transfer(recipient.address, parseEther('40'))
          await token.connect(holder).transfer(reserveAddress, parseEther('60'))
          await token.connect(recipient).enableTrueReward()
          await token.connect(recipient).transfer(sender.address, parseEther('40'))
        })

        describe('tokenValue = 1', () => {
          it('total token supply should remain the same', async () => {
            expect(await token.totalSupply()).to.equal(parseEther('1340'))
            await expect(token.connect(sender).transfer(recipient.address, parseEther('20'))).to.emit(token, 'SwapTokenForReward')
            expect(await token.totalSupply()).to.equal(parseEther('1340'))
          })

          it('token reserve should increase', async () => {
            expect(await token.balanceOf(reserveAddress)).to.equal(parseEther('20'))
            await token.connect(sender).transfer(recipient.address, parseEther('20'))
            expect(await token.balanceOf(reserveAddress)).to.equal(parseEther('40'))
          })

          it('zToken reserve should decrease', async () => {
            expect(await token.rewardTokenBalance(reserveAddress, financialOpportunity.address)).to.equal(parseEther('40'))
            await token.connect(sender).transfer(recipient.address, parseEther('20'))
            expect(await token.rewardTokenBalance(reserveAddress, financialOpportunity.address)).to.equal(parseEther('20'))
          })

          it('token balance of the sender should decrease', async () => {
            expect(await token.balanceOf(sender.address)).to.equal(parseEther('40'))
            await token.connect(sender).transfer(recipient.address, parseEther('20'))
            expect(await token.balanceOf(sender.address)).to.equal(parseEther('20'))
          })

          it('token balance of the recipient should increase', async () => {
            expect(await token.balanceOf(recipient.address)).to.equal('0')
            await token.connect(sender).transfer(recipient.address, parseEther('20'))
            expect(await token.balanceOf(recipient.address)).to.equal(parseEther('20'))
          })

          it('loan backed balance of the sender should remain the same', async () => {
            expect(await token.rewardTokenBalance(sender.address, financialOpportunity.address)).to.equal('0')
            await token.connect(sender).transfer(recipient.address, parseEther('20'))
            expect(await token.rewardTokenBalance(sender.address, financialOpportunity.address)).to.equal('0')
          })

          it('loan backed balance of the recipient should increase', async () => {
            expect(await token.rewardTokenBalance(recipient.address, financialOpportunity.address)).to.equal('0')
            await token.connect(sender).transfer(recipient.address, parseEther('20'))
            expect(await token.rewardTokenBalance(recipient.address, financialOpportunity.address)).to.equal(parseEther('20'))
          })

          it('total aave supply should remain the same', async () => {
            expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal(parseEther('40'))
            await token.connect(sender).transfer(recipient.address, parseEther('20'))
            expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal(parseEther('40'))
          })

          it('balance of the shares token should remain the same', async () => {
            expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal('0')
            await token.connect(sender).transfer(recipient.address, parseEther('20'))
            expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal('0')
          })
        })

        describe('tokenValue != 1', () => {
          beforeEach(async () => {
            await lendingPoolCore.setReserveNormalizedIncome(parseEther('1500000000'))
          })

          it('total token supply should remain the same', async () => {
            expect(await token.totalSupply()).to.equal(parseEther('1360'))
            await expect(token.connect(sender).transfer(recipient.address, parseEther('20'))).to.emit(token, 'SwapTokenForReward')
            expect(await token.totalSupply()).to.equal(parseEther('1360'))
          })

          it('token reserve should increase', async () => {
            expect(await token.balanceOf(reserveAddress)).to.equal(parseEther('20'))
            await token.connect(sender).transfer(recipient.address, parseEther('20'))
            expect(await token.balanceOf(reserveAddress)).to.equal(parseEther('40'))
          })

          it('zToken reserve should decrease', async () => {
            expect(await token.rewardTokenBalance(reserveAddress, financialOpportunity.address)).to.equal(parseEther('40'))
            await token.connect(sender).transfer(recipient.address, parseEther('30'))
            expect(await token.rewardTokenBalance(reserveAddress, financialOpportunity.address)).to.equal(parseEther('20'))
          })

          it('token balance of the sender should decrease', async () => {
            expect(await token.balanceOf(sender.address)).to.equal(parseEther('40'))
            await token.connect(sender).transfer(recipient.address, parseEther('20'))
            expect(await token.balanceOf(sender.address)).to.equal(parseEther('20'))
          })

          it('token balance of the recipient should increase', async () => {
            expect(await token.balanceOf(recipient.address)).to.equal('0')
            await token.connect(sender).transfer(recipient.address, parseEther('20'))
            expect(await token.balanceOf(recipient.address)).to.equal('19999999999999999999')
          })

          it('loan backed balance of the sender should remain the same', async () => {
            expect(await token.rewardTokenBalance(sender.address, financialOpportunity.address)).to.equal('0')
            await token.connect(sender).transfer(recipient.address, parseEther('20'))
            expect(await token.rewardTokenBalance(sender.address, financialOpportunity.address)).to.equal('0')
          })

          it('loan backed balance of the recipient should increase', async () => {
            expect(await token.rewardTokenBalance(recipient.address, financialOpportunity.address)).to.equal('0')
            await token.connect(sender).transfer(recipient.address, parseEther('30'))
            expect(await token.rewardTokenBalance(recipient.address, financialOpportunity.address)).to.equal(parseEther('20'))
          })

          it('total aave supply should remain the same', async () => {
            expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal(parseEther('40'))
            await token.connect(sender).transfer(recipient.address, parseEther('20'))
            expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal(parseEther('40'))
          })

          it('balance of the shares token should remain the same', async () => {
            expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal('0')
            await token.connect(sender).transfer(recipient.address, parseEther('20'))
            expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal('0')
          })
        })
      })
    })
  })
})
