import { expect, use } from 'chai'
import { Contract, Wallet } from 'ethers'
import { deployContract, solidity } from 'ethereum-waffle'
import { beforeEachWithFixture } from './utils'
import {
  AaveFinancialOpportunity,
  AssuredFinancialOpportunity,
  ATokenMock,
  ConfigurableFinancialOpportunityMock,
  FractionalExponents,
  LendingPoolCoreMock,
  LendingPoolMock,
  OwnedUpgradeabilityProxy,
  RegistryMock,
  SimpleLiquidatorMock,
  TrueUSD,
} from '../build'
import { parseEther } from 'ethers/utils'

use(solidity)

describe('TrueRewardBackedToken', () => {
  let owner: Wallet, holder: Wallet, holder2: Wallet, sender: Wallet, recipient: Wallet
  let token: Contract
  let financialOpportunity: Contract
  const mockPoolAddress = Wallet.createRandom().address

  describe('with AssuredFinancialOpportunity', () => {
    let configurableFinancialOpportunity: Contract

    beforeEachWithFixture(async (provider, wallets) => {
      ([owner, holder, holder2, sender, recipient] = wallets)

      token = await deployContract(owner, TrueUSD, [], { gasLimit: 5_000_000 })
      await token.mint(holder.address, parseEther('100'))

      const fractionalExponents = await deployContract(owner, FractionalExponents)
      const liquidator = await deployContract(owner, SimpleLiquidatorMock, [token.address])
      await token.mint(liquidator.address, parseEther('1000'))

      configurableFinancialOpportunity = await deployContract(owner, ConfigurableFinancialOpportunityMock, [token.address])
      await token.mint(configurableFinancialOpportunity.address, parseEther('100'))

      financialOpportunity = await deployContract(owner, AssuredFinancialOpportunity)
      await financialOpportunity.configure(
        configurableFinancialOpportunity.address,
        mockPoolAddress,
        liquidator.address,
        fractionalExponents.address,
        token.address,
        token.address,
      )
      await token.setFinOpAddress(financialOpportunity.address)
    })

    it('holder enables trueReward with 0 balance', async () => {
      expect(await token.trueRewardEnabled(holder2.address)).to.be.false
      await token.connect(holder2).enableTrueReward()
      expect(await token.trueRewardEnabled(holder2.address)).to.be.true
    })

    it('holder enables trueReward with 100 balance', async () => {
      await token.connect(holder).enableTrueReward()
      expect(await token.trueRewardEnabled(holder.address)).to.be.true
      expect(await token.accountTotalLoanBackedBalance(holder.address)).to.equal(parseEther('100'))
      expect(await token.finOpSupply()).to.equal(parseEther('100'))
      expect(await token.totalSupply()).to.equal(parseEther('1300'))
      expect(await token.balanceOf(holder.address)).to.equal(parseEther('100'))
    })

    it('holder disables trueReward', async () => {
      expect(await token.balanceOf(holder.address)).to.equal(parseEther('100'))
      await token.connect(holder).enableTrueReward()
      expect(await token.trueRewardEnabled(holder.address)).to.be.true
      await expect(token.connect(holder).disableTrueReward()).to.emit(financialOpportunity, 'withdrawToSuccess').withArgs(holder.address, parseEther('100'))
      expect(await token.trueRewardEnabled(holder.address)).to.be.false
      expect(await token.accountTotalLoanBackedBalance(holder.address)).to.equal(0)
      expect(await token.finOpSupply()).to.equal(0)
      expect(await token.totalSupply()).to.equal(parseEther('1200'))
      expect(await token.balanceOf(holder.address)).to.equal(parseEther('100'))
    })
  })

  describe('with Aave', () => {
    let sharesToken: Contract
    let lendingPoolCore: Contract
    let lendingPool: Contract

    beforeEachWithFixture(async (provider, wallets) => {
      ([owner, holder, holder2, sender, recipient] = wallets)
      const registry = await deployContract(owner, RegistryMock)
      token = await deployContract(owner, TrueUSD, [], { gasLimit: 5_000_000 })

      await token.mint(holder.address, parseEther('300'))
      await token.setRegistry(registry.address)
      lendingPoolCore = await deployContract(owner, LendingPoolCoreMock)
      sharesToken = await deployContract(owner, ATokenMock, [token.address, lendingPoolCore.address])
      lendingPool = await deployContract(owner, LendingPoolMock, [lendingPoolCore.address, sharesToken.address])

      await token.connect(holder).transfer(sharesToken.address, parseEther('100'))
      await token.connect(holder).transfer(holder2.address, parseEther('100'))

      const financialOpportunityImpl = await deployContract(owner, AaveFinancialOpportunity)
      const financialOpportunityProxy = await deployContract(owner, OwnedUpgradeabilityProxy)
      financialOpportunity = financialOpportunityImpl.attach(financialOpportunityProxy.address)
      await financialOpportunityProxy.upgradeTo(financialOpportunityImpl.address)
      await financialOpportunity.configure(sharesToken.address, lendingPool.address, token.address, token.address)
      await token.setFinOpAddress(financialOpportunity.address)
    })

    it('holder enables truereward', async () => {
      expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal(0)
      await token.connect(holder).enableTrueReward()
      expect(await financialOpportunity.perTokenValue()).to.equal(parseEther('1'))
      expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal(parseEther('100'))
      expect(await token.balanceOf(financialOpportunity.address)).to.equal(0)
      expect(await token.accountTotalLoanBackedBalance(holder.address)).to.equal(parseEther('100'))
      expect(await token.finOpSupply()).to.equal(parseEther('100'))
      expect(await token.totalSupply()).to.equal(parseEther('400'))
      expect(await token.balanceOf(holder.address)).to.equal(parseEther('100'))
    })

    it('two holderss enable truereward', async () => {
      await token.connect(holder).enableTrueReward()
      await token.connect(holder2).enableTrueReward()
      expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal(parseEther('200'))
      expect(await token.finOpSupply()).to.equal(parseEther('200'))
      expect(await token.totalSupply()).to.equal(parseEther('500'))
    })

    it('holders balance increases after perTokenValue increases', async () => {
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

    describe('perTokenValue == 1', () => {
      beforeEach(async () => {
        await token.connect(holder).transfer(sender.address, parseEther('100'))
      })

      it('sender with truereward enabled sends to recipient with truereward disabled', async () => {
        await token.connect(sender).enableTrueReward()
        expect(await token.totalSupply()).to.equal(parseEther('400'))

        await token.connect(sender).transfer(recipient.address, parseEther('50'))

        expect(await token.balanceOf(sender.address)).to.equal(parseEther('50'))
        expect(await token.balanceOf(recipient.address)).to.equal(parseEther('50'))
        expect(await token.accountTotalLoanBackedBalance(sender.address)).to.equal(parseEther('50'))
        expect(await token.finOpSupply()).to.equal(parseEther('50'))
        expect(await token.totalSupply()).to.equal(parseEther('350'))
        expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal(parseEther('50'))
      })

      it('holders with trudereward enabled transfer funds between each other', async () => {
        await token.connect(sender).enableTrueReward()
        await token.connect(recipient).enableTrueReward()
        await token.connect(sender).transfer(recipient.address, parseEther('50'))

        expect(await token.balanceOf(sender.address)).to.equal(parseEther('50'))
        expect(await token.balanceOf(recipient.address)).to.equal(parseEther('50'))
        expect(await token.accountTotalLoanBackedBalance(sender.address)).to.equal(parseEther('50'))
        expect(await token.finOpSupply()).to.equal(parseEther('100'))
        expect(await token.totalSupply()).to.equal(parseEther('400'))
        expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal(parseEther('100'))
      })

      it('sender with truereward disabled sends to recipient with truereward enabled', async () => {
        await token.connect(recipient).enableTrueReward()
        await token.connect(sender).transfer(recipient.address, parseEther('50'))

        expect(await token.balanceOf(sender.address)).to.equal(parseEther('50'))
        expect(await token.balanceOf(recipient.address)).to.equal(parseEther('50'))
        expect(await token.accountTotalLoanBackedBalance(recipient.address)).to.equal(parseEther('50'))
        expect(await token.finOpSupply()).to.equal(parseEther('50'))
        expect(await token.totalSupply()).to.equal(parseEther('350'))
        expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal(parseEther('50'))
      })
    })

    describe('perTokenValue != 1', () => {
      beforeEach(async () => {
        await lendingPoolCore.setReserveNormalizedIncome(parseEther('1500000000'))
        await token.connect(holder).transfer(sender.address, parseEther('100'))
      })

      it('sender with truereward enabled sends to recipient with truereward disabled', async () => {
        await token.connect(sender).enableTrueReward()
        await token.connect(sender).transfer(recipient.address, parseEther('50'))

        expect(await token.balanceOf(sender.address), 'sender').to.equal('50000000000000000001')
        expect(await token.balanceOf(recipient.address), 'recipient').to.equal('49999999999999999999')
        expect(await token.accountTotalLoanBackedBalance(sender.address)).to.equal('33333333333333333334') // 50 / 1.5
        expect(await token.finOpSupply()).to.equal('33333333333333333334')
        expect(await token.totalSupply()).to.equal('350000000000000000001')
        expect(await sharesToken.balanceOf(financialOpportunity.address), 'shares').to.equal('49999999999999999999')
      })

      it('holders with trudereward enabled transfer funds between each other', async () => {
        await token.connect(sender).enableTrueReward()
        await token.connect(recipient).enableTrueReward()
        await token.connect(sender).transfer(recipient.address, parseEther('50'))

        expect(await token.balanceOf(sender.address)).to.equal('49999999999999999999')
        expect(await token.balanceOf(recipient.address)).to.equal('49999999999999999999')
        expect(await token.accountTotalLoanBackedBalance(sender.address)).to.equal('33333333333333333333')
        expect(await token.accountTotalLoanBackedBalance(recipient.address)).to.equal('33333333333333333333')
        expect(await token.finOpSupply()).to.equal('66666666666666666666')
        expect(await token.totalSupply()).to.equal('399999999999999999999')
        expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal('99999999999999999999')
      })

      it('sender with truereward disabled sends to recipient with truereward enabled', async () => {
        await token.connect(recipient).enableTrueReward()
        await token.connect(sender).transfer(recipient.address, parseEther('50'))

        expect(await token.balanceOf(sender.address)).to.equal(parseEther('50'))
        expect(await token.balanceOf(recipient.address)).to.equal('49999999999999999998')
        expect(await token.accountTotalLoanBackedBalance(sender.address)).to.equal('0')
        expect(await token.accountTotalLoanBackedBalance(recipient.address)).to.equal('33333333333333333332')
        expect(await token.finOpSupply()).to.equal('33333333333333333332')
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
        expect(await token.accountTotalLoanBackedBalance(sender.address)).to.equal('35416666666666666666') // 56666666666666660000/1.6
        expect(await token.accountTotalLoanBackedBalance(recipient.address)).to.equal('0')
        expect(await token.finOpSupply()).to.equal('35416666666666666666')
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
        expect(await token.accountTotalLoanBackedBalance(sender.address)).to.equal('35416666666666666666')
        expect(await token.accountTotalLoanBackedBalance(recipient.address)).to.equal('31250000000000000000')
        expect(await token.finOpSupply()).to.equal('66666666666666666666')
        expect(await token.totalSupply()).to.equal('406666666666666666665')
        expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal('106666666666666666666')
      })

      it('sender with truereward disabled sends to recipient with truereward enabled', async () => {
        await token.connect(recipient).enableTrueReward()
        await lendingPoolCore.setReserveNormalizedIncome(parseEther('1600000000'))
        await token.connect(sender).transfer(recipient.address, parseEther('50'))

        expect(await token.balanceOf(sender.address)).to.equal(parseEther('50'))
        expect(await token.balanceOf(recipient.address)).to.equal(parseEther('50'))
        expect(await token.accountTotalLoanBackedBalance(sender.address)).to.equal(0)
        expect(await token.accountTotalLoanBackedBalance(recipient.address)).to.equal(parseEther('31.25')) // 31.25*1.6
        expect(await token.finOpSupply()).to.equal(parseEther('31.25'))
        expect(await token.totalSupply()).to.equal(parseEther('350'))
        expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal(parseEther('50'))
      })
    })
  })

  describe('with Aave and AssuredFinancialOpportunity', () => {
    let lendingPoolCore: Contract
    let sharesToken: Contract
    let aaveFinancialOpportunity: Contract

    beforeEachWithFixture(async (provider, wallets) => {
      ([owner, holder, holder2, sender, recipient] = wallets)

      token = await deployContract(owner, TrueUSD, [], { gasLimit: 5_000_000 })

      const registry = await deployContract(owner, RegistryMock)
      const fractionalExponents = await deployContract(owner, FractionalExponents)
      const liquidator = await deployContract(owner, SimpleLiquidatorMock, [token.address])
      lendingPoolCore = await deployContract(owner, LendingPoolCoreMock)
      sharesToken = await deployContract(owner, ATokenMock, [token.address, lendingPoolCore.address])
      const lendingPool = await deployContract(owner, LendingPoolMock, [lendingPoolCore.address, sharesToken.address])

      await token.mint(liquidator.address, parseEther('1000'))
      await token.mint(holder.address, parseEther('300'))
      await token.setRegistry(registry.address)
      await token.connect(holder).transfer(sharesToken.address, parseEther('100'))
      await token.connect(holder).transfer(holder2.address, parseEther('100'))

      const aaveFinancialOpportunityImpl = await deployContract(owner, AaveFinancialOpportunity)
      const aaveFinancialOpportunityProxy = await deployContract(owner, OwnedUpgradeabilityProxy)
      aaveFinancialOpportunity = aaveFinancialOpportunityImpl.attach(aaveFinancialOpportunityProxy.address)
      await aaveFinancialOpportunityProxy.upgradeTo(aaveFinancialOpportunityImpl.address)

      financialOpportunity = await deployContract(owner, AssuredFinancialOpportunity)

      await aaveFinancialOpportunity.configure(sharesToken.address, lendingPool.address, token.address, financialOpportunity.address)
      await financialOpportunity.configure(
        aaveFinancialOpportunity.address,
        mockPoolAddress,
        liquidator.address,
        fractionalExponents.address,
        token.address,
        token.address,
      )

      await token.setFinOpAddress(financialOpportunity.address)
    })

    it('holder enables truereward', async () => {
      expect(await sharesToken.balanceOf(aaveFinancialOpportunity.address)).to.equal(0)
      await token.connect(holder).enableTrueReward()

      expect(await financialOpportunity.perTokenValue()).to.equal(parseEther('1'))
      expect(await sharesToken.balanceOf(aaveFinancialOpportunity.address)).to.equal(parseEther('100'))
      expect(await token.balanceOf(financialOpportunity.address)).to.equal(0)
      expect(await token.accountTotalLoanBackedBalance(holder.address)).to.equal(parseEther('100'))
      expect(await token.finOpSupply()).to.equal(parseEther('100'))
      expect(await token.totalSupply()).to.equal(parseEther('1400'))
      expect(await token.balanceOf(holder.address)).to.equal(parseEther('100'))
    })

    it('two holderss enable truereward', async () => {
      await token.connect(holder).enableTrueReward()
      await token.connect(holder2).enableTrueReward()

      expect(await sharesToken.balanceOf(aaveFinancialOpportunity.address)).to.equal(parseEther('200'))
      expect(await token.finOpSupply()).to.equal(parseEther('200'))
      expect(await token.totalSupply()).to.equal(parseEther('1500'))
    })

    it('holders balance increases after perTokenValue increases', async () => {
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

    describe('perTokenValue == 1', () => {
      beforeEach(async () => {
        await token.connect(holder).transfer(sender.address, parseEther('100'))
      })

      it('sender with truereward enabled sends to recipient with truereward disabled', async () => {
        await token.connect(sender).enableTrueReward()
        expect(await token.totalSupply()).to.equal(parseEther('1400'))

        await token.connect(sender).transfer(recipient.address, parseEther('50'))

        expect(await token.balanceOf(sender.address)).to.equal(parseEther('50'))
        expect(await token.balanceOf(recipient.address)).to.equal(parseEther('50'))
        expect(await token.accountTotalLoanBackedBalance(sender.address)).to.equal(parseEther('50'))
        expect(await token.finOpSupply()).to.equal(parseEther('50'))
        expect(await token.totalSupply()).to.equal(parseEther('1350'))
        expect(await sharesToken.balanceOf(aaveFinancialOpportunity.address)).to.equal(parseEther('50'))
      })

      it('holders with trudereward enabled transfer funds between each other', async () => {
        await token.connect(sender).enableTrueReward()
        await token.connect(recipient).enableTrueReward()
        await token.connect(sender).transfer(recipient.address, parseEther('50'))

        expect(await token.balanceOf(sender.address)).to.equal(parseEther('50'))
        expect(await token.balanceOf(recipient.address)).to.equal(parseEther('50'))
        expect(await token.accountTotalLoanBackedBalance(sender.address)).to.equal(parseEther('50'))
        expect(await token.finOpSupply()).to.equal(parseEther('100'))
        expect(await token.totalSupply()).to.equal(parseEther('1400'))
        expect(await sharesToken.balanceOf(aaveFinancialOpportunity.address)).to.equal(parseEther('100'))
      })

      it('sender with truereward disabled sends to recipient with truereward enabled', async () => {
        await token.connect(recipient).enableTrueReward()
        await token.connect(sender).transfer(recipient.address, parseEther('50'))

        expect(await token.balanceOf(sender.address)).to.equal(parseEther('50'))
        expect(await token.balanceOf(recipient.address)).to.equal(parseEther('50'))
        expect(await token.accountTotalLoanBackedBalance(recipient.address)).to.equal(parseEther('50'))
        expect(await token.finOpSupply()).to.equal(parseEther('50'))
        expect(await token.totalSupply()).to.equal(parseEther('1350'))
        expect(await sharesToken.balanceOf(aaveFinancialOpportunity.address)).to.equal(parseEther('50'))
      })
    })

    describe('perTokenValue != 1', () => {
      beforeEach(async () => {
        await lendingPoolCore.setReserveNormalizedIncome(parseEther('1500000000'))
        await token.connect(holder).transfer(sender.address, parseEther('100'))
      })

      it('sender with truereward enabled sends to recipient with truereward disabled', async () => {
        await token.connect(sender).enableTrueReward()
        await token.connect(sender).transfer(recipient.address, parseEther('50'))

        expect(await token.balanceOf(sender.address), 'sender').to.equal('50000000000000000001')
        expect(await token.balanceOf(recipient.address), 'recipient').to.equal('49999999999999999999')
        expect(await token.accountTotalLoanBackedBalance(sender.address)).to.equal('33333333333333333334') // 50 / 1.5
        expect(await token.finOpSupply()).to.equal('33333333333333333334')
        expect(await token.totalSupply()).to.equal('1350000000000000000001')
        expect(await sharesToken.balanceOf(aaveFinancialOpportunity.address), 'shares').to.equal('49999999999999999999')
      })

      it('holders with trudereward enabled transfer funds between each other', async () => {
        await token.connect(sender).enableTrueReward()
        await token.connect(recipient).enableTrueReward()
        await token.connect(sender).transfer(recipient.address, parseEther('50'))

        expect(await token.balanceOf(sender.address)).to.equal('49999999999999999999')
        expect(await token.balanceOf(recipient.address)).to.equal('49999999999999999999')
        expect(await token.accountTotalLoanBackedBalance(sender.address)).to.equal('33333333333333333333')
        expect(await token.accountTotalLoanBackedBalance(recipient.address)).to.equal('33333333333333333333')
        expect(await token.finOpSupply()).to.equal('66666666666666666666')
        expect(await token.totalSupply()).to.equal('1399999999999999999999')
        expect(await sharesToken.balanceOf(aaveFinancialOpportunity.address)).to.equal('99999999999999999999')
      })

      it('sender with truereward disabled sends to recipient with truereward enabled', async () => {
        await token.connect(recipient).enableTrueReward()
        await token.connect(sender).transfer(recipient.address, parseEther('50'))

        expect(await token.balanceOf(sender.address)).to.equal(parseEther('50'))
        expect(await token.balanceOf(recipient.address)).to.equal('49999999999999999999')
        expect(await token.accountTotalLoanBackedBalance(sender.address)).to.equal('0')
        expect(await token.accountTotalLoanBackedBalance(recipient.address)).to.equal('33333333333333333333')
        expect(await token.finOpSupply()).to.equal('33333333333333333333')
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
        expect(await token.accountTotalLoanBackedBalance(sender.address)).to.equal('35416666666666666666') // 56666666666666660000/1.6
        expect(await token.accountTotalLoanBackedBalance(recipient.address)).to.equal('0')
        expect(await token.finOpSupply()).to.equal('35416666666666666666')
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
        expect(await token.accountTotalLoanBackedBalance(sender.address)).to.equal('35416666666666666666')
        expect(await token.accountTotalLoanBackedBalance(recipient.address)).to.equal('31250000000000000000')
        expect(await token.finOpSupply()).to.equal('66666666666666666666')
        expect(await token.totalSupply()).to.equal('1406666666666666666665')
        expect(await sharesToken.balanceOf(aaveFinancialOpportunity.address)).to.equal('106666666666666666666')
      })

      it('sender with truereward disabled sends to recipient with truereward enabled', async () => {
        await token.connect(recipient).enableTrueReward()
        await lendingPoolCore.setReserveNormalizedIncome(parseEther('1600000000'))
        await token.connect(sender).transfer(recipient.address, parseEther('50'))

        expect(await token.balanceOf(sender.address)).to.equal(parseEther('50'))
        expect(await token.balanceOf(recipient.address)).to.equal(parseEther('50'))
        expect(await token.accountTotalLoanBackedBalance(sender.address)).to.equal(0)
        expect(await token.accountTotalLoanBackedBalance(recipient.address)).to.equal(parseEther('31.25')) // 31.25*1.6
        expect(await token.finOpSupply()).to.equal(parseEther('31.25'))
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
          expect(await token.zTUSDReserveBalance()).to.equal('0')
          await token.connect(sender).transfer(recipient.address, parseEther('40'))
          expect(await token.zTUSDReserveBalance()).to.equal(parseEther('40'))
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
          expect(await token.accountTotalLoanBackedBalance(sender.address)).to.equal(parseEther('40'))
          await token.connect(sender).transfer(recipient.address, parseEther('40'))
          expect(await token.accountTotalLoanBackedBalance(sender.address)).to.equal('0')
        })

        it('loan backed balance of the recipient should remain the same', async () => {
          expect(await token.accountTotalLoanBackedBalance(recipient.address)).to.equal('0')
          await token.connect(sender).transfer(recipient.address, parseEther('40'))
          expect(await token.accountTotalLoanBackedBalance(recipient.address)).to.equal('0')
        })

        it('total aave supply should remain the same', async () => {
          expect(await token.finOpSupply()).to.equal(parseEther('40'))
          await token.connect(sender).transfer(recipient.address, parseEther('40'))
          expect(await token.finOpSupply()).to.equal(parseEther('40'))
        })

        it('balance of the shares token should remain the same', async () => {
          expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal('0')
          await token.connect(sender).transfer(recipient.address, parseEther('40'))
          expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal('0')
        })
      })

      describe('sender with truereward disabled sends to recipient with truereward enabled', async () => {
        beforeEach(async () => {
          await token.connect(holder).transfer(recipient.address, parseEther('40'))
          await token.connect(holder).transfer(reserveAddress, parseEther('60'))
          await token.connect(recipient).enableTrueReward()
          await token.connect(recipient).transfer(sender.address, parseEther('40'))
        })

        it('total token supply should remain the same', async () => {
          expect(await token.totalSupply()).to.equal(parseEther('1340'))
          await token.connect(sender).transfer(recipient.address, parseEther('20'))
          expect(await token.totalSupply()).to.equal(parseEther('1340'))
        })

        it('token reserve should increase', async () => {
          expect(await token.balanceOf(reserveAddress)).to.equal(parseEther('20'))
          await token.connect(sender).transfer(recipient.address, parseEther('20'))
          expect(await token.balanceOf(reserveAddress)).to.equal(parseEther('40'))
        })

        it('zToken reserve should decrease', async () => {
          expect(await token.zTUSDReserveBalance()).to.equal(parseEther('40'))
          await token.connect(sender).transfer(recipient.address, parseEther('20'))
          expect(await token.zTUSDReserveBalance()).to.equal(parseEther('20'))
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
          expect(await token.accountTotalLoanBackedBalance(sender.address)).to.equal('0')
          await token.connect(sender).transfer(recipient.address, parseEther('20'))
          expect(await token.accountTotalLoanBackedBalance(sender.address)).to.equal('0')
        })

        it('loan backed balance of the recipient should increase', async () => {
          expect(await token.accountTotalLoanBackedBalance(recipient.address)).to.equal('0')
          await token.connect(sender).transfer(recipient.address, parseEther('20'))
          expect(await token.accountTotalLoanBackedBalance(recipient.address)).to.equal(parseEther('20'))
        })

        it('total aave supply should remain the same', async () => {
          expect(await token.finOpSupply()).to.equal(parseEther('40'))
          await token.connect(sender).transfer(recipient.address, parseEther('20'))
          expect(await token.finOpSupply()).to.equal(parseEther('40'))
        })

        it('balance of the shares token should remain the same', async () => {
          expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal('0')
          await token.connect(sender).transfer(recipient.address, parseEther('20'))
          expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal('0')
        })
      })
    })

    /**
     * Note: See magic numbers explanation in AssuredFinancialOpportunity tests
     */
    describe('award amount', () => {
      it('0 when reward basis is 100%', async () => {
        await token.connect(holder).enableTrueReward()
        await lendingPoolCore.setReserveNormalizedIncome(parseEther('1500000000'))

        expect(await financialOpportunity.awardAmount()).to.eq(0)
      })

      it('properly calculated when reward basis is 70%', async () => {
        await token.connect(holder).enableTrueReward()
        await financialOpportunity.setRewardBasis(0.7 * 1000)
        await lendingPoolCore.setReserveNormalizedIncome(parseEther('1500000000'))

        expect(await financialOpportunity.awardAmount()).to.equal('17179876005666582700')
      })
    })

    describe('award pool', () => {
      beforeEach(async () => {
        await token.connect(holder).enableTrueReward()
      })

      it('awards 0 when reward basis is 100%', async () => {
        await lendingPoolCore.setReserveNormalizedIncome(parseEther('1500000000'))
        await financialOpportunity.awardPool()

        expect(await token.balanceOf(mockPoolAddress)).to.equal(0)
        expect(await aaveFinancialOpportunity.getBalance()).to.equal(parseEther('150'))
      })

      it('awards proper amount', async () => {
        await financialOpportunity.setRewardBasis(0.7 * 1000)
        await lendingPoolCore.setReserveNormalizedIncome(parseEther('1500000000'))

        expect(await token.balanceOf(mockPoolAddress)).to.equal(parseEther('0'))
        expect(await financialOpportunity.getBalance()).to.equal('132820123994333417300')
        expect((await financialOpportunity.getBalance()).div(await financialOpportunity.perTokenValue())).to.equal('100')

        await expect(financialOpportunity.awardPool()).to.emit(financialOpportunity, 'awardPoolSuccess').withArgs('11453250670444388466')

        expect(await token.balanceOf(mockPoolAddress)).to.equal('17179876005666582699')
        expect(await financialOpportunity.getBalance()).to.equal('132820123994333417300')
      })

      it('awards 0 on subsequent calls', async () => {
        await financialOpportunity.setRewardBasis(0.7 * 1000)
        await lendingPoolCore.setReserveNormalizedIncome(parseEther('1500000000'))

        await financialOpportunity.awardPool()

        expect(await financialOpportunity.awardAmount()).to.equal(0)
        await financialOpportunity.awardPool()
        expect(await token.balanceOf(mockPoolAddress)).to.equal('17179876005666582699')
        expect(await financialOpportunity.getBalance()).to.equal('132820123994333417300')
      })

      it('awards proper amount when per token value increases between calls', async () => {
        await financialOpportunity.setRewardBasis(0.7 * 1000)
        await lendingPoolCore.setReserveNormalizedIncome(parseEther('1500000000'))

        const firstTUsdAmount = '11453250670444388466' // 100 * (1.5 - 1.5 ^ 0.7) / 1.5
        const secondTUsdAmount = '12580970036318224093' // 100 * (2.5 - 2.5 ^ 0.7) / 2.5 - firstTUsdAmount

        await expect(financialOpportunity.awardPool()).to.emit(financialOpportunity, 'awardPoolSuccess').withArgs(firstTUsdAmount)
        await lendingPoolCore.setReserveNormalizedIncome(parseEther('2500000000'))
        await expect(financialOpportunity.awardPool()).to.emit(financialOpportunity, 'awardPoolSuccess').withArgs(secondTUsdAmount)

        // 1 wei error
        expect(await token.balanceOf(mockPoolAddress)).to.equal('48632301096462142932') // firstTUsdAmount * 1.5 + secondTUsdAmount * 2.5
        expect(await aaveFinancialOpportunity.getBalance()).to.equal('189914448233093468600') // (100 - firstTUsdAmount - secondTUsdAmount) * 2.5
      })

      it('no additional awards when reward basis changes between calls', async () => {
        await financialOpportunity.setRewardBasis(0.7 * 1000)
        await lendingPoolCore.setReserveNormalizedIncome(parseEther('1500000000'))

        await financialOpportunity.awardPool()
        await financialOpportunity.setRewardBasis(0.5 * 1000)

        expect(await financialOpportunity.awardAmount()).to.equal(0)
        await financialOpportunity.awardPool()

        expect(await token.balanceOf(mockPoolAddress)).to.equal('17179876005666582699')
        expect(await financialOpportunity.getBalance()).to.equal('132820123994333417300')
      })

      it('does NOT revert if the withdrawal fails', async () => {
        await financialOpportunity.setRewardBasis(0.7 * 1000)
        await lendingPoolCore.setReserveNormalizedIncome(parseEther('20000000000')) // 20x

        await financialOpportunity.awardPool()

        expect(await token.balanceOf(mockPoolAddress)).to.equal(0)
        expect(await aaveFinancialOpportunity.getBalance()).to.equal(parseEther('2000'))
      })

      it('anyone can call', async () => {
        await financialOpportunity.setRewardBasis(0.7 * 1000)
        await lendingPoolCore.setReserveNormalizedIncome(parseEther('1500000000'))

        await financialOpportunity.connect(holder).awardPool()

        expect(await token.balanceOf(mockPoolAddress)).to.equal('17179876005666582699')
        expect(await financialOpportunity.getBalance()).to.equal('132820123994333417300')
      })
    })
  })
})
})
