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

contract('AaveFinancialOpportunity', function ([_, owner, holder, address1, address2, address3]) {

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

  it('configured to proper addresses', async function () {
    const sharesTokenAddress = await this.financialOpportunity.sharesToken()
    assert.equal(sharesTokenAddress, this.sharesToken.address)

    const lendingPoolAddress = await this.financialOpportunity.lendingPool()
    assert.equal(lendingPoolAddress, this.lendingPool.address)

    const tokenAddress = await this.financialOpportunity.token()
    assert.equal(tokenAddress, this.token.address)
  })

  it('can reconfigure', async function () {
    await this.financialOpportunity.configure(address1, address2, address3, { from: owner })

    const sharesTokenAddress = await this.financialOpportunity.sharesToken()
    assert.equal(sharesTokenAddress, address1)

    const lendingPoolAddress = await this.financialOpportunity.lendingPool()
    assert.equal(lendingPoolAddress, address2)

    const tokenAddress = await this.financialOpportunity.token()
    assert.equal(tokenAddress, address3)
  })

  it('non-owner cannot reconfigure', async function () {
    await assertRevert(this.financialOpportunity.configure(address1, address2, address3, { from: holder }))
  })

  it('can deposit', async function () {
    await this.token.approve(this.financialOpportunity.address, to18Decimals(10), { from: holder })
    await this.financialOpportunity.deposit(holder, to18Decimals(10))

    await assertBalance(this.financialOpportunity, holder, to18Decimals(10))
    await assertBalance(this.token, holder, to18Decimals(40))
  })

  it('can withdraw', async function () {
    await this.token.approve(this.financialOpportunity.address, to18Decimals(10), { from: holder })
    await this.financialOpportunity.deposit(holder, to18Decimals(10))

    await this.financialOpportunity.withdrawTo(holder, address1, to18Decimals(5), { from: owner })

    await assertBalance(this.financialOpportunity, holder, to18Decimals(5))
    await assertBalance(this.token, address1, to18Decimals(5))
    await assertBalance(this.token, holder, to18Decimals(40))
  })

  it('withdrawAll', async function () {
    await this.token.approve(this.financialOpportunity.address, to18Decimals(10), { from: holder })
    await this.financialOpportunity.deposit(holder, to18Decimals(10))

    await this.financialOpportunity.withdrawAll(holder, { from: owner })

    await assertBalance(this.financialOpportunity, holder, to18Decimals(0))
    await assertBalance(this.token, holder, to18Decimals(50))
  })

  it('perTokenValue', async function () {
    const perTokenValue = await this.financialOpportunity.perTokenValue()
    assert(perTokenValue.eq(to18Decimals(1)))
  })

  describe('with uneven exchange rate', () => {
    beforeEach(async function () {
      await this.lendingPoolCore.setReserveNormalizedIncome(to27Decimals(1.5), { from: owner })
    })

    it('can deposit', async function () {
      await this.token.approve(this.financialOpportunity.address, to18Decimals(15), { from: holder })
      await this.financialOpportunity.deposit(holder, to18Decimals(15))
  
      await assertBalance(this.financialOpportunity, holder, to18Decimals(10))
      await assertBalance(this.token, holder, to18Decimals(35))
    })

    it('can withdraw', async function () {
      await this.token.approve(this.financialOpportunity.address, to18Decimals(15), { from: holder })
      await this.financialOpportunity.deposit(holder, to18Decimals(15))
  
      await this.financialOpportunity.withdrawTo(holder, address1, to18Decimals(7.5), { from: owner })
  
      await assertBalance(this.financialOpportunity, holder, to18Decimals(5))
      await assertBalance(this.token, holder, to18Decimals(35))
      await assertBalance(this.token, address1, to18Decimals(7.5))
    }) 
    
    it('withdrawAll', async function () {
      await this.token.approve(this.financialOpportunity.address, to18Decimals(15), { from: holder })
      await this.financialOpportunity.deposit(holder, to18Decimals(15))
  
      await this.financialOpportunity.withdrawAll(holder, { from: owner })
  
      await assertBalance(this.financialOpportunity, holder, to18Decimals(0))
      await assertBalance(this.token, holder, to18Decimals(50))
    })

    it('perTokenValue', async function () {
      const perTokenValue = await this.financialOpportunity.perTokenValue()
      assert(perTokenValue.eq(to18Decimals(1.5)))
    })
  })
})
