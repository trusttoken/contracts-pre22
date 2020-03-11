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

contract('AaveFinancialOpportunity', function ([_, owner, oneHundred, address1, address2, address3]) {
  const IS_REGISTERED_CONTRACT = bytes32('isRegisteredContract');

  beforeEach(async function () {
    this.registry = await Registry.new({ from: owner })
    this.token = await CompliantTokenMock.new(oneHundred, BN(100*10**18), { from: owner })
    await this.token.setRegistry(this.registry.address, { from: owner })
    
    this.lendingPoolCore = await LendingPoolCoreMock.new({ from: owner })
    this.sharesToken = await ATokenMock.new(this.token.address, this.lendingPoolCore.address, { from: owner })
    this.lendingPool = await LendingPoolMock.new(this.lendingPoolCore.address, this.sharesToken.address, { from: owner })
    
    await this.token.transfer(this.sharesToken.address, BN(50*10**18), { from: oneHundred })

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
    await assertRevert(this.financialOpportunity.configure(address1, address2, address3, { from: oneHundred }))
  })

  it('can deposit', async function () {
    await this.token.approve(this.financialOpportunity.address, BN(10*10**18), { from: oneHundred })
    await this.financialOpportunity.deposit(oneHundred, BN(10*10**18))

    await assertBalance(this.financialOpportunity, oneHundred, BN(10*10**18))
    await assertBalance(this.token, oneHundred, BN(40*10**18))
  })

  it('can withdraw', async function () {
    await this.token.approve(this.financialOpportunity.address, BN(10*10**18), { from: oneHundred })
    await this.financialOpportunity.deposit(oneHundred, BN(10*10**18))

    await this.financialOpportunity.withdrawTo(oneHundred, address1, BN(5*10**18), { from: owner })

    await assertBalance(this.financialOpportunity, oneHundred, BN(5*10**18))
    await assertBalance(this.token, address1, BN(5*10**18))
    await assertBalance(this.token, oneHundred, BN(40*10**18))
  })

  it('withdrawAll', async function () {
    await this.token.approve(this.financialOpportunity.address, BN(10*10**18), { from: oneHundred })
    await this.financialOpportunity.deposit(oneHundred, BN(10*10**18))

    await this.financialOpportunity.withdrawAll(oneHundred, { from: owner })

    await assertBalance(this.financialOpportunity, oneHundred, BN(0))
    await assertBalance(this.token, oneHundred, BN(50*10**18))
  })

  it('perTokenValue', async function () {
    const perTokenValue = await this.financialOpportunity.perTokenValue()
    assert(perTokenValue.eq(BN(1*10**18)))
  })

  describe('with uneven exchange rate', () => {
    beforeEach(async function () {
      await this.lendingPoolCore.setReserveNormalizedIncome(to27Decimals(1.5), { from: owner })
    })

    it('can deposit', async function () {
      await this.token.approve(this.financialOpportunity.address, BN(15*10**18), { from: oneHundred })
      await this.financialOpportunity.deposit(oneHundred, BN(15*10**18))
  
      await assertBalance(this.financialOpportunity, oneHundred, BN(10*10**18))
      await assertBalance(this.token, oneHundred, BN(35*10**18))
    })

    it('can withdraw', async function () {
      await this.token.approve(this.financialOpportunity.address, BN(15*10**18), { from: oneHundred })
      await this.financialOpportunity.deposit(oneHundred, BN(15*10**18))
  
      await this.financialOpportunity.withdrawTo(oneHundred, address1, BN(7.5*10**18), { from: owner })
  
      await assertBalance(this.financialOpportunity, oneHundred, BN(5*10**18))
      await assertBalance(this.token, oneHundred, BN(35*10**18))
      await assertBalance(this.token, address1, BN(7.5*10**18))
    }) 
    
    it('withdrawAll', async function () {
      await this.token.approve(this.financialOpportunity.address, BN(15*10**18), { from: oneHundred })
      await this.financialOpportunity.deposit(oneHundred, BN(15*10**18))
  
      await this.financialOpportunity.withdrawAll(oneHundred, { from: owner })
  
      await assertBalance(this.financialOpportunity, oneHundred, BN(0))
      await assertBalance(this.token, oneHundred, BN(50*10**18))
    })

    it('perTokenValue', async function () {
      const perTokenValue = await this.financialOpportunity.perTokenValue()
      assert(perTokenValue.eq(BN(1.5*10**18)))
    })
  })
})
