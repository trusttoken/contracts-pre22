const AssuranceRegistry = artifacts.require('AssuranceRegistry')
const FractionalExponents = artifacts.require('FractionalExponents')
const StakingOpportunityFactory = artifacts.require('StakingOpportunityFactory')
const RegistryMock = artifacts.require('RegistryMock')
const TrueUSDMock = artifacts.require("TrueUSDMock")
const MockTrustToken = artifacts.require('MockTrustToken')
const StakedTokenProxyImplementation = artifacts.require('StakedTokenProxyImplementation')
const FinancialOpportunityMock = artifacts.require('FinancialOpportunityMock')
const writeAttributeFor = require('../helpers/writeAttributeFor.js')
const bytes32 = require('../helpers/bytes32.js')


const BN = web3.utils.toBN
const to18Decimals = value => BN(Math.floor(value*10**10)).mul(BN(10**8))

contract('AssuranceRegistry', function ([owner]) {
  beforeEach(async function () {
    this.fractinalExponents = await FractionalExponents.new()
    this.stakedTokenImpl = await StakedTokenProxyImplementation.new()

    this.registry = await RegistryMock.new()
    this.stakingOpportunityFactory = await StakingOpportunityFactory.new(
      this.registry.address,
      this.stakedTokenImpl.address,
      { from: owner },
    )
    await this.registry.setAttribute(this.stakingOpportunityFactory.address, writeAttributeFor(bytes32("isRegisteredContract")), 1, bytes32(""), { from: owner })
    

    this.token = await TrueUSDMock.new(owner, to18Decimals(1000), { from: owner })

    this.stakeToken = await MockTrustToken.new(this.registry.address, { from: owner });

    this.assuranceRegistry = await AssuranceRegistry.new()
    await this.assuranceRegistry.configure(
      this.fractinalExponents.address,
      this.stakingOpportunityFactory.address,
      this.stakeToken.address,
      this.token.address,
    )

    this.financialOpportunity = await FinancialOpportunityMock.new(this.token.address)
    await this.assuranceRegistry.register(this.financialOpportunity.address)

    await this.token.transfer(this.financialOpportunity.address, to18Decimals(100))
  })

  it('proper initial values are set after registering', async function() {
    assert.equal(await this.assuranceRegistry.opportunity(0), this.financialOpportunity.address)
    assert((await this.assuranceRegistry.assuranceBasis(0)).eq(BN(3000)))
    assert((await this.assuranceRegistry.getBalance(0)).eq(BN(0)))
  })

  it('can deposit', async function () {
    await this.token.approve(this.assuranceRegistry.address, to18Decimals(10), { from: owner })
    await this.assuranceRegistry.deposit(0, owner, to18Decimals(10))
    assert((await this.assuranceRegistry.getBalance(0)).eq(BN(10)))
  })
})
