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
  let owner: Wallet, holder: Wallet, holder2: Wallet, sender: Wallet, receipient: Wallet
  let token: Contract
  let financialOpportunity: Contract
  let configurableFinancialOpportunity: Contract

  describe('with AssuredFinancialOpportunity', () => {
    const mockPoolAddress = Wallet.createRandom().address

    beforeEachWithFixture(async (provider, wallets) => {
      ([owner, holder, holder2, sender, receipient] = wallets)

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
      await token.setAaveInterfaceAddress(financialOpportunity.address)
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
      expect(await token.totalAaveSupply()).to.equal(parseEther('100'))
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
      expect(await token.totalAaveSupply()).to.equal(0)
      expect(await token.totalSupply()).to.equal(parseEther('1200'))
      expect(await token.balanceOf(holder.address)).to.equal(parseEther('100'))
    })
  })

  describe('with Aave', () => {
    let sharesToken: Contract
    let lendingPoolCore: Contract
    let lendingPool: Contract

    beforeEachWithFixture(async (provider, wallets) => {
      ([owner, holder, holder2, sender, receipient] = wallets)
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
      await token.setAaveInterfaceAddress(financialOpportunity.address)
    })

    it('holder enables truereward', async () => {
      expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal(0)
      await token.connect(holder).enableTrueReward()
      expect(await financialOpportunity.perTokenValue()).to.equal(parseEther('1'))
      expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal(parseEther('100'))
      expect(await token.balanceOf(financialOpportunity.address)).to.equal(0)
      expect(await token.accountTotalLoanBackedBalance(holder.address)).to.equal(parseEther('100'))
      expect(await token.totalAaveSupply()).to.equal(parseEther('100'))
      expect(await token.totalSupply()).to.equal(parseEther('400'))
      expect(await token.balanceOf(holder.address)).to.equal(parseEther('100'))
    })

    it('two holderss enable truereward', async () => {
      await token.connect(holder).enableTrueReward()
      await token.connect(holder2).enableTrueReward()
      expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal(parseEther('200'))
      expect(await token.totalAaveSupply()).to.equal(parseEther('200'))
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
      await asHolder.transfer(receipient.address, parseEther('42'))
      expect(await token.balanceOf(receipient.address)).to.equal(parseEther('42'))
      expect(await token.balanceOf(holder.address)).to.equal(parseEther('58'))
    })

    describe('perTokenValue == 1', () => {
      beforeEach(async () => {
        await token.connect(holder).transfer(sender.address, parseEther('100'))
      })

      it('sender with truereward enabled sends to receipient with truereward disabled', async () => {
        await token.connect(sender).enableTrueReward()
        expect(await token.totalSupply()).to.equal(parseEther('400'))

        await token.connect(sender).transfer(receipient.address, parseEther('50'))

        expect(await token.balanceOf(sender.address)).to.equal(parseEther('50'))
        expect(await token.balanceOf(receipient.address)).to.equal(parseEther('50'))
        expect(await token.accountTotalLoanBackedBalance(sender.address)).to.equal(parseEther('50'))
        expect(await token.totalAaveSupply()).to.equal(parseEther('50'))
        expect(await token.totalSupply()).to.equal(parseEther('350'))
        expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal(parseEther('50'))
      })

      it('holders with trudereward enabled transfer funds between each other', async () => {
        await token.connect(sender).enableTrueReward()
        await token.connect(receipient).enableTrueReward()
        await token.connect(sender).transfer(receipient.address, parseEther('50'))

        expect(await token.balanceOf(sender.address)).to.equal(parseEther('50'))
        expect(await token.balanceOf(receipient.address)).to.equal(parseEther('50'))
        expect(await token.accountTotalLoanBackedBalance(sender.address)).to.equal(parseEther('50'))
        expect(await token.totalAaveSupply()).to.equal(parseEther('100'))
        expect(await token.totalSupply()).to.equal(parseEther('400'))
        expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal(parseEther('100'))
      })

      it('sender with truereward disabled sends to receipient with truereward enabled', async () => {
        await token.connect(receipient).enableTrueReward()
        await token.connect(sender).transfer(receipient.address, parseEther('50'))

        expect(await token.balanceOf(sender.address)).to.equal(parseEther('50'))
        expect(await token.balanceOf(receipient.address)).to.equal(parseEther('50'))
        expect(await token.accountTotalLoanBackedBalance(receipient.address)).to.equal(parseEther('50'))
        expect(await token.totalAaveSupply()).to.equal(parseEther('50'))
        expect(await token.totalSupply()).to.equal(parseEther('350'))
        expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal(parseEther('50'))
      })
    })

    describe('perTokenValue != 1', () => {
      beforeEach(async () => {
        await lendingPoolCore.setReserveNormalizedIncome(parseEther('1500000000'))
        await token.connect(holder).transfer(sender.address, parseEther('100'))
      })

      it('sender with truereward enabled sends to receipient with truereward disabled', async () => {
        await token.connect(sender).enableTrueReward()
        await token.connect(sender).transfer(receipient.address, parseEther('50'))

        expect(await token.balanceOf(sender.address), 'sender').to.equal('50000000000000000001')
        expect(await token.balanceOf(receipient.address), 'receipient').to.equal('49999999999999999999')
        expect(await token.accountTotalLoanBackedBalance(sender.address)).to.equal('33333333333333333334') // 50 / 1.5
        expect(await token.totalAaveSupply()).to.equal('33333333333333333334')
        expect(await token.totalSupply()).to.equal('350000000000000000001')
        expect(await sharesToken.balanceOf(financialOpportunity.address), 'shares').to.equal('49999999999999999999')
      })

      it('holders with trudereward enabled transfer funds between each other', async () => {
        await token.connect(sender).enableTrueReward()
        await token.connect(receipient).enableTrueReward()
        await token.connect(sender).transfer(receipient.address, parseEther('50'))

        expect(await token.balanceOf(sender.address)).to.equal('49999999999999999999')
        expect(await token.balanceOf(receipient.address)).to.equal('49999999999999999999')
        expect(await token.accountTotalLoanBackedBalance(sender.address)).to.equal('33333333333333333333')
        expect(await token.accountTotalLoanBackedBalance(receipient.address)).to.equal('33333333333333333333')
        expect(await token.totalAaveSupply()).to.equal('66666666666666666666')
        expect(await token.totalSupply()).to.equal('399999999999999999999')
        expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal('99999999999999999999')
      })

      it('sender with truereward disabled sends to receipient with truereward enabled', async () => {
        await token.connect(receipient).enableTrueReward()
        await token.connect(sender).transfer(receipient.address, parseEther('50'))

        expect(await token.balanceOf(sender.address)).to.equal(parseEther('50'))
        expect(await token.balanceOf(receipient.address)).to.equal('49999999999999999998')
        expect(await token.accountTotalLoanBackedBalance(sender.address)).to.equal('0')
        expect(await token.accountTotalLoanBackedBalance(receipient.address)).to.equal('33333333333333333332')
        expect(await token.totalAaveSupply()).to.equal('33333333333333333332')
        expect(await token.totalSupply()).to.equal('349999999999999999998')
        expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal('49999999999999999999')
      })
    })

    describe('Aave ears interest', () => {
      beforeEach(async () => {
        await lendingPoolCore.setReserveNormalizedIncome(parseEther('1500000000'))
        await token.connect(holder).transfer(sender.address, parseEther('100'))
      })

      it('sender with truereward enabled sends to receipient with truereward disabled', async () => {
        await token.connect(sender).enableTrueReward()
        await lendingPoolCore.setReserveNormalizedIncome(parseEther('1600000000'))
        await token.connect(sender).transfer(receipient.address, parseEther('50'))

        expect(await token.balanceOf(sender.address)).to.equal('56666666666666666665') // (100/1.5)*1.6 - 50
        expect(await token.balanceOf(receipient.address)).to.equal(parseEther('50'))
        expect(await token.accountTotalLoanBackedBalance(sender.address)).to.equal('35416666666666666666') // 56666666666666660000/1.6
        expect(await token.accountTotalLoanBackedBalance(receipient.address)).to.equal('0')
        expect(await token.totalAaveSupply()).to.equal('35416666666666666666')
        expect(await token.totalSupply()).to.equal('356666666666666666665')
        expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal('56666666666666666666')
      })

      it('holders with trudereward enabled transfer funds between each other', async () => {
        await token.connect(sender).enableTrueReward()
        await token.connect(receipient).enableTrueReward()
        await lendingPoolCore.setReserveNormalizedIncome(parseEther('1600000000'))
        await token.connect(sender).transfer(receipient.address, parseEther('50'))

        expect(await token.balanceOf(sender.address)).to.equal('56666666666666666665')
        expect(await token.balanceOf(receipient.address)).to.equal('50000000000000000000')
        expect(await token.accountTotalLoanBackedBalance(sender.address)).to.equal('35416666666666666666')
        expect(await token.accountTotalLoanBackedBalance(receipient.address)).to.equal('31250000000000000000')
        expect(await token.totalAaveSupply()).to.equal('66666666666666666666')
        expect(await token.totalSupply()).to.equal('406666666666666666665')
        expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal('106666666666666666666')
      })

      it('sender with truereward disabled sends to receipient with truereward enabled', async () => {
        await token.connect(receipient).enableTrueReward()
        await lendingPoolCore.setReserveNormalizedIncome(parseEther('1600000000'))
        await token.connect(sender).transfer(receipient.address, parseEther('50'))

        expect(await token.balanceOf(sender.address)).to.equal(parseEther('50'))
        expect(await token.balanceOf(receipient.address)).to.equal(parseEther('50'))
        expect(await token.accountTotalLoanBackedBalance(sender.address)).to.equal(0)
        expect(await token.accountTotalLoanBackedBalance(receipient.address)).to.equal(parseEther('31.25')) // 31.25*1.6
        expect(await token.totalAaveSupply()).to.equal(parseEther('31.25'))
        expect(await token.totalSupply()).to.equal(parseEther('350'))
        expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal(parseEther('50'))
      })
    })
  })
})
