const OwnedUpgradeabilityProxy = artifacts.require('OwnedUpgradeabilityProxy')
const TrueUSD = artifacts.require("TrueUSD")
const TrueUSDMock = artifacts.require("TrueUSDMock")
const AssuredFinancialOpportunity = artifacts.require("AssuredFinancialOpportunity")
const FractionalExponents = artifacts.require("FractionalExponents")
const ConfigurableFinancialOpportunityMock = artifacts.require("ConfigurableFinancialOpportunityMock")
const UpgradeHelper = artifacts.require('UpgradeHelper')

contract('UpgradeHelper', function ([owner]) {
  beforeEach(async function () {
    this.fractionalExponents = await FractionalExponents.new({from: owner})

    this.tusdProxy = await OwnedUpgradeabilityProxy.new({from: owner})
    this.assuredFinancialOpportunityProxy = await OwnedUpgradeabilityProxy.new({from: owner})

    this.oldTusdImplementation = await TrueUSDMock.new(owner, 0, {from: owner})
    await this.tusdProxy.upgradeTo(this.oldTusdImplementation.address)
    await (await TrueUSDMock.at(this.tusdProxy.address)).setOwner(owner)

    this.tusdImplementation = await TrueUSD.new({from: owner})
    this.assuredFinancialOpportunityImplementation = await AssuredFinancialOpportunity.new({from: owner})

    this.financialOpportunityMock = await ConfigurableFinancialOpportunityMock.new(this.tusdProxy.address, { from: owner })

    this.upgradeHelper = await UpgradeHelper.new({ from: owner })

    await this.tusdProxy.transferProxyOwnership(this.upgradeHelper.address, {from: owner})
    await (await TrueUSD.at(this.tusdProxy.address)).transferOwnership(this.upgradeHelper.address)
    await this.assuredFinancialOpportunityProxy.transferProxyOwnership(this.upgradeHelper.address, {from: owner})

    await this.upgradeHelper.performUpgrade(
      this.tusdProxy.address,
      this.tusdImplementation.address,
      this.assuredFinancialOpportunityProxy.address,
      this.assuredFinancialOpportunityImplementation.address,
      this.financialOpportunityMock.address,
      this.fractionalExponents.address
    )
  })
  
  it('works', async function() {
    // ownership
    // aaveInterface address
    // try to enable true reward for some account (optional)
  })
})