const Registry = artifacts.require('ProvisionalRegistryImplementation')
const Proxy = artifacts.require('OwnedUpgradeabilityProxy')
const TokenController = artifacts.require('TokenController')
const TrueUSD = artifacts.require('TrueUSD')
const TrustToken = artifacts.require('MockTrustToken')
const AssuredFinancialOpportunity = artifacts.require('AssuredFinancialOpportunity')
const AaveFinancialOpportunity = artifacts.require('AaveFinancialOpportunity')
const ExponentContract = artifacts.require('FractionalExponents')
const StakedToken = artifacts.require('StakedToken')
const Liquidator = artifacts.require('Liquidator')
const DeployHelper = artifacts.require('DeployHelper')
const UpgradeHelper = artifacts.require('UpgradeHelper')
const LendingPoolCoreMock = artifacts.require('LendingPoolCoreMock')
const ATokenMock = artifacts.require('ATokenMock')
const LendingPoolMock = artifacts.require('LendingPoolMock')

const bytes32 = require('../helpers/bytes32.js')
const BN = web3.utils.toBN

contract.skip('-----Test Deploy & Upgrade Contracts-----', function (accounts) {
  const [, owner, pauseKey, approver1, approver2, approver3] = accounts
  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

  const notes = bytes32('notes')
  const CAN_BURN = bytes32('canBurn')
  const DOLLAR = BN(10 ** 18)

  describe('--Set Up--', function () {
    before(async function () {
      this.registry = await Registry.new({ from: owner })
      this.tusdProxy = await Proxy.new({ from: owner })
      this.tusd = await TrueUSD.new({ from: owner })
      this.tusdController = await TokenController.new({ from: owner })
      this.controllerProxy = await Proxy.new({ from: owner })

      // await this.tusdController.transferMintKey(mintKey, { from: owner })
      // await this.tusdProxy.upgradeTo(this.tusdImplementation.address,{ from: owner })

      // deploy trusttoken
      this.trusttoken = await TrustToken.new(this.registry.address, { from: owner })

      // deploy uniswap for liquidator
      /*
      this.uniswapFactory = await UniswapFactory.new()
      this.uniswapTemplate = await UniswapExchange.new()
      await this.uniswapFactory.initializeFactory(this.uniswapTemplate.address)
      this.tusdUniswapAddress = (await this.uniswapFactory.createExchange(this.tusd.address)).logs[0].args.exchange
      this.tusdUniswap = await UniswapExchange.at(this.tusdUniswapAddress)
      this.trustUniswapAddress = (await this.uniswapFactory.createExchange(this.trusttoken.address)).logs[0].args.exchange
      this.trustUniswap = await UniswapExchange.at(this.trustUniswapAddress)
      */

      // deploy liquidator
      this.liquidator = await Liquidator.new(this.registry.address,
        this.tusd.address, this.trusttoken.address, ZERO_ADDRESS,
        ZERO_ADDRESS, { from: owner })

      // deploy assurance pool
      this.assurancePool = await StakedToken.new(this.trusttoken.address,
        this.tusdProxy.address, this.registry.address,
        this.liquidator.address, { from: owner })

      this.lendingPoolCore = await LendingPoolCoreMock.new()
      this.sharesToken = await ATokenMock.new(this.tusd.address, this.lendingPoolCore.address)
      this.lendingPool = await LendingPoolMock.new(this.lendingPoolCore.address, this.sharesToken.address)

      // deploy opportunity contracts
      this.exponentContract = await ExponentContract.new({ from: owner })
      this.financialOpportunity = await AaveFinancialOpportunity.new({ from: owner })
      this.financialOpportunityProxy = await Proxy.new({ from: owner })
      this.assuredOpportunity = await AssuredFinancialOpportunity.new({ from: owner })
      this.assuredOpportunityProxy = await Proxy.new({ from: owner })

      this.deployHelper = await DeployHelper.new({ from: owner })

      // transfer proxy ownership to deploy helper
      await this.controllerProxy.transferProxyOwnership(this.deployHelper.address, { from: owner })
      await this.tusdProxy.transferProxyOwnership(this.deployHelper.address, { from: owner })
      await this.liquidator.transferOwnership(this.deployHelper.address, { from: owner })
      await this.assuredOpportunityProxy.transferProxyOwnership(this.deployHelper.address, { from: owner })
      await this.financialOpportunityProxy.transferProxyOwnership(this.deployHelper.address, { from: owner })
      await this.registry.transferOwnership(this.deployHelper.address, { from: owner })

      // call deployHelper
      await this.deployHelper.setup(
        this.registry.address,
        this.tusd.address,
        this.tusdProxy.address,
        this.tusdController.address,
        this.controllerProxy.address,
        this.assuredOpportunity.address,
        this.assuredOpportunityProxy.address,
        this.financialOpportunity.address,
        this.financialOpportunityProxy.address,
        this.exponentContract.address,
        this.assurancePool.address,
        this.liquidator.address,
        this.sharesToken.address,
        this.lendingPool.address,
        { from: owner },
      )

      // reclaim ownership
      await this.controllerProxy.claimProxyOwnership({ from: owner })
      await this.tusdProxy.claimProxyOwnership({ from: owner })
      await this.liquidator.claimOwnership({ from: owner })
      await this.assuredOpportunityProxy.claimProxyOwnership({ from: owner })
      await this.financialOpportunityProxy.claimProxyOwnership({ from: owner })
      await this.registry.claimOwnership({ from: owner })
    })
    it('Owner has control of deployed contracts', async function () {
      this.financialOpportunity = await AaveFinancialOpportunity.at(this.financialOpportunityProxy.address)

      // setup controller through proxy
      this.controller = await TokenController.at(this.controllerProxy.address)
      await this.controller.claimOwnership({ from: owner })

      // assert proxies are owned by owner
      await assert.equal((await this.controllerProxy.proxyOwner()), owner)
      await assert.equal((await this.tusdProxy.proxyOwner()), owner)
      await assert.equal((await this.assuredOpportunityProxy.proxyOwner()), owner)
      await assert.equal((await this.registry.registryOwner()), owner)

      await assert.equal((await this.financialOpportunityProxy.proxyOwner()), owner)
      await assert.equal((await this.financialOpportunity.owner()), this.assuredOpportunityProxy.address)

      await this.controller.setMintThresholds(BN(10 * 10 ** 18), BN(100 * 10 ** 18), DOLLAR.mul(BN(1000)), { from: owner })
      await this.controller.setMintLimits(BN(30 * 10 ** 18), BN(300).mul(DOLLAR), DOLLAR.mul(BN(3000)), { from: owner })
      await this.controller.refillMultiSigMintPool({ from: owner })
      await this.controller.refillRatifiedMintPool({ from: owner })
      await this.controller.refillInstantMintPool({ from: owner })

      // setup registry attributes
      await this.registry.subscribe(CAN_BURN, this.tusdProxy.address, { from: owner })
      // await this.registry.setAttribute(oneHundred, CAN_BURN, 1, notes, { from: owner })
      await this.registry.setAttribute(approver1, bytes32('isTUSDMintApprover'), 1, notes, { from: owner })
      await this.registry.setAttribute(approver2, bytes32('isTUSDMintApprover'), 1, notes, { from: owner })
      await this.registry.setAttribute(approver3, bytes32('isTUSDMintApprover'), 1, notes, { from: owner })
      await this.registry.setAttribute(pauseKey, bytes32('isTUSDMintPausers'), 1, notes, { from: owner })
    })
    describe('Upgrade Helper Setup', async function () {
      before(async function () {
        // deploy upgrade helper
        this.upgradeHelper = await UpgradeHelper.new({ from: owner })
        // transfer proxy ownership to upgrade helper
        await this.controllerProxy.transferProxyOwnership(this.upgradeHelper.address, { from: owner })
        await this.tusdProxy.transferProxyOwnership(this.upgradeHelper.address, { from: owner })
        await this.liquidator.transferOwnership(this.upgradeHelper.address, { from: owner })
        await this.assuredOpportunityProxy.transferProxyOwnership(this.upgradeHelper.address, { from: owner })
        await this.registry.transferOwnership(this.upgradeHelper.address, { from: owner })
        // setup upgradeHelper
        await this.upgradeHelper.setup(
          this.registry.address,
          this.tusdProxy.address,
          this.controllerProxy.address,
          this.assuredOpportunityProxy.address,
          this.financialOpportunity.address,
          this.exponentContract.address,
          this.assurancePool.address,
          this.liquidator.address,
          { from: owner },
        )
      })
      beforeEach(async function () {
        await this.controllerProxy.transferProxyOwnership(this.upgradeHelper.address, { from: owner })
        await this.tusdProxy.transferProxyOwnership(this.upgradeHelper.address, { from: owner })
        await this.assuredOpportunityProxy.transferProxyOwnership(this.upgradeHelper.address, { from: owner })
      })
      afterEach(async function () {
        // claim ownership
        await this.controllerProxy.claimProxyOwnership({ from: owner })
        await this.tusdProxy.claimProxyOwnership({ from: owner })
        await this.assuredOpportunityProxy.claimProxyOwnership({ from: owner })

        // assert ownership
        await assert.equal((await this.controllerProxy.proxyOwner()), owner)
        await assert.equal((await this.tusdProxy.proxyOwner()), owner)
        await assert.equal((await this.assuredOpportunityProxy.proxyOwner()), owner)
        await assert.equal((await this.registry.registryOwner()), owner)
      })
      it('Upgrade TrueUSD', async function () {
        await this.controller.transferOwnership(this.upgradeHelper.address, { from: owner })
        this.newTrueUSD = await TrueUSD.new({ from: owner })
        await this.upgradeHelper.upgradeTrueUSD(this.newTrueUSD.address, { from: owner })
      })
      it('Upgrade TokenController', async function () {
        // create new token controller
        this.newTokenController = await TokenController.new({ from: owner })
        this.newTokenController.transferOwnership
        // this.oldTokenCntroller = await TokenController.at(this.controllerProxy.address)
        // await this.oldTokenCntroller.transferOwnership(this.upgradeHelper.address, { from: owner} )
        // upgrade
        await this.upgradeHelper.upgradeController(this.newTokenController.address, { from: owner })
        // setup token controller (using proxy)
        await this.controller.setMintThresholds(BN(10 * 10 ** 18), BN(100 * 10 ** 18), DOLLAR.mul(BN(1000)), { from: owner })
        await this.controller.setMintLimits(BN(30 * 10 ** 18), BN(300).mul(DOLLAR), DOLLAR.mul(BN(3000)), { from: owner })
        await this.controller.refillMultiSigMintPool({ from: owner })
        await this.controller.refillRatifiedMintPool({ from: owner })
        await this.controller.refillInstantMintPool({ from: owner })
      })
      it.skip('Upgrade Registry', async function () {
        // create new registry
        this.newRegistry = await Registry.new({ from: owner })
        this.registry.transferOwnership(this.upgradeHelper.address, { from: owner })
        // upgrade
        await this.upgradeHelper.upgradeRegistry(this.newRegistry.address, { from: owner })
        await this.registry.claimOwnership({ from: owner }) // claim old registry
        // setup registry attributes
        await this.newRegistry.subscribe(CAN_BURN, this.tusdProxy.address, { from: owner })
        // await this.newRegistry.setAttribute(oneHundred, CAN_BURN, 1, notes, { from: owner })
        await this.newRegistry.setAttribute(approver1, bytes32('isTUSDMintApprover'), 1, notes, { from: owner })
        await this.newRegistry.setAttribute(approver2, bytes32('isTUSDMintApprover'), 1, notes, { from: owner })
        await this.newRegistry.setAttribute(approver3, bytes32('isTUSDMintApprover'), 1, notes, { from: owner })
        await this.newRegistry.setAttribute(pauseKey, bytes32('isTUSDMintPausers'), 1, notes, { from: owner })
      })
      it.skip('Upgrade Assurance', async function () {
        await this.liquidator.transferOwnership(this.upgradeHelper.address, { from: owner })
        // create new opportunity
        this.newAssuredOpportunity = await AssuredFinancialOpportunity.new({ from: owner })
        // upgrade
        await this.upgradeHelper.upgradeAssurance(this.newAssuredOpportunity.address, { from: owner })
        await this.liquidator.claimOwnership({ from: owner })
      })
    })
  })
})
