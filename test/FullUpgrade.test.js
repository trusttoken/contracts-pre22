import assertRevert from './helpers/assertRevert'
import expectThrow from './helpers/expectThrow'
import assertBalance from './helpers/assertBalance'
const Registry = artifacts.require("ProvisionalRegistryMock")
const TrueUSDMock = artifacts.require("PreMigrationTrueUSDMock")
const BalanceSheet = artifacts.require("BalanceSheet")
const AllowanceSheet = artifacts.require("AllowanceSheet")
const Proxy = artifacts.require("OwnedUpgradeabilityProxy")
const PreMigrationTokenController = artifacts.require("PreMigrationTokenController")

const bytes32 = require('./helpers/bytes32.js')
const BN = web3.utils.toBN;

contract('--Full upgrade process --', function (accounts) {
    const [_, owner, oneHundred, otherAddress, mintKey, pauseKey, pauseKey2, approver1, approver2, approver3, spender] = accounts

    const notes = bytes32("notes");
    const CAN_BURN = bytes32("canBurn")
    const DOLLAR = BN(10**18)

    describe('--Set up proxy--', function () {
        beforeEach(async function () {
            this.registry = await Registry.new({ from: owner })
            this.tokenProxy = await Proxy.new({ from: owner })
            this.tokenImplementation = await TrueUSDMock.new(owner, BN(0), { from: owner })
            this.token = await TrueUSDMock.at(this.tokenProxy.address)
            await this.tokenProxy.upgradeTo(this.tokenImplementation.address,{ from: owner })
            await this.token.initialize({ from:owner });
            this.controllerImplementation = await PreMigrationTokenController.new({ from: owner })
            this.controllerProxy = await Proxy.new({ from: owner })
            await this.controllerProxy.upgradeTo(this.controllerImplementation.address,{ from: owner })
            this.controller = await PreMigrationTokenController.at(this.controllerProxy.address)
            await this.controller.initialize({from: owner})
            await this.controller.setToken(this.tokenProxy.address, { from: owner })
            await this.controller.transferMintKey(mintKey, { from: owner })
            await this.controller.setRegistry(this.registry.address, { from: owner })
            await this.registry.subscribe(CAN_BURN, this.token.address, { from: owner })
            await this.token.setRegistry(this.registry.address, { from: owner })
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
            await this.token.transferOwnership(this.controller.address, {from: owner})
            await this.controller.issueClaimOwnership(this.token.address, {from :owner})
        })
        it('conducts the full upgrade process', async function(){
            this.balanceSheet = await BalanceSheet.new({ from: owner })
            this.allowanceSheet = await AllowanceSheet.new({ from: owner })
            await this.balanceSheet.transferOwnership(this.token.address,{ from: owner })
            await this.allowanceSheet.transferOwnership(this.token.address,{ from: owner })
            await this.controller.claimStorageForProxy(this.token.address, this.balanceSheet.address, this.allowanceSheet.address, { from: owner })
            await this.controller.setTokenRegistry(this.registry.address, { from: owner })
        })
        it('conducts the full upgrade from the current on chain contract', async function(){
            this.onChainToken = await TrueUSDMock.new(oneHundred, BN(1000).mul(BN( 10 ** 18)),  {from: owner})
            this.balanceSheet = await this.onChainToken.balances.call()
            this.allowanceSheet = await this.onChainToken.allowances.call()
            this.onChainController = await PreMigrationTokenController.new({from: owner})
            await this.onChainToken.transferOwnership(this.onChainController.address, { from: owner })
            await this.onChainController.initialize({from: owner})
            await this.onChainController.issueClaimOwnership(this.onChainToken.address, { from: owner })
            await this.onChainController.setToken(this.onChainToken.address, { from: owner })
            await this.onChainController.requestReclaimContract(this.allowanceSheet, { from: owner })
            await this.onChainController.requestReclaimContract(this.balanceSheet, { from: owner })
            await this.onChainController.issueClaimOwnership(this.allowanceSheet, { from: owner })
            await this.onChainController.issueClaimOwnership(this.balanceSheet, { from: owner })

            await this.onChainController.transferChild(this.allowanceSheet, this.token.address, { from: owner })
            await this.onChainController.transferChild(this.balanceSheet, this.token.address, { from: owner })

            await this.controller.claimStorageForProxy(this.token.address,this.balanceSheet, this.allowanceSheet, { from: owner })
            
            await this.controller.setTokenRegistry(this.registry.address, { from: owner })
            await assertBalance(this.token, oneHundred, BN(1000).mul(BN(10 ** 18)))
            await this.controller.requestMint(oneHundred, BN(10*10**8), { from: owner })
            await this.controller.ratifyMint(0, oneHundred, BN(10*10**8),{ from: owner })
        })
    })
})
