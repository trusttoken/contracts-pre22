import assertRevert from './helpers/assertRevert'
import expectThrow from './helpers/expectThrow'
const Registry = artifacts.require("RegistryMock")
const TrueUSD = artifacts.require("TrueUSDMock")
const Proxy = artifacts.require("OwnedUpgradeabilityProxy")
const TokenController = artifacts.require("TokenController")

const bytes32 = require('./helpers/bytes32.js')
const BN = web3.utils.toBN;

contract('Proxy With Controller', function (accounts) {
    const [_, owner, oneHundred, otherAddress, mintKey, pauseKey, pauseKey2, approver1, approver2, approver3, spender] = accounts
    const notes = bytes32("some notes")
    const CAN_BURN = bytes32("canBurn")

    describe('--Set up proxy--', function () {
        beforeEach(async function () {
            this.registry = await Registry.new({ from: owner })
            this.tokenProxy = await Proxy.new({ from: owner })
            this.tusdImplementation = await TrueUSD.new(owner, 0, { from: owner })
            this.token = await TrueUSD.at(this.tokenProxy.address)

            await this.tokenProxy.upgradeTo(this.tusdImplementation.address,{ from: owner })
            await this.token.initialize({from: owner})

            this.controllerImplementation = await TokenController.new({ from: owner })
            this.controllerProxy = await Proxy.new({ from: owner })
            await this.controllerProxy.upgradeTo(this.controllerImplementation.address,{ from: owner })
            this.controller = await TokenController.at(this.controllerProxy.address)

            await this.controller.initialize({from: owner})
            await this.controller.setRegistry(this.registry.address, { from: owner })
            await this.controller.setToken(this.token.address, { from: owner })
            await this.controller.transferMintKey(mintKey, { from: owner })
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
            assert.equal(this.controller.address, await this.token.pendingOwner.call())
            await this.controller.issueClaimOwnership(this.token.address, { from: owner })
            const tokenOwner = await this.token.owner.call()
            assert.equal(tokenOwner,this.controller.address)
        })
        it('controller can set tusd registry', async function(){
            await this.token.transferOwnership(this.controller.address, { from: owner })
            assert.equal(this.controller.address, await this.token.pendingOwner.call())
            await this.controller.issueClaimOwnership(this.token.address, { from: owner })
            await this.controller.setTokenRegistry(this.registry.address, { from: owner })
            const tokenRegistry = await this.token.registry.call()
            assert.equal(tokenRegistry, this.registry.address)
        })

        describe('--TokenController functions--', async function(){
            beforeEach(async function () {
                await this.token.setRegistry(this.registry.address, { from: owner })
                await this.registry.subscribe(CAN_BURN, this.token.address, { from: owner })
                await this.registry.setAttribute(oneHundred, CAN_BURN, 1, notes, { from: owner })
                await this.registry.setAttribute(approver1, bytes32("isTUSDMintApprover"), 1, notes, { from: owner })
                await this.registry.setAttribute(approver2, bytes32("isTUSDMintApprover"), 1, notes, { from: owner })
                await this.registry.setAttribute(approver3, bytes32("isTUSDMintApprover"), 1, notes, { from: owner })
                await this.registry.setAttribute(pauseKey, bytes32("isTUSDMintPausers"), 1, notes, { from: owner })
                await this.token.mint(oneHundred, BN(100).mul(BN(10**18)), {from: owner})
                await this.token.transferOwnership(this.controller.address, { from: owner })
                await this.controller.issueClaimOwnership(this.token.address, { from: owner })
                await this.controller.setMintThresholds(BN(10*10**18),BN(100).mul(BN(10**18)),BN(1000).mul(BN(10**18)), { from: owner })
                await this.controller.setMintLimits(BN(30*10**18),BN(300).mul(BN(10**18)),BN(3000).mul(BN(10**18)),{ from: owner })
            })

            it('non mintKey/owner cannot request mint', async function () {
                await assertRevert(this.controller.requestMint(oneHundred, BN(10*10**18), { from: otherAddress }))
            })

            it('request a mint', async function () {
                const originalMintOperationCount = await this.controller.mintOperationCount.call()
                assert.equal(originalMintOperationCount, 0)
                await this.controller.requestMint(oneHundred, BN(10*10**18), { from: owner })
                const mintOperation = await this.controller.mintOperations.call(0)
                assert.equal(mintOperation[0], oneHundred)
                assert(mintOperation[1].eq(BN(10*10**18)))
                assert(mintOperation[3].eq(BN(0)),"numberOfApprovals not 0")
                const mintOperationCount = await this.controller.mintOperationCount.call()
                assert(mintOperationCount.eq(BN(1)), 'operation count not 1')

            })
        })
    })
})
