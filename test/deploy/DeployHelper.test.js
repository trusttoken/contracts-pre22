import assertRevert from '../helpers/assertRevert'
import expectThrow from '../helpers/expectThrow'
import assertBalance from '../helpers/assertBalance'

const Registry = artifacts.require('ProvisionalRegistryImplementation')
const Proxy = artifacts.require('OwnedUpgradeabilityProxy')
const TokenController = artifacts.require('TokenController')
const TrueUSD = artifacts.require('TrueUSD')
const TrustToken = artifacts.require('MockTrustToken')
const AssuredFinancialOpportunity = artifacts.require('AssuredFinancialOpportunity')
const AaveFinancialOpportunity = artifacts.require('AaveFinancialOpportunity')
const FinancialOpportunity = artifacts.require('FinancialOpportunity')
const ExponentContract = artifacts.require('FractionalExponents')
const StakedToken = artifacts.require('StakedToken')
const Liquidator = artifacts.require('Liquidator')
const DeployHelper = artifacts.require('DeployHelper')
const UniswapFactory = artifacts.require('uniswap_factory')
const UniswapExchange = artifacts.require('uniswap_exchange')

const bytes32 = require('../helpers/bytes32.js')
const BN = web3.utils.toBN

contract('-----Full Deploy From Scratch-----', function (accounts) {
  const [_, owner, oneHundred, otherAddress, mintKey, pauseKey, pauseKey2, approver1, approver2, approver3, spender] = accounts

  const notes = bytes32('notes')
  const CAN_BURN = bytes32('canBurn')
  const DOLLAR = BN(10 ** 18)

  describe('--Set up proxy--', function () {
    beforeEach(async function () {
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
        this.tusd.address, this.trusttoken.address, this.tusdUniswap.address,
        this.trustUniswap.address, { from: owner })

      // deploy assurance pool
      this.assurancePool = await StakedToken.new(this.trusttoken.address,
        this.tusd.address, this.registry.address,
        this.liquidator.address, { from: owner })

      // deploy opportunity contracts
      this.exponentContract = await ExponentContract.new({ from: owner })
      this.financialOpportunity = await AaveFinancialOpportunity.new({ from: owner })
      this.assuredOpportunity = await AssuredFinancialOpportunity.new({ from: owner })
      this.assuredOpportunityProxy = await Proxy.new({ from: owner })
    })
    it('deploy contract using DeployHelper', async function () {
      this.deployHelper = await DeployHelper.new({ from: owner })

      // transfer proxy ownership to deploy helper
      await this.controllerProxy.transferProxyOwnership(this.deployHelper.address, { from: owner })
      await this.tusdProxy.transferProxyOwnership(this.deployHelper.address, { from: owner })
      await this.liquidator.transferOwnership(this.deployHelper.address, { from: owner })
      await this.assuredOpportunityProxy.transferProxyOwnership(this.deployHelper.address, { from: owner })
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
        this.exponentContract.address,
        this.assurancePool.address,
        this.liquidator.address,
        { from: owner },
      )

      // reclaim ownership
      await this.controllerProxy.claimProxyOwnership({ from: owner })
      await this.tusdProxy.claimProxyOwnership({ from: owner })
      await this.liquidator.claimOwnership({ from: owner })
      await this.assuredOpportunityProxy.claimProxyOwnership({ from: owner })
      await this.registry.claimOwnership({ from: owner })

      // setup controller through proxy
      this.controller = await TokenController.at(this.controllerProxy.address)
      await this.controller.claimOwnership({ from: owner })

      // assert proxies are owned by owner
      await assert.equal((await this.controllerProxy.proxyOwner()), owner)
      await assert.equal((await this.tusdProxy.proxyOwner()), owner)
      await assert.equal((await this.assuredOpportunityProxy.proxyOwner()), owner)
      await assert.equal((await this.registry.registryOwner()), owner)

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
  })
})
