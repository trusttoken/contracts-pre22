import assertBalance from '../helpers/assertBalance'

const Registry = artifacts.require('Registry')
const CompliantTokenMock = artifacts.require('CompliantTokenMock')
const MockCErc20 = artifacts.require('MockCErc20')
const CompoundFinancialOpportunity = artifacts.require('CompoundFinancialOpportunity')

const BN = web3.utils.toBN;
const bytes32 = require('../helpers/bytes32.js')

contract('CompoundFinancialOpportunity', function ([_, owner, oneHundred]) {
  const IS_REGISTERED_CONTRACT = bytes32('isRegisteredContract');

  beforeEach(async function () {
    this.registry = await Registry.new({ from: owner })
    this.token = await CompliantTokenMock.new(oneHundred, BN(100*10**18), { from: owner })
    await this.token.setRegistry(this.registry.address, { from: owner })
    
    this.cToken = await MockCErc20.new(this.token.address, { from: owner })

    this.financialOpportunity = await CompoundFinancialOpportunity.new(this.cToken.address, this.token.address, { from: owner })
    // await this.registry.setAttributeValue(this.cToken.address, IS_REGISTERED_CONTRACT, this.cToken.address, { from: owner });
  })

  it('initialized to proper addresses', async function () {
    const tokenAddress = await this.financialOpportunity.tokenAddress()
    assert.equal(tokenAddress, this.token.address)

    const cTokenAddress = await this.financialOpportunity.cTokenAddress()
    assert.equal(cTokenAddress, this.cToken.address)
  })

  it('mints cTokens on transfer', async function () {
    await this.token.transfer(this.financialOpportunity.address, BN(10*10**18), { from: oneHundred })
    await this.financialOpportunity.tokenFallback(oneHundred, BN(10*10**18))

    assertBalance(this.financialOpportunity, oneHundred, BN(10*10**18))
    assertBalance(this.token, oneHundred, BN(90*10**18))
    assertBalance(this.token, this.cToken.address, BN(10*10**18))
  })

  it('can withdraw', async function () {
    await this.token.transfer(this.financialOpportunity.address, BN(10*10**18), { from: oneHundred })
    await this.financialOpportunity.tokenFallback(oneHundred, BN(10*10**18))

    await this.financialOpportunity.withdraw(BN(5*10**18), { from: oneHundred })

    assertBalance(this.financialOpportunity, oneHundred, BN(5*10**18))
    assertBalance(this.token, oneHundred, BN(95*10**18))
    assertBalance(this.token, this.cToken.address, BN(5*10**18))
  })
})
