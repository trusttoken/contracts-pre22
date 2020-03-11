import assertBalance from '../helpers/assertBalance'
import assertRevert from '../../registry/test/helpers/assertRevert'

const Registry = artifacts.require('RegistryMock')
const CompliantTokenMock = artifacts.require('CompliantTokenMock')
const ATokenMock = artifacts.require('ATokenMock')
const LendingPoolMock = artifacts.require('LendingPoolMock')
const LendingPoolCoreMock = artifacts.require('LendingPoolCoreMock')
const AaveFinancialOpportunity = artifacts.require('AaveFinancialOpportunity')
const OwnedUpgradeabilityProxy = artifacts.require('OwnedUpgradeabilityProxy')

const BN = web3.utils.toBN;
const bytes32 = require('../helpers/bytes32.js')

const to18Decimals = value => BN(Math.floor(value*10**10)).mul(BN(10**8))
const to27Decimals = value => BN(Math.floor(value*10**10)).mul(BN(10**17))

contract('AaveFinancialOpportunity', function ([_, owner, holder, holder2, address1, address2, address3]) {

  beforeEach(async function () {
    this.registry = await Registry.new({ from: owner })
    this.token = await CompliantTokenMock.new(holder, to18Decimals(100), { from: owner })
    await this.token.setRegistry(this.registry.address, { from: owner })
    
    this.lendingPoolCore = await LendingPoolCoreMock.new({ from: owner })
    this.sharesToken = await ATokenMock.new(this.token.address, this.lendingPoolCore.address, { from: owner })
    this.lendingPool = await LendingPoolMock.new(this.lendingPoolCore.address, this.sharesToken.address, { from: owner })
    
    await this.token.transfer(this.sharesToken.address, to18Decimals(50), { from: holder })

    this.financialOpportunityImpl = await AaveFinancialOpportunity.new({ from: owner })
    this.financialOpportunityProxy = await OwnedUpgradeabilityProxy.new({ from: owner })
    this.financialOpportunity = await AaveFinancialOpportunity.at(this.financialOpportunityProxy.address)
    await this.financialOpportunityProxy.upgradeTo(this.financialOpportunityImpl.address, { from: owner })
    await this.financialOpportunity.configure(this.sharesToken.address, this.lendingPool.address, this.token.address, { from: owner })
  })

  describe('configure', function () {
    it('configured to proper addresses', async function () {
      const sharesTokenAddress = await this.financialOpportunity.sharesToken()
      const lendingPoolAddress = await this.financialOpportunity.lendingPool()
      const tokenAddress = await this.financialOpportunity.token()
      assert.equal(sharesTokenAddress, this.sharesToken.address)
      assert.equal(lendingPoolAddress, this.lendingPool.address)
      assert.equal(tokenAddress, this.token.address)
    })
  
    it('can reconfigure', async function () {
      await this.financialOpportunity.configure(address1, address2, address3, { from: owner })
  
      const sharesTokenAddress = await this.financialOpportunity.sharesToken()
      const lendingPoolAddress = await this.financialOpportunity.lendingPool()
      const tokenAddress = await this.financialOpportunity.token()
      assert.equal(sharesTokenAddress, address1)
      assert.equal(lendingPoolAddress, address2)
      assert.equal(tokenAddress, address3)
    })

    it('non-owner cannot reconfigure', async function () {
      await assertRevert(this.financialOpportunity.configure(address1, address2, address3, { from: holder }))
    })
  })

  describe('deposit', async function() {
    it('with exchange rate = 1', async function () {
      await this.token.approve(this.financialOpportunity.address, to18Decimals(10), { from: holder })
      await this.financialOpportunity.deposit(holder, to18Decimals(10))

      await assertBalance(this.financialOpportunity, holder, to18Decimals(10))
      await assertBalance(this.token, holder, to18Decimals(40))
    })

    it('with exchange rate = 1.5', async function () {
      await this.lendingPoolCore.setReserveNormalizedIncome(to27Decimals(1.5), { from: owner })

      await this.token.approve(this.financialOpportunity.address, to18Decimals(15), { from: holder })
      await this.financialOpportunity.deposit(holder, to18Decimals(15))
  
      await assertBalance(this.financialOpportunity, holder, to18Decimals(10))
      await assertBalance(this.token, holder, to18Decimals(35))
    })
  })

  describe('withdraw', async function() {
    beforeEach(async function() {
      await this.token.approve(this.financialOpportunity.address, to18Decimals(10), { from: holder })
      await this.financialOpportunity.deposit(holder, to18Decimals(10))
    })

    it('withdraw', async function () {
      await this.financialOpportunity.withdrawTo(holder, address1, to18Decimals(5), { from: owner })
  
      await assertBalance(this.financialOpportunity, holder, to18Decimals(5))
      await assertBalance(this.token, address1, to18Decimals(5))
      await assertBalance(this.token, holder, to18Decimals(40))
    })

    it('cannot withdraw more then deposited amount', async function() {
      await assertRevert(this.financialOpportunity.withdrawTo(holder, address1, to18Decimals(15), { from: owner }))
    })
  
    it('withdrawAll', async function () {
      await this.financialOpportunity.withdrawAll(holder, { from: owner })
  
      await assertBalance(this.financialOpportunity, holder, to18Decimals(0))
      await assertBalance(this.token, holder, to18Decimals(50))
    })

    describe('with exchange rate = 1.5', async function() {
      beforeEach(async function () {
        await this.lendingPoolCore.setReserveNormalizedIncome(to27Decimals(1.5), { from: owner })
      })
  
      it('can withdraw 50%', async function () {
        await this.financialOpportunity.withdrawTo(holder, address1, to18Decimals(7.5), { from: owner })
    
        await assertBalance(this.financialOpportunity, holder, to18Decimals(5))
        await assertBalance(this.token, holder, to18Decimals(40))
        await assertBalance(this.token, address1, to18Decimals(7.5))
      }) 

      it('can withdraw 100%', async function () {
        await this.financialOpportunity.withdrawTo(holder, address1, to18Decimals(15), { from: owner })
    
        await assertBalance(this.financialOpportunity, holder, to18Decimals(0))
        await assertBalance(this.token, holder, to18Decimals(40))
        await assertBalance(this.token, address1, to18Decimals(15))
      }) 

      it('cannot withdraw more then deposited amount', async function() {
        await assertRevert(this.financialOpportunity.withdrawTo(holder, address1, to18Decimals(20), { from: owner }))
      })
      
      it('withdrawAll', async function () {
        await this.financialOpportunity.withdrawAll(holder, { from: owner })
    
        await assertBalance(this.financialOpportunity, holder, to18Decimals(0))
        await assertBalance(this.token, holder, to18Decimals(55))
      })
    })
  })

  describe('multiple holders', function () {
    beforeEach(async function () {
      await this.token.transfer(holder2, to18Decimals(25), { from: holder })

      await this.token.approve(this.financialOpportunity.address, to18Decimals(25), { from: holder })
      await this.financialOpportunity.deposit(holder, to18Decimals(25))

      await this.token.approve(this.financialOpportunity.address, to18Decimals(25), { from: holder2 })
      await this.financialOpportunity.deposit(holder2, to18Decimals(25))
    })

    it('holder can withdraw full amount', async function() {
      await this.financialOpportunity.withdrawTo(holder, address1, to18Decimals(25), { from: owner })
    
      await assertBalance(this.financialOpportunity, holder, to18Decimals(0))
      await assertBalance(this.token, address1, to18Decimals(25))
    })

    it('holder cannot withdraw more than he deposited', async function() {
      await assertRevert(this.financialOpportunity.withdrawTo(holder, address1, to18Decimals(30), { from: owner }))
    })

    it('withdrawAll', async function () {
      await this.financialOpportunity.withdrawAll(holder, { from: owner })
    
      await assertBalance(this.financialOpportunity, holder, to18Decimals(0))
      await assertBalance(this.token, holder, to18Decimals(25))
    })
  })

  it('perTokenValue is always equal to exchange rate', async function () {
    const perTokenValue = await this.financialOpportunity.perTokenValue()
    assert(perTokenValue.eq(to18Decimals(1)))

    await this.lendingPoolCore.setReserveNormalizedIncome(to27Decimals(1.5))

    const perTokenValue2 = await this.financialOpportunity.perTokenValue()
    assert(perTokenValue2.eq(to18Decimals(1.5)))
  })
})
