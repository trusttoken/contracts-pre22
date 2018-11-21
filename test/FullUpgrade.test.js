import assertRevert from './helpers/assertRevert'
import expectThrow from './helpers/expectThrow'
import assertBalance from './helpers/assertBalance'
const Registry = artifacts.require("Registry")
const TrueUSD = artifacts.require("TrueUSD")
const TrueUSDMock = artifacts.require("TrueUSDMock")
const BalanceSheet = artifacts.require("BalanceSheet")
const AllowanceSheet = artifacts.require("AllowanceSheet")
const GlobalPause = artifacts.require("GlobalPause")
const Proxy = artifacts.require("OwnedUpgradeabilityProxy")
const TimeLockedController = artifacts.require("TimeLockedController")

contract('--Full upgrade process --', function (accounts) {
    const [_, owner, oneHundred, otherAddress, mintKey, pauseKey, pauseKey2, approver1, approver2, approver3, spender] = accounts

    describe('--Set up proxy--', function () {
        beforeEach(async function () {
            this.registry = await Registry.new({ from: owner })
            this.globalPause = await GlobalPause.new({ from: owner })
            this.tokenProxy = await Proxy.new({ from: owner })
            this.tokenImplementation = await TrueUSD.new({ from: owner })
            this.token = await TrueUSD.at(this.tokenProxy.address)
            await this.tokenProxy.upgradeTo(this.tokenImplementation.address,{ from: owner })
            this.controllerImplementation = await TimeLockedController.new({ from: owner })
            this.controllerProxy = await Proxy.new({ from: owner })
            await this.controllerProxy.upgradeTo(this.controllerImplementation.address,{ from: owner })
            this.controller = await TimeLockedController.at(this.controllerProxy.address)
            await this.controller.initialize({from: owner})
            await this.controller.setTrueUSD(this.tokenProxy.address, { from: owner })
            await this.controller.transferMintKey(mintKey, { from: owner })
            await this.controller.setRegistry(this.registry.address, { from: owner })
            await this.registry.setAttribute(oneHundred, "hasPassedKYC/AML", 1, "notes", { from: owner })
            await this.registry.setAttribute(oneHundred, "canBurn", 1, "notes", { from: owner })
            await this.registry.setAttribute(oneHundred, "hasPassedKYC/AML", 1, "notes", { from: owner })
            await this.registry.setAttribute(approver1, "isTUSDMintApprover", 1, "notes", { from: owner })
            await this.registry.setAttribute(approver2, "isTUSDMintApprover", 1, "notes", { from: owner })
            await this.registry.setAttribute(approver3, "isTUSDMintApprover", 1, "notes", { from: owner })
            await this.registry.setAttribute(pauseKey, "isTUSDMintChecker", 1, "notes", { from: owner })
            await this.controller.setMintThresholds(10*10**18,100*10**18,1000*10**18, { from: owner })
            await this.controller.setMintLimits(30*10**18,300*10**18,3000*10**18,{ from: owner })
            await this.controller.refillJumboMintPool({ from: owner })
            await this.controller.refillRatifiedMintPool({ from: owner })
            await this.controller.refillInstantMintPool({ from: owner })
        })
        it('conducts the full upgrade process', async function(){
            this.balanceSheet = await BalanceSheet.new({ from: owner })
            this.allowanceSheet = await AllowanceSheet.new({ from: owner })
            await this.balanceSheet.transferOwnership(this.token.address,{ from: owner })
            await this.allowanceSheet.transferOwnership(this.token.address,{ from: owner })
            await this.controller.initializeTrueUSD(0, { from: owner })
            await this.controller.setGlobalPause(this.globalPause.address, { from: owner }) 
            await this.controller.claimStorageForProxy(this.token.address, 
                                                       this.balanceSheet.address,
                                                       this.allowanceSheet.address, 
                                                       { from: owner })
            await this.controller.changeStakingFees(0,1000,0,1000,0,0,1000,0, {from: owner})                
            await this.controller.setTusdRegistry(this.registry.address, { from: owner })
        })
        it('conducts the full upgrade from the current on chain contract', async function(){
            this.onChainToken = await TrueUSDMock.new(oneHundred, 1000* 10 ^ 18 ,  {from: owner})
            await this.onChainToken.initialize(1000* 10 ^ 18, {from: owner})
            this.balanceSheet = await this.onChainToken.balances()
            this.allowanceSheet = await this.onChainToken.allowances()
            this.onChainController = await TimeLockedController.new({from: owner})
            await this.onChainToken.transferOwnership(this.onChainController.address, { from: owner })
            await this.onChainController.initialize({from: owner})
            await this.onChainController.issueClaimOwnership(this.onChainToken.address, { from: owner })
            await this.onChainController.setTrueUSD(this.onChainToken.address, { from: owner })
            await this.controller.initializeTrueUSD(1000* 10 ^ 18, { from: owner })
            await this.onChainController.requestReclaimContract(this.allowanceSheet, { from: owner })
            await this.onChainController.requestReclaimContract(this.balanceSheet, { from: owner })
            await this.onChainController.issueClaimOwnership(this.allowanceSheet, { from: owner })
            await this.onChainController.issueClaimOwnership(this.balanceSheet, { from: owner })

            await this.onChainController.transferChild(this.allowanceSheet, this.token.address, { from: owner })
            await this.onChainController.transferChild(this.balanceSheet, this.token.address, { from: owner })

            await this.controller.claimStorageForProxy(this.token.address,this.balanceSheet, this.allowanceSheet, { from: owner })
            await this.controller.setGlobalPause(this.globalPause.address, { from: owner }) 
            await this.controller.changeStakingFees(0,1000,0,1000,0,0,1000,0, {from: owner})                
            
            await this.controller.setTusdRegistry(this.registry.address, { from: owner })
            await assertBalance(this.token, oneHundred, 1000* 10 ^ 18)
            await this.controller.requestMint(oneHundred, 10*10**8, { from: owner })
            await this.controller.ratifyMint(0, oneHundred, 10*10**8,{ from: owner })
        })
    })
})