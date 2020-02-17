const Registry = artifacts.require('Registry')
const CompliantTokenMock = artifacts.require('CompliantTokenMock')
const MockCErc20 = artifacts.require('MockCErc20')
const CompoundFinancialOpportunity = artifacts.require('CompoundFinancialOpportunity')

const BN = web3.utils.toBN;
const bytes32 = require('../helpers/bytes32.js')

contract('CompliantToken', function ([_, owner, oneHundred]) {
  beforeEach(async function () {
    this.registry = await Registry.new({ from: owner })
    this.token = await CompliantTokenMock.new(oneHundred, BN(100*10**18), { from: owner })
    await this.token.setRegistry(this.registry.address, { from: owner })
    
    this.cToken = await MockCErc20.new(this.token.address, { from: owner })

    this.financialOpportunity = await CompoundFinancialOpportunity.new(this.cToken.address, this.token.address, { from: owner })
  })

  it('initialized to proper addresses', async function () {
    const tokenAddress = await this.financialOpportunity.tokenAddress()
    assert.equal(tokenAddress, this.token.address)

    const cTokenAddress = await this.financialOpportunity.cTokenAddress()
    assert.equal(cTokenAddress, this.cToken.address)
  })
})
