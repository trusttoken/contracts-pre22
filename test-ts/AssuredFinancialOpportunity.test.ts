import { Wallet, Contract } from 'ethers'
import { parseEther, BigNumber, BigNumberish } from 'ethers/utils'
import { MockProvider, deployContract, solidity } from 'ethereum-waffle'
import { use, expect } from 'chai'
import { beforeEachWithFixture } from './utils'

import {
  AssuredFinancialOpportunity,
  ConfigurableFinancialOpportunityMock,
  FractionalExponents,
  SimpleLiquidatorMock,
  MockERC20,
} from '../build'

use(solidity)

const from18Decimals = (x: BigNumber) => Number(x) / 10 ** 18

describe('AssuredFinancialOpportunity', () => {
  let provider: MockProvider

  let token: Contract
  let financialOpportunity: Contract
  let fractionalExponents: Contract
  let liquidator: Contract
  let assuredFinancialOpportunity: Contract

  let wallet: Wallet
  let holder: Wallet
  let beneficiary: Wallet

  const mockPoolAddress = Wallet.createRandom().address

  async function deposit (from: Wallet, value: BigNumberish) {
    await token.connect(from).approve(assuredFinancialOpportunity.address, value)
    await assuredFinancialOpportunity.deposit(from.address, value)
  }

  beforeEachWithFixture(async (p: MockProvider) => {
    provider = p

    ; [wallet, holder, beneficiary] = provider.getWallets()

    token = await deployContract(wallet, MockERC20)
    await token.mint(holder.address, parseEther('100'))

    fractionalExponents = await deployContract(wallet, FractionalExponents)
    liquidator = await deployContract(wallet, SimpleLiquidatorMock, [token.address])
    await token.mint(liquidator.address, parseEther('1000'))

    financialOpportunity = await deployContract(wallet, ConfigurableFinancialOpportunityMock, [token.address])
    await token.mint(financialOpportunity.address, parseEther('100'))

    assuredFinancialOpportunity = await deployContract(wallet, AssuredFinancialOpportunity)
    await assuredFinancialOpportunity.configure(
      financialOpportunity.address,
      mockPoolAddress,
      liquidator.address,
      fractionalExponents.address,
      token.address,
      wallet.address,
    )
  })

  describe('perTokenValue', () => {
    it('1.5 perTokenValue with 100% reward basis', async function () {
      await financialOpportunity.increasePerTokenValue(parseEther('0.5'))
      const finOpPerTokenValue = await financialOpportunity.perTokenValue()
      const perTokenValue = await assuredFinancialOpportunity.perTokenValue()

      expect(perTokenValue).to.equal(finOpPerTokenValue)
    })

    it('1.5 perTokenValue with 70% reward basis', async function () {
      await assuredFinancialOpportunity.setRewardBasis(0.7 * 1000)
      await financialOpportunity.increasePerTokenValue(parseEther('0.5'))
      const perTokenValue = await assuredFinancialOpportunity.perTokenValue()

      expect(from18Decimals(perTokenValue)).to.equal(Math.pow(1.5, 0.7))
    })

    it('adjusted when reward basis changes', async () => {
      await financialOpportunity.increasePerTokenValue(parseEther('0.5'))
      const perTokenValueBefore = await assuredFinancialOpportunity.perTokenValue()
      await assuredFinancialOpportunity.setRewardBasis(0.7 * 1000)
      const perTokenValueAfter = await assuredFinancialOpportunity.perTokenValue()

      expect(perTokenValueAfter).to.equal(perTokenValueBefore)
    })
  })

  describe('deposit', async function () {
    it('with exchange rate = 1', async function () {
      await deposit(holder, parseEther('10'))
      const finOpBalance = await assuredFinancialOpportunity.getBalance()
      const remaingTokenBalance = await token.balanceOf(holder.address)

      expect(finOpBalance).to.equal(parseEther('10'))
      expect(remaingTokenBalance).to.equal(parseEther('90'))
    })

    it('with exchange rate = 1.5', async function () {
      await financialOpportunity.increasePerTokenValue(parseEther('0.5'))
      await deposit(holder, parseEther('15'))
      const finOpBalance = await assuredFinancialOpportunity.getBalance()
      const remaingTokenBalance = await token.balanceOf(holder.address)

      expect(finOpBalance).to.equal(parseEther('10'))
      expect(remaingTokenBalance).to.equal(parseEther('85'))
    })

    it('only funds manager can call', async function () {
      expect(
        assuredFinancialOpportunity.connect(holder).deposit(holder.address, parseEther('10')),
      ).to.be.reverted
    })

    it('two deposits in a row', async function () {
      await deposit(holder, parseEther('15'))

      await financialOpportunity.increasePerTokenValue(parseEther('1'))

      await token.connect(holder).approve(assuredFinancialOpportunity.address, parseEther('10'))
      await assuredFinancialOpportunity.deposit(holder.address, parseEther('10'))

      expect(await assuredFinancialOpportunity.getBalance()).to.equal(parseEther('20'))
    })
  })

  describe('withdraw', async function () {
    beforeEach(async function () {
      await deposit(holder, parseEther('10'))
    })

    it('withdrawTo', async function () {
      await assuredFinancialOpportunity.withdrawTo(beneficiary.address, parseEther('5'))
      const remaingHoldersTokenBalance = await token.balanceOf(holder.address)
      const newBeneficiarysTokenBalance = await token.balanceOf(beneficiary.address)
      const finOpBalance = await assuredFinancialOpportunity.getBalance()

      expect(remaingHoldersTokenBalance).to.equal(parseEther('90'))
      expect(newBeneficiarysTokenBalance).to.equal(parseEther('5'))
      expect(finOpBalance).to.equal(parseEther('5'))
    })

    it('only funds manager can call withdrawTo', async function () {
      expect(
        assuredFinancialOpportunity.connect(holder).withdrawTo(beneficiary.address, parseEther('5')),
      ).to.be.reverted
      expect(
        assuredFinancialOpportunity.connect(beneficiary).withdrawTo(beneficiary.address, parseEther('5')),
      ).to.be.reverted
    })

    it('withdrawAll', async function () {
      await assuredFinancialOpportunity.withdrawAll(beneficiary.address)
      const newBeneficiarysTokenBalance = await token.balanceOf(beneficiary.address)
      const finOpBalance = await assuredFinancialOpportunity.getBalance()

      expect(newBeneficiarysTokenBalance).to.equal(parseEther('10'))
      expect(finOpBalance).to.equal('0')
    })

    it('only funds manager can call withdrawAll', async function () {
      expect(
        assuredFinancialOpportunity.connect(holder).withdrawAll(beneficiary.address),
      ).to.be.reverted
      expect(
        assuredFinancialOpportunity.connect(beneficiary).withdrawAll(beneficiary.address),
      ).to.be.reverted
    })

    describe('with exchange rate = 1.5', async function () {
      const checkBalances = async () => ({
        newBeneficiarysTokenBalance: await token.balanceOf(beneficiary.address),
        financialOpportunityBalance: await assuredFinancialOpportunity.getBalance(),
      })

      beforeEach(async function () {
        await financialOpportunity.increasePerTokenValue(parseEther('0.5'))

        expect(await assuredFinancialOpportunity.perTokenValue()).to.equal(parseEther('1.5'))
        expect(await assuredFinancialOpportunity.getBalance()).to.equal(parseEther('10'))
      })

      it('withdrawAll', async function () {
        await assuredFinancialOpportunity.withdrawAll(beneficiary.address)
        const { newBeneficiarysTokenBalance, financialOpportunityBalance } = await checkBalances()

        expect(newBeneficiarysTokenBalance).to.equal(parseEther('15'))
        expect(financialOpportunityBalance).to.equal('0')
      })

      it('can withdraw 100%', async function () {
        await assuredFinancialOpportunity.withdrawTo(beneficiary.address, parseEther('15'))
        const { newBeneficiarysTokenBalance, financialOpportunityBalance } = await checkBalances()

        expect(newBeneficiarysTokenBalance).to.equal(parseEther('15'))
        expect(financialOpportunityBalance).to.equal('0')
      })

      it('can withdraw 50%', async function () {
        await assuredFinancialOpportunity.withdrawTo(beneficiary.address, parseEther('7.5'))

        const { newBeneficiarysTokenBalance, financialOpportunityBalance } = await checkBalances()
        expect(newBeneficiarysTokenBalance).to.equal(parseEther('7.5'))
        expect(financialOpportunityBalance).to.equal(parseEther('5'))
      })

      it('can withdraw twice in a row', async () => {
        await assuredFinancialOpportunity.withdrawTo(beneficiary.address, parseEther('1.5'))
        await assuredFinancialOpportunity.withdrawTo(beneficiary.address, parseEther('3'))

        const { newBeneficiarysTokenBalance, financialOpportunityBalance } = await checkBalances()
        expect(newBeneficiarysTokenBalance).to.equal(parseEther('4.5'))
        expect(financialOpportunityBalance).to.equal(parseEther('7'))
      })
    })
  })

  it('liquidation', async () => {
    await deposit(holder, parseEther('10'))
    await financialOpportunity.increasePerTokenValue(parseEther('19'))

    await assuredFinancialOpportunity.withdrawTo(beneficiary.address, parseEther('200'))

    expect(await token.balanceOf(beneficiary.address)).to.equal(parseEther('200'))
    expect(await assuredFinancialOpportunity.getBalance()).to.equal(parseEther('10'))
  })

  describe('award amount', () => {
    it('0 when reward basis is 100%', async () => {
      await deposit(holder, parseEther('10'))
      await financialOpportunity.increasePerTokenValue(parseEther('0.5'))

      expect(await assuredFinancialOpportunity.awardAmount()).to.eq(0)
    })

    it('properly calculated when reward basis is 70%', async () => {
      await deposit(holder, parseEther('10'))
      await assuredFinancialOpportunity.setRewardBasis(0.7 * 1000)
      await financialOpportunity.increasePerTokenValue(parseEther('0.5'))

      expect(from18Decimals(await assuredFinancialOpportunity.awardAmount()))
        .to.be.closeTo(10 * (1.5 - 1.5 ** 0.7), 10 ** (-10))
    })
  })

  describe('award pool', () => {
    it('awards 0 when reward basis is 100%', async () => {
      await deposit(holder, parseEther('10'))
      await financialOpportunity.increasePerTokenValue(parseEther('0.5'))

      await assuredFinancialOpportunity.awardPool()

      expect(from18Decimals(await token.balanceOf(mockPoolAddress))).to.equal(0)
      expect(from18Decimals(await financialOpportunity.getBalance())).to.be.closeTo(10, 10 ** (-10))
    })

    it('awards proper amount', async () => {
      await deposit(holder, parseEther('10'))
      await assuredFinancialOpportunity.setRewardBasis(0.7 * 1000)
      await financialOpportunity.increasePerTokenValue(parseEther('0.5'))

      await assuredFinancialOpportunity.awardPool()

      expect(from18Decimals(await token.balanceOf(mockPoolAddress))).to.be.closeTo(10 * (1.5 - 1.5 ** 0.7), 10 ** (-10))
      expect(from18Decimals(await financialOpportunity.getBalance())).to.be.closeTo(8.8546749330, 10 ** (-10))
    })

    it('awards 0 on subsequent calls', async () => {
      await deposit(holder, parseEther('10'))
      await assuredFinancialOpportunity.setRewardBasis(0.7 * 1000)
      await financialOpportunity.increasePerTokenValue(parseEther('0.5'))

      await assuredFinancialOpportunity.awardPool()
      expect(from18Decimals(await assuredFinancialOpportunity.awardAmount())).to.closeTo(0, 10 ** (-10))
      await assuredFinancialOpportunity.awardPool()
      expect(from18Decimals(await token.balanceOf(mockPoolAddress))).to.be.closeTo(10 * (1.5 - 1.5 ** 0.7), 10 ** (-10))
      expect(from18Decimals(await financialOpportunity.getBalance())).to.be.closeTo(8.8546749330, 10 ** (-10))
    })

    it('awards proper amount when per token value increases between calls', async () => {
      await deposit(holder, parseEther('10'))
      await assuredFinancialOpportunity.setRewardBasis(0.7 * 1000)
      await financialOpportunity.increasePerTokenValue(parseEther('0.5'))

      await assuredFinancialOpportunity.awardPool()
      await financialOpportunity.increasePerTokenValue(parseEther('1'))
      await assuredFinancialOpportunity.awardPool()

      expect(from18Decimals(await token.balanceOf(mockPoolAddress))).to.be.closeTo(4.8632301096462145, 10 ** (-10))
      expect(from18Decimals(await financialOpportunity.getBalance())).to.be.closeTo(7.596577929323739, 10 ** (-10))
    })

    it('not additional awards when reward basis changes between calls', async () => {
      await deposit(holder, parseEther('10'))
      await assuredFinancialOpportunity.setRewardBasis(0.7 * 1000)
      await financialOpportunity.increasePerTokenValue(parseEther('0.5'))

      await assuredFinancialOpportunity.awardPool()
      await assuredFinancialOpportunity.setRewardBasis(0.5 * 1000)

      expect(from18Decimals(await assuredFinancialOpportunity.awardAmount())).to.closeTo(0, 10 ** (-10))
      await assuredFinancialOpportunity.awardPool()

      expect(from18Decimals(await token.balanceOf(mockPoolAddress))).to.be.closeTo(10 * (1.5 - 1.5 ** 0.7), 10 ** (-10))
      expect(from18Decimals(await financialOpportunity.getBalance())).to.be.closeTo(8.8546749330, 10 ** (-10))
    })

    it('does NOT revert if the withdrawal fails', async () => {
      await deposit(holder, parseEther('10'))
      await assuredFinancialOpportunity.setRewardBasis(0.7 * 1000)
      await financialOpportunity.increasePerTokenValue(parseEther('99'))

      await assuredFinancialOpportunity.awardPool()

      expect(from18Decimals(await token.balanceOf(mockPoolAddress))).to.equal(0)
      expect(from18Decimals(await financialOpportunity.getBalance())).to.equal(10)
    })

    it('anyone can call', async () => {
      await deposit(holder, parseEther('10'))
      await assuredFinancialOpportunity.setRewardBasis(0.7 * 1000)
      await financialOpportunity.increasePerTokenValue(parseEther('0.5'))

      await assuredFinancialOpportunity.connect(holder).awardPool()

      expect(from18Decimals(await token.balanceOf(mockPoolAddress))).to.be.closeTo(10 * (1.5 - 1.5 ** 0.7), 10 ** (-10))
      expect(from18Decimals(await financialOpportunity.getBalance())).to.be.closeTo(8.8546749330, 10 ** (-10))
    })
  })
})
