import basicTokenTests from './BasicToken'
import standardTokenTests from './StandardToken'
const TrueUSDMock = artifacts.require('TrueUSDMock')
const Registry = artifacts.require('RegistryMock')
const FinancialOpportunityMock = artifacts.require('FinancialOpportunityMock')
const TrueRewards = artifacts.require('TrueRewards')

const BN = web3.utils.toBN

contract('StandardToken', function ([, owner, oneHundred, anotherAccount]) {
  beforeEach(async function () {
    this.token = await TrueUSDMock.new(oneHundred, BN(100 * 10 ** 18), { from: owner })
    this.registry = await Registry.new({ from: owner })

    this.financialOpportunity = await FinancialOpportunityMock.new({ from: owner })
    this.trueRewards = await TrueRewards.new({ from: owner })
    await this.trueRewards.initialize(this.token.address, this.financialOpportunity.address, { from: owner })
    await this.token.setTrueRewardsAddress(this.trueRewards.address, { from: owner })

    await this.token.setRegistry(this.registry.address, { from: owner })
  })

  basicTokenTests([owner, oneHundred, anotherAccount])
  standardTokenTests([owner, oneHundred, anotherAccount])
})
