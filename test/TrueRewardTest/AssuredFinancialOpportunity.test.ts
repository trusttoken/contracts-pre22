import { Wallet, Contract } from 'ethers'
import { parseEther, BigNumber } from 'ethers/utils'
import { MockProvider, deployContract, solidity } from 'ethereum-waffle'
import { use, expect } from 'chai'
import {
  AssuredFinancialOpportunity,
  ConfigurableFinancialOpportunityMock,
  FractionalExponents,
  SimpleLiquidatorMock,
  MockERC20,
} from '../../build'

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

  const mockPoolAddress = Wallet.createRandom().address

  beforeEach(async () => {
    provider = new MockProvider();
    [wallet, holder] = provider.getWallets()

    token = await deployContract(wallet, MockERC20)
    await token.mint(holder.address, parseEther('100'))

    financialOpportunity = await deployContract(wallet, ConfigurableFinancialOpportunityMock, [token.address])
    fractionalExponents = await deployContract(wallet, FractionalExponents)
    liquidator = await deployContract(wallet, SimpleLiquidatorMock, [token.address])

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
      await token.connect(holder).approve(assuredFinancialOpportunity.address, parseEther('10'))
      await assuredFinancialOpportunity.deposit(holder.address, parseEther('10'))
      const finOpBalance = await assuredFinancialOpportunity.getBalance()
      const remaingTokenBalance = await token.balanceOf(holder.address)

      expect(finOpBalance).to.equal(parseEther('10'))
      expect(remaingTokenBalance).to.equal(parseEther('90'))
    })

    it('with exchange rate = 1.5', async function () {
      await financialOpportunity.increasePerTokenValue(parseEther('0.5'))
      await token.connect(holder).approve(assuredFinancialOpportunity.address, parseEther('15'))
      await assuredFinancialOpportunity.deposit(holder.address, parseEther('15'))
      const finOpBalance = await assuredFinancialOpportunity.getBalance()
      const remaingTokenBalance = await token.balanceOf(holder.address)

      expect(finOpBalance).to.equal(parseEther('10'))
      expect(remaingTokenBalance).to.equal(parseEther('85'))
    })

    it('only funds manager can call', async function () {
      expect(financialOpportunity.connect(holder).deposit(holder.address, parseEther('10'))).to.be.reverted
    })
  })
})
