import assertBalance from '../helpers/assertBalance'
import assertRevert from '@trusttoken/registry/test/helpers/assertRevert'

const Registry = artifacts.require('RegistryMock')
const CompliantTokenMock = artifacts.require('CompliantTokenMock')
const FinancialOpportunityMock = artifacts.require('ConfigurableFinancialOpportunityMock')

const BN = web3.utils.toBN

const to18Decimals = value => BN(Math.floor(value * 10 ** 10)).mul(BN(10 ** 8))

contract('ConfigurableFinancialOpportunityMock', function ([owner, address1]) {
  beforeEach(async function () {
    this.registry = await Registry.new()
    this.token = await CompliantTokenMock.new(owner, to18Decimals(200))
    await this.token.setRegistry(this.registry.address)

    this.financialOpportunity = await FinancialOpportunityMock.new(this.token.address)
    await this.token.transfer(this.financialOpportunity.address, to18Decimals(100))
  })

  describe('deposit', async function () {
    it('with exchange rate = 1', async function () {
      await this.token.approve(this.financialOpportunity.address, to18Decimals(10))
      await this.financialOpportunity.deposit(owner, to18Decimals(10))

      await assert((await this.financialOpportunity.getBalance()).eq(to18Decimals(10)))
      await assertBalance(this.token, owner, to18Decimals(90))
    })

    it('with exchange rate = 1.5', async function () {
      await this.financialOpportunity.increasePerTokenValue(to18Decimals(0.5))

      await this.token.approve(this.financialOpportunity.address, to18Decimals(15))
      await this.financialOpportunity.deposit(owner, to18Decimals(15))

      await assert((await this.financialOpportunity.getBalance()).eq(to18Decimals(15)))
      await assertBalance(this.token, owner, to18Decimals(85))
    })

    it('only owner can call', async function () {
      assertRevert(this.financialOpportunity.deposit(owner, to18Decimals(10)), { from: address1 })
    })
  })

  describe('withdraw', async function () {
    beforeEach(async function () {
      await this.token.approve(this.financialOpportunity.address, to18Decimals(10))
      await this.financialOpportunity.deposit(owner, to18Decimals(10))
    })

    it('withdrawTo', async function () {
      await this.financialOpportunity.withdrawTo(address1, to18Decimals(5))

      await assert((await this.financialOpportunity.getBalance()).eq(to18Decimals(5)))
      await assertBalance(this.token, address1, to18Decimals(5))
      await assertBalance(this.token, owner, to18Decimals(90))
    })

    it('only owner can call withdrawTo', async function () {
      assertRevert(this.financialOpportunity.withdrawTo(address1, to18Decimals(5)), { from: address1 })
    })

    it('withdrawAll', async function () {
      await this.financialOpportunity.withdrawAll(address1)

      await assert((await this.financialOpportunity.getBalance()).eq(to18Decimals(0)))
      await assertBalance(this.token, address1, to18Decimals(10))
    })

    it('only owner can call withdrawAll', async function () {
      assertRevert(this.financialOpportunity.withdrawAll(address1), { from: address1 })
    })

    describe('with exchange rate = 1.5', async function () {
      beforeEach(async function () {
        await this.financialOpportunity.increasePerTokenValue(to18Decimals(0.5))
      })

      it('can withdraw 50%', async function () {
        await this.financialOpportunity.withdrawTo(address1, to18Decimals(7.5))

        await assert((await this.financialOpportunity.getBalance()).eq(to18Decimals(7.5)))
        await assertBalance(this.token, address1, to18Decimals(7.5))
      })

      it('can withdraw 100%', async function () {
        await this.financialOpportunity.withdrawTo(address1, to18Decimals(15))

        await assert((await this.financialOpportunity.getBalance()).eq(to18Decimals(0)))
        await assertBalance(this.token, address1, to18Decimals(15))
      })

      it('withdrawAll', async function () {
        await this.financialOpportunity.withdrawAll(address1)

        await assert((await this.financialOpportunity.getBalance()).eq(to18Decimals(0)))
        await assertBalance(this.token, address1, to18Decimals(15))
      })
    })
  })
})
