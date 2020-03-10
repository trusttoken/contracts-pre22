import assertRevert from './helpers/assertRevert'
import assertBalance from './helpers/assertBalance'
const Registry = artifacts.require("RegistryMock")
const BalanceSheet = artifacts.require("BalanceSheet")
const AllowanceSheet = artifacts.require("AllowanceSheet")
const TokenController = artifacts.require("TokenController")
const TrueUSD = artifacts.require("TrueUSDMock")
const ForceEther = artifacts.require("ForceEther")
const FastPauseMints = artifacts.require("FastPauseMints")
const FastPauseTrueUSD = artifacts.require("FastPauseTrueUSD")
const Proxy = artifacts.require("OwnedUpgradeabilityProxy")
const Claimable = artifacts.require("Claimable")
const Ownable = artifacts.require("Ownable")

const bytes32 = require('./helpers/bytes32.js')
const BN = web3.utils.toBN;

contract('TokenController', function (accounts) {

    describe('--TokenController Tests--', function () {
        const [_, owner, oneHundred, otherAddress, mintKey, pauseKey, pauseKey2, ratifier1, ratifier2, ratifier3, redemptionAdmin] = accounts
        const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
        const notes = bytes32("notes")
        const DOLLAR = BN(10**18)
        const CAN_BURN = bytes32("canBurn")
        const BLACKLISTED = bytes32("isBlacklisted")

        beforeEach(async function () {
            this.registry = await Registry.new({ from: owner })
            this.tokenProxy = await Proxy.new({ from: owner })
            this.tusdImplementation = await TrueUSD.new(owner, 0, { from: owner })
            this.token = await TrueUSD.at(this.tokenProxy.address)
            await this.tokenProxy.upgradeTo(this.tusdImplementation.address,{ from: owner })
            await this.token.initialize({from: owner})
            this.controller = await TokenController.new({ from: owner })
            await this.token.transferOwnership(this.controller.address, {from: owner})
            await this.controller.initialize({ from: owner })
            await this.controller.issueClaimOwnership(this.token.address, {from: owner})
            this.fastPauseMints = await FastPauseMints.new(pauseKey2, this.controller.address, { from: owner })
            await this.controller.setRegistry(this.registry.address, { from: owner })
            await this.controller.setToken(this.token.address, { from: owner })
            await this.controller.setTokenRegistry(this.registry.address, { from: owner })
            await this.controller.transferMintKey(mintKey, { from: owner })
            await this.tokenProxy.transferProxyOwnership(this.controller.address, {from: owner})
            await this.controller.claimTusdProxyOwnership({from: owner})
            await this.registry.subscribe(CAN_BURN, this.token.address, { from: owner })
            await this.registry.subscribe(BLACKLISTED, this.token.address, { from: owner })
            await this.registry.setAttribute(oneHundred, CAN_BURN, 1, notes, { from: owner })
            await this.registry.setAttribute(ratifier1, bytes32("isTUSDMintRatifier"), 1, notes, { from: owner })
            await this.registry.setAttribute(ratifier2, bytes32("isTUSDMintRatifier"), 1, notes, { from: owner })
            await this.registry.setAttribute(ratifier3, bytes32("isTUSDMintRatifier"), 1, notes, { from: owner })
            await this.registry.setAttribute(pauseKey, bytes32("isTUSDMintPausers"), 1, notes, { from: owner })
            await this.registry.setAttribute(this.fastPauseMints.address, bytes32("isTUSDMintPausers"), 1, notes, { from: owner })
            await this.controller.setMintThresholds(BN(200*10**18),BN(1000).mul(DOLLAR),BN(1001).mul(DOLLAR), { from: owner })
            await this.controller.setMintLimits(BN(200*10**18),BN(300).mul(DOLLAR),BN(3000).mul(DOLLAR),{ from: owner })
            await this.controller.refillMultiSigMintPool({ from: owner })
            await this.controller.refillRatifiedMintPool({ from: owner })
            await this.controller.refillInstantMintPool({ from: owner })
            await this.controller.instantMint(oneHundred, DOLLAR.mul(BN(100)), { from: owner})
            await this.controller.setMintLimits(0,0,0, { from: owner })
        })

        describe('Request and Finalize Mints (owner)', function () {

            beforeEach(async function () {
                await this.controller.setMintThresholds(BN(10*10**18),BN(100).mul(BN(10**18)),BN(1000).mul(BN(10**18)), { from: owner })
                await this.controller.setMintLimits(BN(30).mul(BN(10**18)),BN(300).mul(BN(10**18)),BN(3000).mul(BN(10**18)),{ from: owner })
            })

            it('mint limits cannot be out of order', async function(){
                await assertRevert(this.controller.setMintLimits(BN(300).mul(BN(10**18)),BN(30*10**18),BN(3000).mul(BN(10**18)),{ from: owner }))
                await assertRevert(this.controller.setMintLimits(BN(30*10**18),BN(300).mul(BN(10**18)),BN(200).mul(BN(10**18)),{ from: owner }))
            })

            it('mint thresholds cannot be out of order', async function(){
                await assertRevert(this.controller.setMintThresholds(BN(100).mul(BN(10**18)),BN(10*10**18),BN(1000).mul(BN(10**18)), { from: owner }))
                await assertRevert(this.controller.setMintThresholds(BN(10*10**18),BN(100).mul(BN(10**18)),BN(50*10**18), { from: owner }))
            })

            it('non mintKey/owner cannot request mint', async function () {
                await assertRevert(this.controller.requestMint(oneHundred, BN(10*10**18) , { from: otherAddress }))
            })

            it('request a mint', async function () {
                const originalMintOperationCount = await this.controller.mintOperationCount.call()
                assert(originalMintOperationCount.eq(BN(0)))
                await this.controller.requestMint(oneHundred, BN(10*10**18) , { from: owner })
                const mintOperation = await this.controller.mintOperations.call(0)
                assert.equal(mintOperation[0], oneHundred)
                assert(mintOperation[1].eq(BN(10*10**18)))
                assert(mintOperation[3].eq(BN(0)),"numberOfApprovals not 0")
                const mintOperationCount = await this.controller.mintOperationCount.call()
                assert(BN(mintOperationCount).eq(BN(1)))
            })

            it('request mint then revoke it', async function () {
                await this.controller.requestMint(oneHundred, BN(10*10**18) , { from: mintKey })
                const { logs } = await this.controller.revokeMint(0, {from: mintKey})
                assert.equal(logs.length, 1)
                assert.equal(logs[0].event, 'RevokeMint')
                assert.equal(logs[0].args.opIndex, 0,"wrong opIndex")
                const mintOperation = await this.controller.mintOperations(0)
                assert.equal(mintOperation[0], "0x0000000000000000000000000000000000000000","to address not 0")
                assert(mintOperation[1].eq(BN(0)),"value not 0")
                assert(mintOperation[2].eq(BN(0)),"requested block not 0")
                assert(mintOperation[3].eq(BN(0)),"numberOfApprovals not 0")
            })

            it('request and finalize a mint', async function () {
                await this.controller.requestMint(oneHundred, BN(10*10**18) , { from: owner })
                const {logs} = await this.controller.ratifyMint(0, oneHundred, BN(10*10**18), {from: owner})
                assert.equal(logs[0].event,"MintRatified", 'event 0 name');
                assert(logs[0].args.opIndex.eq(BN(0)), 'event 0 opIndex');
                assert.equal(logs[0].args.ratifier,owner, 'event 0 ratifier');
                assert.equal(logs[1].event,"FinalizeMint", 'event 1 name');
                assert(logs[1].args.value.eq(BN(10*10**18)), 'event 1 value');
                assert.equal(logs[1].args.to,oneHundred, 'event 1 to');
                assert(logs[1].args.opIndex.eq(BN(0)), 'event 1 opIndex');
                assert.equal(logs[1].args.mintKey,owner, 'event 1 mintKey');
                const totalSupply = await this.token.totalSupply.call()
                assert(totalSupply.eq(BN(10**18).mul(BN(110))), 'total supply');
            })

            it('fails to transfer mintkey to 0x0', async function () {
                await assertRevert(this.controller.transferMintKey("0x0000000000000000000000000000000000000000", { from: owner }))
            })


            it('non owner/mintkey cannot transfer mintkey', async function () {
                await assertRevert(this.controller.transferMintKey(oneHundred, { from: otherAddress }))
            })
        })

        describe('Emit Proper Event Logs', async function(){
            it("transfer mintkey should generate logs", async function(){
                const {logs} = await this.controller.transferMintKey(oneHundred, { from: owner })
                assert.equal(logs[0].event,"TransferMintKey");
                assert.equal(logs[0].args.previousMintKey,mintKey);
                assert.equal(logs[0].args.newMintKey,oneHundred);
            })

            it("pause mint should generate logs", async function(){
                const {logs} = await this.controller.pauseMints({ from: owner })
                assert.equal(logs[0].event,"AllMintsPaused");
                assert.equal(logs[0].args.status,true);
            })

            it("changing mint thresholds should generate logs", async function(){
                const {logs} = await this.controller.setMintThresholds(BN(10*10**18),BN(100).mul(BN(10**18)),BN(1000).mul(BN(10**18)), { from: owner })
                assert.equal(logs[0].event,"MintThresholdChanged" )
                assert(logs[0].args.instant.eq(BN(10*10**18)))
                assert(logs[0].args.ratified.eq(BN(100).mul(BN(10**18))))
                assert((logs[0].args.multiSig).eq(BN(1000).mul(BN(10**18))))
            })

            it("changing mint limits should generate logs", async function(){
                const {logs} = await this.controller.setMintLimits(BN(30*10**18),BN(300).mul(BN(10**18)),BN(3000).mul(BN(10**18)),{ from: owner })
                assert.equal(logs[0].event, "MintLimitsChanged")
                assert(logs[0].args.instant.eq(BN(30*10**18)))
                assert(logs[0].args.ratified.eq(BN(300).mul(BN(10**18))))
                assert(logs[0].args.multiSig.eq(BN(3000).mul(BN(10**18))))
            })
        })

        describe('Full mint process', function () {
            beforeEach(async function () {
                await this.controller.setMintThresholds(BN(10*10**18),BN(100).mul(DOLLAR),BN(1000).mul(DOLLAR), { from: owner })
                await this.controller.setMintLimits(BN(30*10**18),BN(300).mul(DOLLAR),BN(3000).mul(DOLLAR),{ from: owner })
                await this.controller.refillMultiSigMintPool({ from: owner })
                await this.controller.refillRatifiedMintPool({ from: owner })
                await this.controller.refillInstantMintPool({ from: owner })
            })

            it('have enough approvals for mints', async function(){
                let result = await this.controller.hasEnoughApproval.call(1,BN(50*10**18))
                assert.equal(result,true)
                result = await this.controller.hasEnoughApproval.call(1,BN(200).mul(DOLLAR))
                assert.equal(result,false)
                result = await this.controller.hasEnoughApproval.call(3,BN(200).mul(DOLLAR))
                assert.equal(result,true)
                result = await this.controller.hasEnoughApproval.call(3,BN(2000).mul(DOLLAR))
                assert.equal(result,false)
                result = await this.controller.hasEnoughApproval.call(2,BN(500).mul(DOLLAR))
                assert.equal(result,false)
                result = await this.controller.hasEnoughApproval.call(0,BN(50).mul(DOLLAR))
                assert.equal(result,false)
            })

            it('owner can finalize before without approvals', async function(){
                await this.controller.requestMint(oneHundred, BN(10*10**18), { from: mintKey })
                await this.controller.ratifyMint(0, oneHundred, BN(10*10**18), { from: owner })
            })


            it('non ratifiers cannot ratify mints', async function () {
                await this.controller.requestMint(oneHundred, BN(10*10**18), { from: mintKey })
                await assertRevert(this.controller.ratifyMint(0, oneHundred, BN(10*10**18), { from: otherAddress }))
            })

            it('ratifier cannot ratify twice', async function () {
                await this.controller.requestMint(oneHundred, BN(200*10**18), { from: mintKey })
                await this.controller.ratifyMint(0, oneHundred, BN(200*10**18), { from: ratifier1 })
                await assertRevert(this.controller.ratifyMint(0, oneHundred, BN(200).mul(BN(10**18)), { from: ratifier1 }))
            })

            it('ratify mint should generate logs', async function(){
                await this.controller.requestMint(oneHundred, BN(10*10**18), { from: mintKey })
                const {logs} = await this.controller.ratifyMint(0, oneHundred, BN(10*10**18), { from: ratifier1 })
                assert.equal(logs[0].event,"MintRatified")
                assert.equal(logs[0].args.ratifier,ratifier1)
                assert(logs[0].args.opIndex.eq(BN(0)))
            })
    
            it('cannot approve the same mint twice', async function () {
                await this.controller.requestMint(oneHundred, BN(10*10**18) , { from: mintKey })
                await this.controller.ratifyMint(0, oneHundred, BN(10*10**18), { from: ratifier1 })
                await assertRevert(this.controller.ratifyMint(0, oneHundred, BN(10*10**18), { from: ratifier1 }))
            })

            it('cannot request mint when mint paused', async function () {
                await this.controller.pauseMints({ from: pauseKey })
                await assertRevert(this.controller.requestMint(oneHundred, BN(10*10**18) , { from: mintKey }))
            })

            it('non pause key cannot pause mint', async function () {
                await assertRevert(this.controller.pauseMints({ from: otherAddress }))
            })

            it('pause key cannot unpause', async function () {
                await assertRevert(this.controller.unpauseMints({ from: pauseKey }))
            })

            it('owner pauses then unpause then mints', async function () {
                await this.controller.pauseMints({ from: owner })
                await this.controller.unpauseMints({ from: owner })
                await this.controller.requestMint(oneHundred, BN(10*10**18) , { from: mintKey })
            })

            it('fastpause cannot be created with 0x0 in constructor', async function(){
                await assertRevert(FastPauseMints.new(ZERO_ADDRESS, this.controller.address, { from: owner }))
                await assertRevert(FastPauseMints.new(oneHundred, ZERO_ADDRESS, { from: owner }))
            })

            it('pauseKey2 should be able to pause mints by sending in ether', async function(){
                await this.fastPauseMints.sendTransaction({from: pauseKey2, gas: 800000, value: 10});                  
                let paused = await this.controller.mintPaused.call()    
                assert.equal(paused, true)
                await assertRevert(this.controller.requestMint(oneHundred, BN(10*10**18) , { from: mintKey }))
                await assertRevert(this.fastPauseMints.sendTransaction({from: pauseKey, gas: 800000, value: 10}));                  
                await this.controller.unpauseMints({ from: owner })
                paused = await this.controller.mintPaused.call()  
                assert.equal(paused, false)  
            })

            it('ratify fails when the amount does not match', async function() {
                await this.controller.requestMint(oneHundred, BN(10*10**18) , { from: mintKey })
                await assertRevert(this.controller.ratifyMint(0, oneHundred, BN(11*10**18), { from: ratifier1 }))
            })

            it('ratify fails when the to address does not match', async function() {
                await this.controller.requestMint(oneHundred, BN(10*10**18) , { from: mintKey })
                await assertRevert(this.controller.ratifyMint(0, otherAddress, BN(10*10**18), { from: ratifier1 }))
            })

            it('instant mint a small amount', async function() {
                const {logs} = await this.controller.instantMint(otherAddress, BN(10*10**18) , { from: mintKey })
                await assertBalance(this.token, otherAddress, BN(10*10**18))
            })

            it('cannot instant mint over the instant mint threshold', async function() {
                await assertRevert(this.controller.instantMint(otherAddress, BN(15*10**18) , { from: mintKey }))
            })

            it('cannot instant when the instant mint pool is dry', async function() {
                await this.controller.instantMint(otherAddress, BN(10*10**18) , { from: mintKey })
                await this.controller.instantMint(otherAddress, BN(10*10**18) , { from: mintKey })
                await this.controller.instantMint(otherAddress, BN(8*10**18) , { from: mintKey })
                await assertRevert(this.controller.instantMint(otherAddress, BN(5*10**18) , { from: mintKey }))
            })


            it('does the entire ratify mint process', async function () {
                await this.controller.requestMint(otherAddress, BN(20*10**18) , { from: mintKey })
                await this.controller.ratifyMint(0, otherAddress, BN(20*10**18) , { from: ratifier1 })
                await assertBalance(this.token, otherAddress, BN(20*10**18))
                const remainRatifyPool = await this.controller.ratifiedMintPool.call()
                // 300 (ratified mint pool) - 30 (instant mint pool) - 20 (ratified mint) = 250
                assert(remainRatifyPool.eq(BN(250).mul(DOLLAR)), remainRatifyPool + ' != ' + '250000000000000000000')
            })

            it('single approval ratify does not finalize if over the ratifiedMintthreshold', async function () {
                await this.controller.requestMint(otherAddress, BN(200).mul(BN(10**18)) , { from: mintKey })
                await this.controller.ratifyMint(0, otherAddress, BN(200).mul(BN(10**18)) , { from: ratifier1 })
                await assertBalance(this.token, otherAddress, 0)
            })

            it('single approval ratify mint does not finalize if over the ratifiedMintPool is dry', async function () {
                await this.controller.requestMint(otherAddress, BN(100).mul(DOLLAR) , { from: mintKey })
                await this.controller.ratifyMint(0, otherAddress, BN(100).mul(DOLLAR) , { from: ratifier1 })
                await this.controller.requestMint(otherAddress, BN(100).mul(DOLLAR) , { from: mintKey })
                await this.controller.ratifyMint(1, otherAddress, BN(100).mul(DOLLAR) , { from: ratifier1 })
                await this.controller.requestMint(otherAddress, BN(30*10**18) , { from: mintKey })
                await this.controller.ratifyMint(2, otherAddress, BN(30*10**18) , { from: ratifier1 })
                await this.controller.requestMint(otherAddress, BN(50).mul(DOLLAR) , { from: mintKey })
                await this.controller.ratifyMint(3, otherAddress, BN(50).mul(DOLLAR) , { from: ratifier1 })
                await assertBalance(this.token, otherAddress, BN(230).mul(DOLLAR))
            })

            it('cannot finalize mint without enough approvers', async function(){
                await this.controller.requestMint(otherAddress, BN(50).mul(BN(10**18)) , { from: mintKey })
                await assertRevert(this.controller.finalizeMint(0, {from : mintKey}))
                await this.controller.ratifyMint(0, otherAddress, BN(50*10**18) , { from: ratifier1 })
                await this.controller.requestMint(otherAddress, BN(500).mul(BN(10**18)) , { from: mintKey })
                await this.controller.ratifyMint(1, otherAddress, BN(500).mul(BN(10**18)) , { from: ratifier1 })
                await this.controller.ratifyMint(1, otherAddress, BN(500).mul(BN(10**18)) , { from: ratifier2 })
                await assertRevert(this.controller.finalizeMint(1, {from : mintKey}))
                await this.controller.ratifyMint(1, otherAddress, BN(500).mul(BN(10**18)) , { from: ratifier3 })
            })

            it('owner can finalize mint without ratifiers', async function(){
                await this.controller.requestMint(otherAddress, BN(50*10**18) , { from: mintKey })
                await this.controller.finalizeMint(0, {from : owner})
                await this.controller.requestMint(otherAddress, BN(500).mul(BN(10**18)) , { from: mintKey })
                await this.controller.finalizeMint(1, {from : owner})
            })

            it('does the entire multiSig mint process', async function () {
                await this.controller.requestMint(otherAddress, BN(200).mul(BN(10**18)) , { from: mintKey })
                await this.controller.ratifyMint(0, otherAddress, BN(200).mul(BN(10**18)) , { from: ratifier1 })
                await this.controller.ratifyMint(0, otherAddress, BN(200).mul(BN(10**18)) , { from: ratifier2 })
                await this.controller.ratifyMint(0, otherAddress, BN(200).mul(BN(10**18)) , { from: ratifier3 })
                await assertBalance(this.token, otherAddress, BN(200).mul(BN(10**18)))
                const remainMultiSigPool = await this.controller.multiSigMintPool.call()
                assert.equal(Number(remainMultiSigPool), BN(2500).mul(BN(10**18)))
            })

            it('multiSig mint does not finalize if over the jumbpMintthreshold', async function () {
                await this.controller.requestMint(otherAddress, BN(2000).mul(BN(10**18)) , { from: mintKey })
                await this.controller.ratifyMint(0, otherAddress, BN(2000).mul(BN(10**18)) , { from: ratifier1 })
                await this.controller.ratifyMint(0, otherAddress, BN(2000).mul(BN(10**18)) , { from: ratifier2 })
                await this.controller.ratifyMint(0, otherAddress, BN(2000).mul(BN(10**18)) , { from: ratifier3 })
                await assertBalance(this.token, otherAddress, 0)
            })

            it('multiSig mint does not finalize if over the multiSigMintPool is dry', async function () {
                await this.controller.requestMint(otherAddress, BN(1000).mul(BN(10**18)) , { from: mintKey })
                await this.controller.ratifyMint(0, otherAddress, BN(1000).mul(BN(10**18)) , { from: ratifier1 })
                await this.controller.ratifyMint(0, otherAddress, BN(1000).mul(BN(10**18)) , { from: ratifier2 })
                await this.controller.ratifyMint(0, otherAddress, BN(1000).mul(BN(10**18)) , { from: ratifier3 })
                await this.controller.requestMint(otherAddress, BN(1000).mul(BN(10**18)) , { from: mintKey })
                await this.controller.ratifyMint(1, otherAddress, BN(1000).mul(BN(10**18)) , { from: ratifier1 })
                await this.controller.ratifyMint(1, otherAddress, BN(1000).mul(BN(10**18)) , { from: ratifier2 })
                await this.controller.ratifyMint(1, otherAddress, BN(1000).mul(BN(10**18)) , { from: ratifier3 })
                await this.controller.requestMint(otherAddress, BN(300).mul(BN(10**18)) , { from: mintKey })
                await this.controller.ratifyMint(2, otherAddress, BN(300).mul(BN(10**18)) , { from: ratifier1 })
                await this.controller.ratifyMint(2, otherAddress, BN(300).mul(BN(10**18)) , { from: ratifier2 })
                await this.controller.ratifyMint(2, otherAddress, BN(300).mul(BN(10**18)) , { from: ratifier3 })
                await this.controller.requestMint(otherAddress, BN(500).mul(BN(10**18)) , { from: mintKey })
                await this.controller.ratifyMint(3, otherAddress, BN(500).mul(BN(10**18)) , { from: ratifier1 })
                await this.controller.ratifyMint(3, otherAddress, BN(500).mul(BN(10**18)) , { from: ratifier2 })
                await this.controller.ratifyMint(3, otherAddress, BN(500).mul(BN(10**18)) , { from: ratifier3 })
                await assertBalance(this.token, otherAddress, BN(2300).mul(BN(10**18)))
            })

            it('owner can mint unlimited amount', async function () {
                await this.controller.requestMint(oneHundred, BN(10000).mul(BN(10**18)), { from: mintKey })
                await this.controller.ratifyMint(0, oneHundred, BN(10000).mul(BN(10**18)), { from: owner })
            })

            it('pause key can pause specific mint', async function() {
                await this.controller.requestMint(oneHundred, BN(10).mul(BN(10**18)), { from: mintKey })
                await this.controller.pauseMint(0, { from: pauseKey })
                await assertRevert(this.controller.ratifyMint(0, oneHundred, BN(10*10**18), { from: ratifier1 }))
            })

            it('pause key cannot unpause specific mint', async function() {
                await this.controller.requestMint(oneHundred, BN(10*10**18), { from: mintKey })
                await this.controller.pauseMint(0, { from: pauseKey })
                await assertRevert(this.controller.unpauseMint(0, { from: pauseKey }))               
            })

            it('owner can unpause specific mint', async function() {
                await this.controller.requestMint(oneHundred, BN(10*10**18), { from: mintKey })
                await this.controller.pauseMint(0, { from: pauseKey })
                await this.controller.unpauseMint(0, { from: owner })     
                await this.controller.ratifyMint(0, oneHundred, BN(10*10**18), { from: ratifier1 })
            })

            it('cannot finalize after all request invalidated', async function() {
                await this.controller.requestMint(oneHundred, BN(10*10**18), { from: mintKey })
                await this.controller.requestMint(oneHundred, BN(10*10**18), { from: mintKey })
                await this.controller.invalidateAllPendingMints({from: owner})
                await assertRevert(this.controller.ratifyMint(0, oneHundred, BN(10*10**18), { from: ratifier1 }))
                await assertRevert(this.controller.ratifyMint(1, oneHundred, BN(10*10**18), { from: ratifier1 }))
            })
        })

        describe('refill mint pool', function(){
            beforeEach(async function () {
                await this.controller.setMintThresholds(BN(10*10**18),BN(100).mul(DOLLAR),BN(1000).mul(DOLLAR), { from: owner })
                await this.controller.setMintLimits(BN(30).mul(DOLLAR),BN(300).mul(DOLLAR),BN(3000).mul(DOLLAR),{ from: owner })
            })

            it('refills multiSig mint pool', async function(){
                const { logs }= await this.controller.refillMultiSigMintPool({ from: owner })
                assert.equal(logs[0].event,"MultiSigPoolRefilled")
                const multiSigPool = await this.controller.multiSigMintPool.call()
                assert.equal(Number(multiSigPool), 3000*10**18)
            })

            it('refills ratify mint pool', async function(){
                await this.controller.refillMultiSigMintPool({ from: owner })
                await this.controller.refillRatifiedMintPool({ from: ratifier1 })
                await this.controller.refillRatifiedMintPool({ from: ratifier2 })
                const { logs } = await this.controller.refillRatifiedMintPool({ from: ratifier3 })
                assert.equal(logs[0].event,"RatifyPoolRefilled")
                const ratifyPool = await this.controller.ratifiedMintPool.call()
                assert.equal(Number(ratifyPool), 300*10**18)
                const multiSigPool = await this.controller.multiSigMintPool.call()
                assert.equal(Number(multiSigPool), 2700*10**18)
            })

            it('refills instant mint pool', async function(){
                await this.controller.refillMultiSigMintPool({ from: owner })
                await this.controller.refillRatifiedMintPool({ from: owner })
                const { logs } = await this.controller.refillInstantMintPool({ from: owner })
                assert.equal(logs[0].event,"InstantPoolRefilled")
                const ratifyPool = await this.controller.ratifiedMintPool.call()
                assert.equal(Number(ratifyPool), 270*10**18)
                const multiSigPool = await this.controller.multiSigMintPool.call()
                assert.equal(Number(multiSigPool), 2700*10**18)
                const instantPool = await this.controller.instantMintPool.call()
                assert.equal(Number(instantPool), 30*10**18)
            })

            it('Ratifier cannot refill RatifiedMintPool alone', async function(){
                await this.controller.refillMultiSigMintPool({ from: owner })
                await this.controller.refillRatifiedMintPool({ from: ratifier1 })
                await this.controller.refillRatifiedMintPool({ from: ratifier2 })
                await assertRevert(this.controller.refillRatifiedMintPool({ from: ratifier1 }))
                await assertRevert(this.controller.refillRatifiedMintPool({ from: ratifier2 }))
            })

            it('refilling the ratify pool clears the array', async function(){
                await this.controller.refillMultiSigMintPool({ from: owner })
                await this.controller.refillRatifiedMintPool({ from: ratifier1 })
                await this.controller.refillRatifiedMintPool({ from: ratifier2 })
                await this.controller.refillRatifiedMintPool({ from: ratifier3 })
                await this.controller.refillRatifiedMintPool({ from: ratifier1 })
                await this.controller.refillRatifiedMintPool({ from: ratifier2 })
            })

            it('can finalize mint after refill', async function(){
                await this.controller.refillMultiSigMintPool({ from: owner })
                await this.controller.requestMint(otherAddress, BN(1000).mul(BN(10**18)) , { from: mintKey })
                await this.controller.ratifyMint(0, otherAddress, BN(1000).mul(BN(10**18)) , { from: ratifier1 })
                await this.controller.ratifyMint(0, otherAddress, BN(1000).mul(BN(10**18)) , { from: ratifier2 })
                await this.controller.ratifyMint(0, otherAddress, BN(1000).mul(BN(10**18)) , { from: ratifier3 })
                await this.controller.requestMint(otherAddress, BN(1000).mul(BN(10**18)) , { from: mintKey })
                await this.controller.ratifyMint(1, otherAddress, BN(1000).mul(BN(10**18)) , { from: ratifier1 })
                await this.controller.ratifyMint(1, otherAddress, BN(1000).mul(BN(10**18)) , { from: ratifier2 })
                await this.controller.ratifyMint(1, otherAddress, BN(1000).mul(BN(10**18)) , { from: ratifier3 })
                await this.controller.requestMint(otherAddress, BN(800).mul(BN(10**18)) , { from: mintKey })
                await this.controller.ratifyMint(2, otherAddress, BN(800).mul(BN(10**18)) , { from: ratifier1 })
                await this.controller.ratifyMint(2, otherAddress, BN(800).mul(BN(10**18)) , { from: ratifier2 })
                await this.controller.ratifyMint(2, otherAddress, BN(800).mul(BN(10**18)) , { from: ratifier3 })
                await this.controller.requestMint(otherAddress, BN(500).mul(BN(10**18)) , { from: mintKey })
                await this.controller.ratifyMint(3, otherAddress, BN(500).mul(BN(10**18)) , { from: ratifier1 })
                await this.controller.ratifyMint(3, otherAddress, BN(500).mul(BN(10**18)) , { from: ratifier2 })
                await this.controller.ratifyMint(3, otherAddress, BN(500).mul(BN(10**18)) , { from: ratifier3 })
                await assertBalance(this.token, otherAddress, BN(2800).mul(BN(10**18)))
                await this.controller.refillMultiSigMintPool({ from: owner })
                await this.controller.finalizeMint(3, {from : mintKey})
                await assertBalance(this.token, otherAddress, BN(3300).mul(BN(10**18)))
            })
        })

        describe('initialization', function(){
            it('controller cannot be re-initialized', async function () {
                await assertRevert(this.controller.initialize({from:owner}))
            })
        })

        describe('transfer child', function(){
            it('can transfer trueUSD ownership to another address', async function () {
                await this.controller.transferChild(this.token.address, owner,{from:owner})
                const pendingOwner = await this.token.pendingOwner.call();
                assert.equal(pendingOwner,owner)
            })
        })

        describe('setBurnBounds', function () {
            it('sets burnBounds', async function () {
                await this.controller.setBurnBounds(BN(3*10**18), BN(4*10**18), { from: owner })

                const min = await this.token.burnMin.call()
                assert(min.eq(BN(3*10**18)))
                const max = await this.token.burnMax.call()
                assert(max.eq(BN(4*10**18)))
            })

            it('cannot be called by non Owner', async function () {
                await assertRevert(this.controller.setBurnBounds(BN(3*10**18), BN(4*10**18), { from: otherAddress }))
            })

            it('cannot be called by non Owner', async function () {
                await assertRevert(this.controller.setBurnBounds(BN(3*10**18), BN(4*10**18), { from: otherAddress }))
            })
        })

        describe('pause trueUSD and wipe accounts', function(){
            beforeEach(async function(){
                this.fastPauseTrueUSD = await FastPauseTrueUSD.new(pauseKey, this.controller.address, { from: owner })
                await this.controller.setFastPause(this.fastPauseTrueUSD.address, { from: owner })
            })

            it('fastpauseTusd cannot be created with 0x0', async function(){
                await assertRevert(FastPauseTrueUSD.new(ZERO_ADDRESS, this.controller.address, { from: owner }))
                await assertRevert(FastPauseTrueUSD.new(oneHundred, ZERO_ADDRESS, { from: owner }))    
            })


            it.skip('TokenController can pause TrueUSD transfers', async function(){
                await this.token.transfer(mintKey, BN(10*10**18), { from: oneHundred })
                await this.controller.pauseToken({ from: owner })
                const pausedImpl = await this.tokenProxy.implementation.call()
                assert.equal(pausedImpl, "0x0000000000000000000000000000000000000001")
                await assertRevert(this.token.transfer(mintKey, BN(10*10**18), { from: oneHundred }))
            })

            it('trueUsdPauser can pause TrueUSD by sending ether to fastPause contract', async function(){
                await this.fastPauseTrueUSD.sendTransaction({from: pauseKey, gas: 800000, value: 10}); 
                const pausedImpl = await this.tokenProxy.implementation.call()
                assert.equal(pausedImpl, "0x0000000000000000000000000000000000000001")                 
            })

            it('non pauser cannot pause TrueUSD ', async function(){
                await assertRevert(this.controller.pauseToken({ from: mintKey }));                  
            })

            it('non pauser cannot pause TrueUSD by sending ether to fastPause contract', async function(){
                await assertRevert(this.fastPauseTrueUSD.sendTransaction({from: pauseKey2, gas: 800000, value: 10}));                  
            })

            it('TokenController can wipe blacklisted account', async function(){
                await this.token.transfer(this.token.address, BN(40).mul(BN(10**18)), { from: oneHundred })
                await assertBalance(this.token, this.token.address, 40000000000000000000)
                await this.registry.setAttribute(this.token.address, BLACKLISTED, 1, notes, { from: owner })
                await this.controller.wipeBlackListedTrueUSD(this.token.address, { from: owner })
                await assertBalance(this.token, this.token.address, 0)
            })
        })

        describe('requestReclaimContract', function () {
            it('reclaims the contract', async function () {
                const ownable = await Ownable.new({from:owner});
                await ownable.transferOwnership(this.token.address, {from:owner})
                let ownableOwner = await ownable.owner.call()
                assert.equal(ownableOwner, this.token.address)

                const { logs } = await this.controller.requestReclaimContract(ownable.address, { from: owner })
                ownableOwner = await ownable.owner.call()
                assert.equal(ownableOwner, this.controller.address)

                assert.equal(logs.length, 2)
                assert.equal(logs[1].event, 'RequestReclaimContract')
                assert.equal(logs[1].args.other, ownable.address)
            })

            it('cannot be called by non-owner', async function () {
                const ownable = await Ownable.new({from:owner});
                await ownable.transferOwnership(this.token.address, {from:owner})
                await assertRevert(this.controller.requestReclaimContract(ownable.address, { from: mintKey }))
            })

            it('issues claimOwnership', async function() {
                const claimable = await Claimable.new({ from:owner })
                await claimable.transferOwnership(this.controller.address, { from:owner})
                await this.controller.issueClaimOwnership(claimable.address, { from: owner })
                const claimableOwner = await claimable.owner.call()
                assert.equal(claimableOwner, this.controller.address)
            })
        })

        describe('fall back function', function(){
            it('controller does not accept ether', async function(){
                await assertRevert(this.controller.sendTransaction({from: oneHundred, gas: 600000, value: 10}));
            })
        })

        describe('requestReclaimEther', function () {
            it('reclaims ether', async function () {
                const forceEther = await ForceEther.new({ from: oneHundred, value: "10000000000000000000" })
                await forceEther.destroyAndSend(this.token.address)
                const balance1 = web3.utils.fromWei(await web3.eth.getBalance(owner), 'ether')
                await this.controller.requestReclaimEther({ from: owner })
                const balance2 = web3.utils.fromWei(await web3.eth.getBalance(owner), 'ether')
                assert.isAbove(Number(balance2), Number(balance1))
            })

            it('cannot be called by non-owner', async function () {
                const forceEther = await ForceEther.new({ from: oneHundred, value: "10000000000000000000" })
                await forceEther.destroyAndSend(this.token.address)
                await assertRevert(this.controller.requestReclaimEther({ from: otherAddress }))
            })

            it('can reclaim ether in the controller contract address',  async function () {
                const forceEther = await ForceEther.new({ from: oneHundred, value: "10000000000000000000" })
                await forceEther.destroyAndSend(this.controller.address)
                const balance1 = web3.utils.fromWei(await web3.eth.getBalance(owner), 'ether')
                await this.controller.reclaimEther(owner, { from: owner })
                const balance2 = web3.utils.fromWei(await web3.eth.getBalance(owner), 'ether')
                assert.isAbove(Number(balance2), Number(balance1))
            })
        })

        describe('requestReclaimToken', function () {
            it('reclaims token', async function () {
                await this.token.transfer(this.token.address, BN(40).mul(BN(10**18)), { from: oneHundred })
                await this.controller.requestReclaimToken(this.token.address, { from: owner })
                await assertBalance(this.token, owner, BN(40).mul(BN(10**18)))
            })

            it('cannot be called by non-owner', async function () {
                await this.token.transfer(this.token.address, BN(40).mul(BN(10**18)), { from: oneHundred })
                await assertRevert(this.controller.requestReclaimToken(this.token.address, { from: otherAddress }))
            })

            it('can reclaim token in the controller contract address',  async function () {
                await this.token.transfer(this.controller.address, BN(40).mul(BN(10**18)), { from: oneHundred })
                await this.controller.reclaimToken(this.token.address, owner, { from: owner })
                await assertBalance(this.token, owner, BN(40).mul(BN(10**18)))
            })
        })
    })
})
