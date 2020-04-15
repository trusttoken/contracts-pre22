const OwnedUpgradeabilityProxy = artifacts.require('OwnedUpgradeabilityProxy')
const TrueUSD = artifacts.require('TrueUSD')
const TrueUSDMock = artifacts.require('TrueUSDMock')
const AssuredFinancialOpportunity = artifacts.require('AssuredFinancialOpportunity')
const FractionalExponents = artifacts.require('FractionalExponents')
const ConfigurableFinancialOpportunityMock = artifacts.require('ConfigurableFinancialOpportunityMock')
const UpgradeHelper = artifacts.require('UpgradeHelper')
const TokenController = artifacts.require('TokenController')

contract('UpgradeHelper', function ([owner]) {
  beforeEach(async function () {
    this.fractionalExponents = await FractionalExponents.new()

    this.tusdProxy = await OwnedUpgradeabilityProxy.new()
    this.assuredFinancialOpportunityProxy = await OwnedUpgradeabilityProxy.new()

    this.oldTusdImplementation = await TrueUSDMock.new(owner, 0)
    await this.tusdProxy.upgradeTo(this.oldTusdImplementation.address)
    this.tusdMock = await TrueUSDMock.at(this.tusdProxy.address)
    await this.tusdMock.initialize()
    this.tusdImplementation = await TrueUSD.new()

    this.assuredFinancialOpportunityImplementation = await AssuredFinancialOpportunity.new()
    this.assuredFinancialOpportunity = await AssuredFinancialOpportunity.at(this.assuredFinancialOpportunityProxy.address)

    this.financialOpportunityMock = await ConfigurableFinancialOpportunityMock.new(this.tusdProxy.address)

    this.tokenControllerProxy = await OwnedUpgradeabilityProxy.new()
    this.tokenControllerImplementation = await TokenController.new()

    this.upgradeHelper = await UpgradeHelper.new()

    await this.tusdProxy.transferProxyOwnership(this.upgradeHelper.address)
    this.tusd = await TrueUSD.at(this.tusdProxy.address)
    await this.tusd.transferOwnership(this.upgradeHelper.address)
    await this.assuredFinancialOpportunityProxy.transferProxyOwnership(this.upgradeHelper.address)
    await this.tokenControllerProxy.transferProxyOwnership(this.upgradeHelper.address)

    await this.upgradeHelper.performUpgrade(
      this.tusdProxy.address,
      this.tusdImplementation.address,
      this.assuredFinancialOpportunityProxy.address,
      this.assuredFinancialOpportunityImplementation.address,
      this.financialOpportunityMock.address,
      this.fractionalExponents.address,
      this.tokenControllerProxy.address,
      this.tokenControllerImplementation.address,
    )
  })

  describe('TrueUSD', function () {
    it('ownership is properly set', async function () {
      assert.equal((await this.tusd.pendingOwner()), owner)
    })

    it('ownership is properly set', async function () {
      assert.equal((await this.tusdProxy.pendingProxyOwner()), owner)
    })

    it('properly assigns aaveInterface address', async function () {
      assert.equal((await this.tusd.aaveInterfaceAddress()), this.assuredFinancialOpportunityProxy.address)
    })
  })

  describe('AssuredFinancialOpportunity', function () {
    it('ownership is properly set', async function () {
      assert.equal((await this.assuredFinancialOpportunity.pendingOwner()), owner)
    })

    it('proxy ownership is properly set', async function () {
      assert.equal((await this.assuredFinancialOpportunityProxy.pendingProxyOwner()), owner)
    })
  })

  describe('TokenController', async function () {
    it('proxy ownership is properly set', async function () {
      assert.equal((await this.tokenControllerProxy.pendingProxyOwner()), owner)
    })
  })
})

// used to check bytesize of contract
contract('Check TrueUSD Gas', function () {
  it('get the size of the TrueUSD contract', function () {
    return TrueUSD.deployed().then(function (instance) {
      var bytecode = instance.constructor._json.bytecode
      var deployed = instance.constructor._json.deployedBytecode
      var sizeOfB = bytecode.length / 2
      var sizeOfD = deployed.length / 2
      console.log('size of bytecode in bytes = ', sizeOfB)
      console.log('size of deployed in bytes = ', sizeOfD)
      console.log('initialisation and constructor code in bytes = ', sizeOfB - sizeOfD)
    })
  })
})
