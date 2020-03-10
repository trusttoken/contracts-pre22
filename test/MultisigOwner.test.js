import assertRevert from './helpers/assertRevert'
import assertBalance from './helpers/assertBalance'
const Registry = artifacts.require("RegistryMock")
const TokenController = artifacts.require("TokenController")
const ForceEther = artifacts.require("ForceEther")
const MultisigOwner = artifacts.require("MultiSigOwner")
const TrueUSDMock = artifacts.require("TrueUSDMock")
const Ownable = artifacts.require("Ownable")
const Claimable = artifacts.require("Claimable")

const bytes32 = require('./helpers/bytes32.js')
const BN = web3.utils.toBN;

contract('MultisigOwner', function (accounts) {
    const [_, owner1, owner2, owner3 , oneHundred, blackListed, mintKey, pauseKey, approver] = accounts
    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
    const notes = bytes32("notes")
    const PAUSER = bytes32("isTUSDMintPausers")
    const BLACKLISTED = bytes32("isBlacklisted")

    beforeEach(async function () {
        this.registry = await Registry.new({ from: owner1 })
        this.token = await TrueUSDMock.new(oneHundred, BN(100*10**18), { from: owner1 })
        this.controller = await TokenController.new({ from: owner1 })
        await this.controller.initialize({ from: owner1 })
        await this.controller.setRegistry(this.registry.address, { from: owner1 })
        await this.token.transferOwnership(this.controller.address, { from: owner1 })
        await this.controller.issueClaimOwnership(this.token.address, { from: owner1 })
        await this.controller.setToken(this.token.address, { from: owner1 })
        await this.controller.setTokenRegistry(this.registry.address, { from: owner1 })
        this.claimableContract = await Claimable.new({from: owner1})
        await this.registry.subscribe(BLACKLISTED, this.token.address, { from: owner1 })
        await this.registry.setAttribute(approver, bytes32("isTUSDMintApprover"), 1, notes, { from: owner1 })
        await this.registry.setAttribute(pauseKey, PAUSER, 1, notes, { from: owner1 })
        this.multisigOwner = await MultisigOwner.new({ from: owner1 })
        await this.multisigOwner.msInitialize([owner1, owner2, owner3], { from: owner1 })
    })

    describe('Multisig Contract claiming TokenController', function () {

        it('initial owners cannot be 0x0', async function(){
            this.tempMultisigOwner = await MultisigOwner.new({ from: owner1 })
            await assertRevert(this.tempMultisigOwner.msInitialize([ZERO_ADDRESS, owner2, owner3], { from: owner1 }))
            await assertRevert(this.tempMultisigOwner.msInitialize([owner1, ZERO_ADDRESS, owner3], { from: owner1 }))
            await assertRevert(this.tempMultisigOwner.msInitialize([owner1, owner2, ZERO_ADDRESS], { from: owner1 }))
        })
        it('Multisig can claimownership to TokenController', async function () {
            await this.controller.transferOwnership(this.multisigOwner.address, { from: owner1 })
            const initialOwner = await this.controller.owner.call()
            await this.multisigOwner.msIssueClaimContract(this.controller.address, {from : owner1 })
            const currentOwner = await this.controller.owner.call()
            assert.equal(initialOwner, currentOwner)
            const pendingOwner = await this.controller.pendingOwner.call()
            assert.equal(pendingOwner, this.multisigOwner.address)
            await this.multisigOwner.msIssueClaimContract(this.controller.address, {from : owner2 })
            const finalOwner = await this.controller.owner.call()
            assert.equal(finalOwner, this.multisigOwner.address)
   
        })

        it('multisig cannot claim ownership when there is another action in flight', async function () {
            await this.controller.transferOwnership(this.multisigOwner.address, { from: owner1 })
            await this.multisigOwner.msIssueClaimContract(this.registry.address, {from : owner1 })
            await assertRevert(this.multisigOwner.msIssueClaimContract(this.controller.address, {from : owner2 }));
        })

        it('Multisig cannot claimownership to when ownership is not transferred', async function () {
            await this.multisigOwner.msIssueClaimContract(this.controller.address, {from : owner1 })
            await assertRevert(this.multisigOwner.msIssueClaimContract(this.controller.address, {from : owner2 })) 
        })

        it('non owners cannot call onlyOwner functions', async function(){
            await this.controller.transferOwnership(this.multisigOwner.address, { from: owner1 })
            await assertRevert(this.multisigOwner.msIssueClaimContract(this.controller.address, {from : oneHundred }));
        })
    })

    describe('Functions independent of tokenController', async function(){
        it ('cannot be reinitialized', async function(){
            await assertRevert(this.multisigOwner.msInitialize([owner1, owner2, owner3], {from: owner1}))
        })
        it ('current owners are owners', async function(){
            const owner1Result = await this.multisigOwner.owners.call(owner1)
            const owner2Result = await this.multisigOwner.owners.call(owner2)
            const owner3Result = await this.multisigOwner.owners.call(owner3)
            assert.equal(owner1Result,owner2Result)
            assert.equal(owner1Result,owner3Result)
        })

        it ('Owners can modify owner multisig owners', async function(){
            await this.multisigOwner.msUpdateOwner(owner3, oneHundred, {from : owner1 })
            let newOwnerResult = await this.multisigOwner.owners.call(oneHundred)
            let owner3Result = await this.multisigOwner.owners.call(owner3)
            assert.equal(newOwnerResult,false)
            assert.equal(owner3Result,true)
            await this.multisigOwner.msUpdateOwner(owner3, oneHundred, {from : owner2 })
            newOwnerResult = await this.multisigOwner.owners.call(oneHundred)
            owner3Result = await this.multisigOwner.owners.call(owner3)
            assert.equal(newOwnerResult,true)
            assert.equal(owner3Result,false)
            const ownerList0 = await this.multisigOwner.ownerList.call(0)
            const ownerList1 = await this.multisigOwner.ownerList.call(1)
            const ownerList2 = await this.multisigOwner.ownerList.call(2)

            assert.equal(ownerList0, owner1)
            assert.equal(ownerList1, owner2)
            assert.equal(ownerList2, oneHundred)
        })

        it ('Owners can set TokenController', async function(){
            await this.multisigOwner.msSetTokenController(this.controller.address, {from : owner1 })
            await this.multisigOwner.msSetTokenController(this.controller.address, {from : owner2 })
            const controller = await this.multisigOwner.tokenController.call();
            assert.equal(controller, this.controller.address)
        })


        it ('Owners can transfer contract it owns to other addresses', async function(){
            await this.controller.transferOwnership(this.multisigOwner.address, { from: owner1 })
            await this.multisigOwner.msIssueClaimContract(this.controller.address, {from : owner1 })
            await this.multisigOwner.msIssueClaimContract(this.controller.address, {from : owner2 })
            const currentOwner = await this.controller.owner.call()
            assert.equal(currentOwner, this.multisigOwner.address)

            await this.multisigOwner.msReclaimContract(this.controller.address, oneHundred, {from : owner1 })
            await this.multisigOwner.msReclaimContract(this.controller.address, oneHundred, {from : owner2 })
            const controllerPendingOwner = await this.controller.pendingOwner.call()
            assert.equal(controllerPendingOwner, oneHundred)
        })

        it ('owners can reclaim ether',async function(){
            const emptyAddress = "0x0000000000000000000000000000000000000002"
            await this.multisigOwner.sendTransaction({from: oneHundred, gas: 50000, value: BN(10*10**18)});
            const balanceWithEther = web3.utils.fromWei(await web3.eth.getBalance(this.multisigOwner.address), 'ether')
            assert.equal(balanceWithEther, 10)
            await this.multisigOwner.msReclaimEther(emptyAddress, {from : owner1 })
            await this.multisigOwner.msReclaimEther(emptyAddress, {from : owner2 })
            const multisigFinalBalance = web3.utils.fromWei(await web3.eth.getBalance(this.multisigOwner.address), 'ether')
            const userBalance = web3.utils.fromWei(await web3.eth.getBalance(emptyAddress), 'ether')
            assert.equal(multisigFinalBalance, 0)
            assert.equal(userBalance, 10)
        })

        it('owners can reclaim token', async function(){
            this.basicToken = await TrueUSDMock.new(this.multisigOwner.address, 100, {from: owner1});
            await this.basicToken.setRegistry(this.registry.address, {from: owner1});
            await this.multisigOwner.msReclaimToken(this.basicToken.address, oneHundred, {from : owner1 })
            await this.multisigOwner.msReclaimToken(this.basicToken.address, oneHundred,  {from : owner2 })
            const contractBalance = await this.basicToken.balanceOf.call(this.multisigOwner.address)
            const userBalance = await this.basicToken.balanceOf.call(oneHundred)
            assert.equal(Number(contractBalance), 0)
            assert.equal(Number(userBalance), 100)
        })

        it('owners can veto actions', async function(){
            await this.multisigOwner.msSetTokenController(this.controller.address, {from : owner1 })
            await this.multisigOwner.msVeto({from : owner2 })
            await this.multisigOwner.msVeto({from : owner3 })
            const ownerAction = await this.multisigOwner.ownerAction.call();
            assert.equal(ownerAction[0], null)
            assert.equal(ownerAction[1], '')
            assert.equal(ownerAction[2], 0)
        })

        it('owners cannot veto when there is no action', async function(){
            await assertRevert(this.multisigOwner.msVeto({from : owner3 }))
        })


        it('owner cannot veto an action twice', async function(){
            await this.multisigOwner.msSetTokenController(this.controller.address, {from : owner1 })
            await this.multisigOwner.msVeto({from : owner2 })
            await assertRevert(this.multisigOwner.msVeto({from : owner2 }))
        })

        it('same owner cannot sign the same action twice', async function(){
            await this.multisigOwner.msSetTokenController(this.controller.address, {from : owner1 })
            await assertRevert(this.multisigOwner.msSetTokenController(this.controller.address, {from : owner1 }))
        })

    }) 

    describe('Call tokenController functions', function(){
        beforeEach(async function () {
            await this.controller.transferOwnership(this.multisigOwner.address, { from: owner1 })
            await this.multisigOwner.msIssueClaimContract(this.controller.address, {from : owner1 })
            await this.multisigOwner.msIssueClaimContract(this.controller.address, {from : owner2 })
            await this.multisigOwner.msSetTokenController(this.controller.address, {from : owner1 })
            await this.multisigOwner.msSetTokenController(this.controller.address, {from : owner2 })
        })

        it('call reclaimEther of tokenController', async function(){
            const forceEther = await ForceEther.new({ from: oneHundred, value: "10000000000000000000" })
            await forceEther.destroyAndSend(this.controller.address)
            const controllerInitialBalance = web3.utils.fromWei(await web3.eth.getBalance(this.controller.address), 'ether')
            const multisigInitialBalance = web3.utils.fromWei(await web3.eth.getBalance(this.multisigOwner.address), 'ether')
            await this.multisigOwner.reclaimEther(this.multisigOwner.address, {from: owner1})
            await this.multisigOwner.reclaimEther(this.multisigOwner.address, {from: owner2})
            const controllerFinalBalance = web3.utils.fromWei(await web3.eth.getBalance(this.controller.address), 'ether')
            const multisigFinalBalance = web3.utils.fromWei(await web3.eth.getBalance(this.multisigOwner.address), 'ether')
            assert.equal(controllerInitialBalance, 10)
            assert.equal(multisigInitialBalance, 0)
            assert.equal(controllerFinalBalance, 0)
            assert.equal(multisigFinalBalance, 10)
        })

        it('call reclaimToken of tokenController', async function(){
            await this.token.transfer(this.controller.address, BN(40*10**18), { from: oneHundred })
            await this.multisigOwner.reclaimToken(this.token.address, owner1, { from: owner1 })
            await this.multisigOwner.reclaimToken(this.token.address, owner1, { from: owner2 })
            await assertBalance(this.token, owner1, BN(40*10**18))
        })

        it('function should fail if controller call fails', async function(){
            await this.multisigOwner.transferOwnership(this.claimableContract.address, {from: owner1})
            await assertRevert(this.multisigOwner.transferOwnership(this.claimableContract.address, {from: owner1}))
        })

        it('function should fail if controller call fails pt2', async function(){
            await this.multisigOwner.transferChild(this.controller.address, oneHundred, {from: owner1})
            await assertRevert(this.multisigOwner.transferChild(this.controller.address, oneHundred, {from: owner2}))
        })


        it('call transferOwnership of tokenController', async function(){
            await this.multisigOwner.transferOwnership(oneHundred,{from: owner1})
            await this.multisigOwner.transferOwnership(oneHundred,{from: owner2})
            const pendingOwner = await this.controller.pendingOwner.call()
            assert.equal(pendingOwner, oneHundred)
        })

        it('call setMintThresholds of tokenController', async function(){
            await this.multisigOwner.setMintThresholds(BN(10*10**18),BN(100*10**18),BN(1000).mul(BN(10**18)), { from: owner1 })
            await this.multisigOwner.setMintThresholds(BN(10*10**18),BN(100*10**18),BN(1000).mul(BN(10**18)), { from: owner2 })
        })

        it('call setMintLimits of tokenController', async function(){
            await this.multisigOwner.setMintLimits(BN(30*10**18),BN(300*10**18),BN(3000).mul(BN(10**18)),{ from: owner1 })
            await this.multisigOwner.setMintLimits(BN(30*10**18),BN(300*10**18),BN(3000).mul(BN(10**18)),{ from: owner2 })
        })

        it('call refillMultiSigMintPool of tokenController', async function(){
            await this.multisigOwner.refillMultiSigMintPool({ from: owner1 })
            await this.multisigOwner.refillMultiSigMintPool({ from: owner2 })
        })

        it('call refillRatifiedMintPool of tokenController', async function(){
            await this.multisigOwner.refillMultiSigMintPool({ from: owner1 })
            await this.multisigOwner.refillMultiSigMintPool({ from: owner2 })
            await this.multisigOwner.refillRatifiedMintPool({ from: owner1 })
            await this.multisigOwner.refillRatifiedMintPool({ from: owner2 })
        })

        it('call refillInstantMintPool of tokenController', async function(){
            await this.multisigOwner.refillMultiSigMintPool({ from: owner1 })
            await this.multisigOwner.refillMultiSigMintPool({ from: owner2 })
            await this.multisigOwner.refillRatifiedMintPool({ from: owner1 })
            await this.multisigOwner.refillRatifiedMintPool({ from: owner2 })
            await this.multisigOwner.refillInstantMintPool({ from: owner1 })
            await this.multisigOwner.refillInstantMintPool({ from: owner2 })
        })

        it('call pauseMints of tokenController', async function(){
            await this.multisigOwner.pauseMints({from: owner1})
            await this.multisigOwner.pauseMints({from: owner2})
            let mintPaused = await this.controller.mintPaused.call()
            assert.equal(mintPaused,true)
            await this.multisigOwner.unpauseMints({from: owner1})
            await this.multisigOwner.unpauseMints({from: owner2})
            mintPaused = await this.controller.mintPaused.call()
            assert.equal(mintPaused,false)
        })

        it('call setToken of tokenController', async function(){
            await this.multisigOwner.setToken(this.token.address, {from: owner1})
            await this.multisigOwner.setToken(this.token.address, {from: owner2})
            const trueUSD = await this.controller.token.call()
            assert.equal(trueUSD,this.token.address)
        })

        it('call setTokenRegistry of tokenController', async function(){
            await this.multisigOwner.setTokenRegistry(this.registry.address, {from: owner1})
            await this.multisigOwner.setTokenRegistry(this.registry.address, {from: owner2})
            const registry = await this.token.registry.call()
            assert.equal(registry,this.registry.address)
        })

        it('call transferChild of tokenController', async function(){
            await this.multisigOwner.transferChild(this.token.address, oneHundred, {from: owner1})
            await this.multisigOwner.transferChild(this.token.address, oneHundred, {from: owner2})
            const pendingOwner = await this.token.pendingOwner.call()
            assert.equal(pendingOwner, oneHundred)
        })

        
        it('requestReclaimContract of tokenController', async function(){
            const ownable = await Ownable.new({from:owner1});
            await ownable.transferOwnership(this.token.address, { from: owner1})
            let ownableOwner = await ownable.owner.call();
            assert.equal(ownableOwner, this.token.address)

            await this.multisigOwner.requestReclaimContract(ownable.address, { from: owner1 })
            await this.multisigOwner.requestReclaimContract(ownable.address, { from: owner2 })
            ownableOwner = await ownable.owner.call()
            assert.equal(ownableOwner, this.controller.address)
        })

        it('issueClaimOwnership of tokenController', async function(){
            let claimableOwner = await this.claimableContract.owner.call()
            assert.equal(claimableOwner, owner1)
            await this.claimableContract.transferOwnership(this.controller.address, { from: owner1 })
            await this.multisigOwner.issueClaimOwnership(this.claimableContract.address, { from: owner1 })
            await this.multisigOwner.issueClaimOwnership(this.claimableContract.address, { from: owner2 })
            claimableOwner = await this.claimableContract.owner.call()
            assert.equal(claimableOwner, this.controller.address)
        })


        it('call requestReclaimEther of tokenController', async function(){
            const forceEther = await ForceEther.new({ from: oneHundred, value: "10000000000000000000" })
            await forceEther.destroyAndSend(this.token.address)
            const balance1 = Number(web3.utils.fromWei(await web3.eth.getBalance(this.multisigOwner.address), 'ether'))
            await this.multisigOwner.requestReclaimEther({from: owner1})
            await this.multisigOwner.requestReclaimEther({from: owner2})
            const balance2 = Number(web3.utils.fromWei(await web3.eth.getBalance(this.multisigOwner.address), 'ether'))
            assert.isAbove(balance2, balance1)
        })

        it('call requestReclaimToken of tokenController', async function(){
            this.basicToken = await TrueUSDMock.new(this.token.address, 100, {from: owner1});
            await this.basicToken.setRegistry(this.registry.address, {from: owner1});

            await this.multisigOwner.requestReclaimToken(this.basicToken.address, {from: owner1})
            await this.multisigOwner.requestReclaimToken(this.basicToken.address, {from: owner2})
            
            const tokenContractBalance = await this.basicToken.balanceOf.call(this.token.address)
            const multiSigBalance = await this.basicToken.balanceOf.call(this.multisigOwner.address)
            assert.equal(Number(tokenContractBalance), 0)
            assert.equal(Number(multiSigBalance), 100)

            await this.multisigOwner.msReclaimToken(this.basicToken.address, oneHundred, {from : owner1 })
            await this.multisigOwner.msReclaimToken(this.basicToken.address, oneHundred,  {from : owner2 })
            
            const userBalance = await this.basicToken.balanceOf.call(oneHundred)
            assert.equal(Number(userBalance), 100)
        })

    
        it('call setFastPause of tokenController', async function(){
            await this.multisigOwner.setFastPause(oneHundred, {from: owner1})
            await this.multisigOwner.setFastPause(oneHundred, {from: owner2})
            const trueUsdFastPause = await this.controller.fastPause.call()
            assert.equal(trueUsdFastPause, oneHundred)
        })

        it('call wipeBlackListedTrueUSD of tokenController', async function(){
            await this.registry.setAttribute(blackListed, BLACKLISTED, 1, notes, { from: owner1 })
            await this.multisigOwner.wipeBlackListedTrueUSD(blackListed, {from: owner1})
            await this.multisigOwner.wipeBlackListedTrueUSD(blackListed, {from: owner2})
        })

        it('call setBurnBounds of tokenController', async function(){
            await this.multisigOwner.setBurnBounds(BN(3*10**18), BN(4*10**18), {from: owner1})
            await this.multisigOwner.setBurnBounds(BN(3*10**18), BN(4*10**18), {from: owner2})

            const min = await this.token.burnMin.call()
            assert(min.eq(BN(3*10**18)))
            const max = await this.token.burnMax.call()
            assert(max.eq(BN(4*10**18)))

        })
    })

    describe('mint related owner actions', function(){
        beforeEach(async function () {
            await this.controller.setMintThresholds(BN(10*10**18),BN(100*10**18),BN(1000).mul(BN(10**18)), { from: owner1 })
            await this.controller.setMintLimits(BN(30*10**18),BN(300).mul(BN(10**18)),BN(3000).mul(BN(10**18)),{ from: owner1 })
            await this.controller.refillMultiSigMintPool({ from: owner1 })
            await this.controller.refillRatifiedMintPool({ from: owner1 })
            await this.controller.refillInstantMintPool({ from: owner1 })
            await this.controller.transferOwnership(this.multisigOwner.address, { from: owner1 })
            await this.multisigOwner.msIssueClaimContract(this.controller.address, {from : owner1 })
            await this.multisigOwner.msIssueClaimContract(this.controller.address, {from : owner2 })
            await this.multisigOwner.msSetTokenController(this.controller.address, {from : owner1 })
            await this.multisigOwner.msSetTokenController(this.controller.address, {from : owner2 })
            await this.multisigOwner.transferMintKey(mintKey, {from : owner2 })
            await this.multisigOwner.transferMintKey(mintKey, {from : owner3 })

        })

        it('owner can instant mint', async function(){
            await this.multisigOwner.instantMint(oneHundred, BN(10*10**18),  {from: owner1})
            await this.multisigOwner.instantMint(oneHundred, BN(10*10**18), {from: owner2})
            await assertBalance(this.token, oneHundred, BN(110).mul(BN(10**18)))
        })

        it('owner can pause and unpause mint', async function(){
            await this.multisigOwner.requestMint(oneHundred, BN(10*10**18), {from: owner1})
            await this.multisigOwner.requestMint(oneHundred, BN(10*10**18), {from: owner2})
            await this.multisigOwner.pauseMint(0,  {from: owner1})
            await this.multisigOwner.pauseMint(0,  {from: owner2})
            let mintOperation = await this.controller.mintOperations.call(0)
            assert.equal(mintOperation[4],true)
            await this.multisigOwner.unpauseMint(0,  {from: owner1})
            await this.multisigOwner.unpauseMint(0,  {from: owner2})
            mintOperation = await this.controller.mintOperations.call(0)
            assert.equal(mintOperation[4],false)
        })

        it('owner invalidate past request mints', async function(){
            await this.multisigOwner.requestMint(oneHundred, BN(10*10**18), {from: owner1})
            await this.multisigOwner.requestMint(oneHundred, BN(10*10**18), {from: owner2})
            await this.multisigOwner.requestMint(oneHundred, BN(20*10**18), {from: owner1})
            await this.multisigOwner.requestMint(oneHundred, BN(20*10**18), {from: owner2})
            await this.multisigOwner.invalidateAllPendingMints({from: owner1})
            await this.multisigOwner.invalidateAllPendingMints({from: owner2})
            const invalidateBefore = await this.controller.mintReqInvalidBeforeThisBlock.call()
            assert(invalidateBefore.gt(0))
        })

        it('owner request and ratify a large mint', async function(){
            await this.multisigOwner.requestMint(oneHundred, BN(30000).mul(BN(10**18)), {from: owner1})
            await this.multisigOwner.requestMint(oneHundred, BN(30000).mul(BN(10**18)), {from: owner2})
            await this.multisigOwner.ratifyMint(0, oneHundred, BN(30000).mul(BN(10**18)),  {from: owner1})
            await this.multisigOwner.ratifyMint(0, oneHundred, BN(30000).mul(BN(10**18)), {from: owner2})
            await assertBalance(this.token, oneHundred, BN(30100).mul(BN(10**18)))
        })

        it('owners can revoke mint', async function(){
            await this.multisigOwner.requestMint(oneHundred, BN(10*10**18),  {from: owner1})
            await this.multisigOwner.requestMint(oneHundred, BN(10*10**18), {from: owner2})
            await this.multisigOwner.revokeMint(BN(0), {from: owner1})
            await this.multisigOwner.revokeMint(BN(0), {from: owner3})
            const mintOperation = await this.controller.mintOperations.call(BN(0))
            assert.equal(mintOperation[0],0x0000000000000000000000000000000000000000)
            assert(mintOperation[1].eq(BN(0)))
        })
    })
})
