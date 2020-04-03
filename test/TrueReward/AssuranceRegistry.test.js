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
import assertBalance from '../helpers/assertBalance'
import { assertApprox } from '../helpers/assertApprox'

const BN = web3.utils.toBN
const to18Decimals = value => BN(Math.floor(value*10**10)).mul(BN(10**8))

contract('AssuranceRegistry', function ([owner, address1]) {
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

    await this.token.transfer(this.financialOpportunity.address, to18Decimals(100)) // for interest payouts
  })

  it('proper initial values are set after registering', async function() {
    assert.equal(await this.assuranceRegistry.opportunity(0), this.financialOpportunity.address)
    assert((await this.assuranceRegistry.assuranceBasis(0)).eq(BN(3000)))
    assert((await this.assuranceRegistry.getBalance(0)).eq(BN(0)))
  })

  it('can deposit', async function () {
    await this.token.approve(this.financialOpportunity.address, to18Decimals(10), { from: owner })
    await this.assuranceRegistry.deposit(0, owner, to18Decimals(10))
    assert((await this.assuranceRegistry.getBalance(0)).eq(to18Decimals(10)))
  })

  it('per token value', async function () {
    assert((await this.assuranceRegistry.perTokenValue(0)).eq(to18Decimals(1)))
    await this.financialOpportunity.setPerTokenValue(to18Decimals(2))
    assertApprox(await this.assuranceRegistry.perTokenValue(0), to18Decimals(1.62), to18Decimals(0.1))
  })

  describe('withdrawal', async function () {
    beforeEach(async function() { 
      await this.token.approve(this.financialOpportunity.address, to18Decimals(10), { from: owner })
      await this.assuranceRegistry.deposit(0, owner, to18Decimals(10))
    })

    it('can withdraw', async function() {
      await this.assuranceRegistry.withdrawTo(0, address1, to18Decimals(5))
      await assertBalance(this.token, address1, to18Decimals(5))
    })

    it('can withdraw more with increased per token value', async function () {
      await this.financialOpportunity.setPerTokenValue(to18Decimals(2))
      await this.assuranceRegistry.withdrawTo(0, address1, to18Decimals(16))
      await assertBalance(this.token, address1, to18Decimals(16))
    })

    describe('liquidation', async function() {
      beforeEach(async function() {
        await this.financialOpportunity.setWithdrawalEnabled(false)
        
        this.liquidatorAddress = await this.assuranceRegistry.liquidator(0)
        await this.token.transfer(this.liquidatorAddress, to18Decimals(100)) // for liquidation
      })

      it('liquidator covers withdrawn amount', async function() {
        await this.assuranceRegistry.withdrawTo(0, address1, to18Decimals(5))
        await assertBalance(this.token, this.liquidatorAddress, to18Decimals(95))
        await assertBalance(this.token, address1, to18Decimals(5))
      })
    })
  })

  it('award pool', async function () {
    await this.token.approve(this.financialOpportunity.address, to18Decimals(10), { from: owner })
    await this.assuranceRegistry.deposit(0, owner, to18Decimals(10))
    await this.financialOpportunity.setPerTokenValue(to18Decimals(2))
    await this.assuranceRegistry.awardPool(0)
    const poolAddress = await this.assuranceRegistry.assurance(0)
    assertApprox(await this.token.balanceOf(poolAddress), to18Decimals(3.8), to18Decimals(0.1))
  })

  it('works with multiple opportunities', async function () {
    const secondFinancialOpportunity = await FinancialOpportunityMock.new(this.token.address)
    await this.assuranceRegistry.register(secondFinancialOpportunity.address)
    await this.token.transfer(secondFinancialOpportunity.address, to18Decimals(100)) // for interest payouts

    await this.token.approve(this.financialOpportunity.address, to18Decimals(10), { from: owner })
    await this.assuranceRegistry.deposit(0, owner, to18Decimals(10))

    await this.token.approve(secondFinancialOpportunity.address, to18Decimals(10), { from: owner })
    await this.assuranceRegistry.deposit(1, owner, to18Decimals(10))

    assert((await this.assuranceRegistry.getBalance(0)).eq(to18Decimals(10)))
    assert((await this.assuranceRegistry.getBalance(1)).eq(to18Decimals(10)))

    await this.assuranceRegistry.withdrawTo(0, address1, to18Decimals(5))
    await assertBalance(this.token, address1, to18Decimals(5))
    await this.assuranceRegistry.withdrawTo(1, address1, to18Decimals(5))
    await assertBalance(this.token, address1, to18Decimals(10))
  })
})
