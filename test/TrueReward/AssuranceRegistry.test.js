const AssuranceRegistry = artifacts.require('AssuranceRegistry')
const FractionalExponents = artifacts.require('FractionalExponents')
const StakingOpportunityFactory = artifacts.require('StakingOpportunityFactory')
const RegistryMock = artifacts.require('RegistryMock')
const TrueUSDMock = artifacts.require("TrueUSDMock")
const MockTrustToken = artifacts.require('MockTrustToken')
const StakedTokenProxyImplementation = artifacts.require('StakedTokenProxyImplementation')

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

    this.token = await TrueUSDMock.new(owner, to18Decimals(100), { from: owner })

    this.stakeToken = await MockTrustToken.new(this.registry.address, { from: owner });

    this.assuranceRegistry = await AssuranceRegistry.new()
    await this.assuranceRegistry.configure(
      this.fractinalExponents.address,
      this.stakingOpportunityFactory.address,
      this.stakeToken.address,
      this.token.address,
    )
  })

  it('works', async function() {

  })
})
