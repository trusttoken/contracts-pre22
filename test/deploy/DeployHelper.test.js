import assertRevert from '../helpers/assertRevert'
import expectThrow from '../helpers/expectThrow'
import assertBalance from '../helpers/assertBalance'
const Registry = artifacts.require("Registry")
//const Registry = artifacts.require("ProvisionalRegistry")
const TrueUSDMock = artifacts.require("PreMigrationTrueUSDMock")
const Proxy = artifacts.require("OwnedUpgradeabilityProxy")
const TokenController = artifacts.require("TokenController")
const TrueUSD = artifacts.require("TrueUSD")
const TrustToken = artifacts.require("MockTrustToken")
const AssuredFinancialOpportunity = artifacts.require("AssuredFinancialOpportunity")
const AaveFinancialOpportunity = artifacts.require("AaveFinancialOpportunity")
const FinancialOpportunity = artifacts.require("FinancialOpportunity")
const ExponentContract = artifacts.require("FractionalExponents")
// todo feewet update npm registry
const StakedToken = artifacts.require("StakedToken")
const Liquidator = artifacts.require("Liquidator")
// const StakedToken = artifacts.require("MockStakedToken")
// const Liquidator = artifacts.require("LiquidatorMock")
const DeployHelper = artifacts.require("DeployHelper")
const UniswapFactory = artifacts.require('uniswap_factory') 
const UniswapExchange = artifacts.require('uniswap_exchange')   

const bytes32 = require('../helpers/bytes32.js')
const BN = web3.utils.toBN;

contract('-----Full Deploy From Scratch-----', function (accounts) {
    const [_, owner, oneHundred, otherAddress, mintKey, pauseKey, pauseKey2, approver1, approver2, approver3, spender] = accounts

    const notes = bytes32("notes");
    const CAN_BURN = bytes32("canBurn")
    const DOLLAR = BN(10**18)

    describe('--Set up proxy--', function () {
        beforeEach(async function () {
            this.registry = await Registry.new({ from: owner })
            this.tokenProxy = await Proxy.new({ from: owner })
            this.tokenImplementation = await TrueUSDMock.new(owner, BN(0), { from: owner })
            //this.token = await TrueUSDMock.at(this.tokenProxy.address)
            //this.token = await TrueUSDMock.new({ from: owner })
            this.token = await TrueUSD.new({ from: owner })
            this.tokenController = await TokenController.new({ from:owner })

            //await this.tokenProxy.upgradeTo(this.tokenImplementation.address,{ from: owner })
            //await this.token.initialize({ from:owner });
            //this.controllerImplementation = await PreMigrationTokenController.new({ from: owner })
            
            this.controllerProxy = await Proxy.new({ from: owner })
            //await this.controllerProxy.upgradeTo(this.controllerImplementation.address,{ from: owner })

            this.trusttoken = await TrustToken.new({ from: owner })
            this.uniswapFactory = await UniswapFactory.new({ from: owner })
            this.uniswapTemplate = await UniswapExchange.new({ from: owner })
            await this.uniswapFactory.initializeFactory(this.uniswapTemplate.address)
            this.tusdUniswapAddress = (await this.uniswapFactory.createExchange(this.tusd.address)).logs[0].args.exchange
            this.tusdUniswap = await UniswapExchange.at(this.tusdUniswapAddress)
            this.trustUniswapAddress = (await this.uniswapFactory.createExchange(this.trust.address)).logs[0].args.exchange
            this.trustUniswap = await UniswapExchange.at(this.trustUniswapAddress)
            
            // deploy trusttoken contracts
            this.liquidator = await Liquidator.new(
                registry, token, trusttoken, tusdUniswap, trustUniswap, { from:owner });
    
            this.assurancePool = await StakedToken.new({ from:owner });

            // deploy opportunity contracts
            this.exponentContract = ExponentContract.new({ from: owner })
            this.financialOpportunity = await AaveFinancialOpportunity.new({ from: owner })
            this.assuredOpportunity = await AssuredFinancialOpportunity.new({ from:owner })
            this.assuredOpportunityProxy = await Proxy.new( {from:owner} )

            //await this.token.transferOwnership(this.controller.address, {from: owner})
            //await this.controller.issueClaimOwnership(this.token.address, {from :owner})
        })
        it('deploy contract using DeployHelper', async function(){
            this.deployHelper = await DeployHelper.new({from: owner})

            // transfer contracts to deploy helper
            await this.trueUSD.transferOwnership(this.deployHelper.address, { from: owner })
            await this.trueUSDProxy.transferOwnership(this.deployHelper.address, { from: owner })
            await this.tokenController.transferOwnership(this.deployHelper.address, { from: owner })
            await this.tokenControllerProxy.transferOwnership(this.deployHelper.address, { from: owner })
            await this.liquidator.transferOwnership(this.deployHelper.address, { from: owner })
            await this.assurancePool.transferOwnership(this.deployHelper.address, { from: owner })

            await this.deployHelper.deploy(
                this.registry.address,
                this.token.address,
                this.tokenProxy.address,
                this.controller.address,
                this.controllerProxy.address,
                this.assuredOpportunity.address,
                this.assuredOpportunityProxy.address,
                this.financialOpportunity.address,
                this.exponentContract.address,
                this.assurancePool.address,
                this.liquidator.address,
                { from:owner }
            );

            // setup controller through proxy
            this.controller = await TokenController.at(this.controllerProxy.address)
            //await this.controller.initialize({from: owner})
            //await this.controller.setToken(this.tokenProxy.address, { from: owner })
            await this.controller.transferMintKey(mintKey, { from: owner })
            //await this.controller.setRegistry(this.registry.address, { from: owner })
            await this.registry.subscribe(CAN_BURN, this.token.address, { from: owner })
            //await this.token.setRegistry(this.registry.address, { from: owner })
            await this.registry.setAttribute(oneHundred, CAN_BURN, 1, notes, { from: owner })
            await this.registry.setAttribute(approver1, bytes32("isTUSDMintApprover"), 1, notes, { from: owner })
            await this.registry.setAttribute(approver2, bytes32("isTUSDMintApprover"), 1, notes, { from: owner })
            await this.registry.setAttribute(approver3, bytes32("isTUSDMintApprover"), 1, notes, { from: owner })
            await this.registry.setAttribute(pauseKey, bytes32("isTUSDMintPausers"), 1, notes, { from: owner })
            await this.controller.setMintThresholds(BN(10*10**18),BN(100*10**18),DOLLAR.mul(BN(1000)), { from: owner })
            await this.controller.setMintLimits(BN(30*10**18),BN(300).mul(DOLLAR),DOLLAR.mul(BN(3000)),{ from: owner })
            await this.controller.refillMultiSigMintPool({ from: owner })
            await this.controller.refillRatifiedMintPool({ from: owner })
            await this.controller.refillInstantMintPool({ from: owner })
        })
    })
})
