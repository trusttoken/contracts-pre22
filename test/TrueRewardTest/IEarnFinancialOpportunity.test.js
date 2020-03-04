import assertBalance from '../helpers/assertBalance'
import assertRevert from '../../registry/test/helpers/assertRevert'

const Registry = artifacts.require('RegistryMock')
const CompliantTokenMock = artifacts.require('CompliantTokenMock')
const yTrueUSDMock = artifacts.require('yTrueUSDMock')
const IEarnFinancialOpportunity = artifacts.require('IEarnFinancialOpportunity')
const OwnedUpgradeabilityProxy = artifacts.require('OwnedUpgradeabilityProxy')

const BN = web3.utils.toBN;
const bytes32 = require('../helpers/bytes32.js')

contract('IEarnFinancialOpportunity', function ([_, owner, oneHundred, rewardManager, address1, address2, address3]) {
  const IS_REGISTERED_CONTRACT = bytes32('isRegisteredContract');

  beforeEach(async function () {
    this.registry = await Registry.new({ from: owner })
    this.token = await CompliantTokenMock.new(oneHundred, BN(100*10**18), { from: owner })
    await this.token.setRegistry(this.registry.address, { from: owner })
    
    this.yToken = await yTrueUSDMock.new(this.token.address, { from: owner })

    this.financialOpportunityImpl = await IEarnFinancialOpportunity.new({ from: owner })
    this.financialOpportunityProxy = await OwnedUpgradeabilityProxy.new({ from: owner })
    this.financialOpportunity = await IEarnFinancialOpportunity.at(this.financialOpportunityProxy.address)
    await this.financialOpportunityProxy.upgradeTo(this.financialOpportunityImpl.address, { from: owner })
    await this.financialOpportunity.configure(this.yToken.address, this.token.address, { from: owner })

    await this.registry.setAttributeValue(this.financialOpportunity.address, IS_REGISTERED_CONTRACT, this.financialOpportunity.address, { from: owner });
  })

  it('configured to proper addresses', async function () {
    const yTokenAddress = await this.financialOpportunity.yToken()
    assert.equal(yTokenAddress, this.yToken.address)

    const tokenAddress = await this.financialOpportunity.token()
    assert.equal(tokenAddress, this.token.address)
  })

  it('can reconfigure', async function () {
    await this.financialOpportunity.configure(address1, address2, { from: owner })

    const yTokenAddress = await this.financialOpportunity.yToken()
    assert.equal(yTokenAddress, address1)

    const tokenAddress = await this.financialOpportunity.token()
    assert.equal(tokenAddress, address2)
  })

  it('non-owner cannot reconfigure', async function () {
    await assertRevert(this.financialOpportunity.configure(address1, address2, { from: oneHundred }))
  })

  it('mints cTokens on transfer', async function () {
    await this.token.transfer(this.financialOpportunity.address, BN(10*10**18), { from: oneHundred })
    await this.financialOpportunity.deposit(oneHundred, BN(10*10**18))

    await assertBalance(this.financialOpportunity, oneHundred, BN(10*10**18))
    await assertBalance(this.token, oneHundred, BN(90*10**18))
    await assertBalance(this.token, this.yToken.address, BN(10*10**18))
  })

  it('can withdraw', async function () {
    await this.token.transfer(this.financialOpportunity.address, BN(10*10**18), { from: oneHundred })
    await this.financialOpportunity.deposit(oneHundred, BN(10*10**18))

    await this.financialOpportunity.withdrawTo(oneHundred, address1, BN(5*10**18), { from: owner })

    await assertBalance(this.financialOpportunity, oneHundred, BN(5*10**18))
    await assertBalance(this.token, address1, BN(5*10**18))
    await assertBalance(this.token, oneHundred, BN(90*10**18))
    await assertBalance(this.token, this.yToken.address, BN(5*10**18))
  })

  it('perTokenValue', async function () {
    const perTokenValue = await this.financialOpportunity.perTokenValue()
    assert(perTokenValue.eq(BN(1*10**18)))
  })

  describe('with uneven exchange rate', () => {
    beforeEach(async function () {
      await this.yToken.setExchangeRate(BN(1.5*10**18), { from: owner })
    })

    it('can deposit', async function () {
      await this.token.transfer(this.financialOpportunity.address, BN(15*10**18), { from: oneHundred })
      await this.financialOpportunity.deposit(oneHundred, BN(15*10**18))
  
      await assertBalance(this.financialOpportunity, oneHundred, BN(10*10**18))
      await assertBalance(this.token, oneHundred, BN(85*10**18))
      await assertBalance(this.token, this.yToken.address, BN(15*10**18))
    })

    it('can withdraw', async function () {
      await this.token.transfer(this.financialOpportunity.address, BN(15*10**18), { from: oneHundred })
      await this.financialOpportunity.deposit(oneHundred, BN(15*10**18))
  
      await this.financialOpportunity.withdrawTo(oneHundred, address1, BN(5*10**18), { from: owner })
  
      await assertBalance(this.financialOpportunity, oneHundred, BN(5*10**18))
      await assertBalance(this.token, oneHundred, BN(85*10**18))
      await assertBalance(this.token, address1, BN(7.5*10**18))
      await assertBalance(this.token, this.yToken.address, BN(7.5*10**18))
    })

    it('perTokenValue', async function () {
      const perTokenValue = await this.financialOpportunity.perTokenValue()
      assert(perTokenValue.eq(BN(1.5*10**18)))
    })
  })
})
