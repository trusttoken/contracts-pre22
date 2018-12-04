import assertRevert from './helpers/assertRevert'
import expectThrow from './helpers/expectThrow'
const Registry = artifacts.require("Registry")
const TrueUSD = artifacts.require("TrueUSD")
const BalanceSheet = artifacts.require("BalanceSheet")
const AllowanceSheet = artifacts.require("AllowanceSheet")
const ForceEther = artifacts.require("ForceEther")
const GlobalPause = artifacts.require("GlobalPause")
const Proxy = artifacts.require("OwnedUpgradeabilityProxy")
const FastPauseTrueUSD = artifacts.require("FastPauseTrueUSD")
const TokenController = artifacts.require("TokenController")

contract('--Proxy With Controller--', function (accounts) {
    const [_, owner, oneHundred, otherAddress, mintKey, pauseKey, pauseKey2, approver1, approver2, approver3, spender] = accounts
    const notes = "some notes"

    describe('--Set up proxy--', function () {
        beforeEach(async function () {
            this.registry = await Registry.new({ from: owner })
            this.tokenProxy = await Proxy.new({ from: owner })
            this.tusdImplementation = await TrueUSD.new({ from: owner })
            this.globalPause = await GlobalPause.new({ from: owner })
            this.token = await TrueUSD.at(this.tokenProxy.address)
            this.balanceSheet = await BalanceSheet.new({ from: owner })
            this.allowanceSheet = await AllowanceSheet.new({ from: owner })
            await this.balanceSheet.transferOwnership(this.token.address,{ from: owner })
            await this.allowanceSheet.transferOwnership(this.token.address,{ from: owner })
            await this.tokenProxy.upgradeTo(this.tusdImplementation.address,{ from: owner })
            await this.registry.setAttribute(oneHundred, "hasPassedKYC/AML", 1, "notes", { from: owner })
            await this.registry.setAttribute(oneHundred, "canBurn", 1, "notes", { from: owner })
            await this.token.initialize(0,{from: owner})
            await this.token.setGlobalPause(this.globalPause.address, { from: owner }) 
            await this.token.setBalanceSheet(this.balanceSheet.address, { from: owner })
            await this.token.setAllowanceSheet(this.allowanceSheet.address, { from: owner })   
            this.controllerImplementation = await TokenController.new({ from: owner })
            this.controllerProxy = await Proxy.new({ from: owner })
            await this.controllerProxy.upgradeTo(this.controllerImplementation.address,{ from: owner })
            this.controller = await TokenController.at(this.controllerProxy.address)
            await this.controller.initialize({from: owner})
            await this.controller.setRegistry(this.registry.address, { from: owner })
            await this.controller.setTrueUSD(this.token.address, { from: owner })
            await this.controller.transferMintKey(mintKey, { from: owner })
            await this.registry.setAttribute(oneHundred, "hasPassedKYC/AML", 1, "notes", { from: owner })
            await this.registry.setAttribute(approver1, "isTUSDMintApprover", 1, "notes", { from: owner })
            await this.registry.setAttribute(approver2, "isTUSDMintApprover", 1, "notes", { from: owner })
            await this.registry.setAttribute(approver3, "isTUSDMintApprover", 1, "notes", { from: owner })
            await this.registry.setAttribute(pauseKey, "isTUSDMintPausers", 1, "notes", { from: owner })
        })

        it('controller cannot be reinitialized', async function(){
            await assertRevert(this.controller.initialize({ from: owner }))
        })


        it('owner can transfer ownership to pending owner', async function(){
            await this.controller.transferOwnership(oneHundred, { from: owner })
        })

        it('non owner cannot transfer ownership', async function(){
            await assertRevert(this.controller.transferOwnership(oneHundred, { from: oneHundred }))
        })

        it('pending owner can claim ownerhship', async function(){
            await this.controller.transferOwnership(oneHundred, { from: owner })
            await this.controller.claimOwnership({ from: oneHundred })
        })

        it('non pending owner cannot claim ownership', async function(){
            await this.controller.transferOwnership(oneHundred, { from: owner })
            await assertRevert(this.controller.claimOwnership({ from: otherAddress }))
        })

        it('token can transfer ownership to controller', async function(){
            await this.token.transferOwnership(this.controller.address, { from: owner })
            await this.controller.issueClaimOwnership(this.token.address, { from: owner })
            const tokenOwner = await this.token.owner()
            assert.equal(tokenOwner,this.controller.address)
        })
        it('controller can set tusd registry', async function(){
            await this.token.transferOwnership(this.controller.address, { from: owner })
            await this.controller.issueClaimOwnership(this.token.address, { from: owner })
            await this.controller.setTusdRegistry(this.registry.address, { from: owner })
            const tokenRegistry = await this.token.registry()
            assert.equal(tokenRegistry, this.registry.address)
        })

        describe('--TokenController functions--', async function(){
            beforeEach(async function () {
                await this.token.setRegistry(this.registry.address, { from: owner })
                await this.token.mint(oneHundred, 100*10**18, {from: owner})
                await this.token.transferOwnership(this.controller.address, { from: owner })
                await this.controller.issueClaimOwnership(this.token.address, { from: owner })
                await this.controller.setMintThresholds(10*10**18,100*10**18,1000*10**18, { from: owner })
                await this.controller.setMintLimits(30*10**18,300*10**18,3000*10**18,{ from: owner })
            })

            it('non mintKey/owner cannot request mint', async function () {
                await assertRevert(this.controller.requestMint(oneHundred, 10*10**18 , { from: otherAddress }))
            })

            it('request a mint', async function () {
                const originalMintOperationCount = await this.controller.mintOperationCount()
                assert.equal(originalMintOperationCount, 0)
                await this.controller.requestMint(oneHundred, 10*10**18 , { from: owner })
                const mintOperation = await this.controller.mintOperations(0)
                assert.equal(mintOperation[0], oneHundred)
                assert.equal(Number(mintOperation[1]), 10*10**18)
                assert.equal(Number(mintOperation[3]), 0,"numberOfApprovals not 0")
                const mintOperationCount = await this.controller.mintOperationCount()
                assert.equal(mintOperationCount, 1)

            })
        })
    })
})