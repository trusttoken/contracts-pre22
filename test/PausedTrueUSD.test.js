import assertRevert from './helpers/assertRevert'
import assertBalance from './helpers/assertBalance'
const Registry = artifacts.require("Registry")
const BalanceSheet = artifacts.require("BalanceSheet")
const AllowanceSheet = artifacts.require("AllowanceSheet")
const TokenController = artifacts.require("TokenControllerMock")
const FastPauseMints = artifacts.require("FastPauseMints")
const Proxy = artifacts.require("OwnedUpgradeabilityProxy")
const PausedTrueUSD = artifacts.require("PausedTrueUSDMock")
const CanDelegate = artifacts.require('CanDelegateMock')
const TrueUSD = artifacts.require("TrueUSDMock")

contract('TokenController', function (accounts) {

    describe('--TokenController Tests--', function () {
        const [_, owner, oneHundred, otherAddress, mintKey, pauseKey, pauseKey2, ratifier1, ratifier2, ratifier3, redemptionAdmin] = accounts
        const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

        beforeEach(async function () {
            this.registry = await Registry.new({ from: owner })
            this.tokenProxy = await Proxy.new({ from: owner })
            this.tusdImplementation = await TrueUSD.new(owner, 0, { from: owner })
            this.token = await TrueUSD.at(this.tokenProxy.address)
            this.balanceSheet = await BalanceSheet.new({ from: owner })
            await this.balanceSheet.setBalance(oneHundred, 10000*10**18, {from:owner});
            this.allowanceSheet = await AllowanceSheet.new({ from: owner })
            await this.balanceSheet.transferOwnership(this.token.address,{ from: owner })
            await this.allowanceSheet.transferOwnership(this.token.address,{ from: owner })
            await this.tokenProxy.upgradeTo(this.tusdImplementation.address,{ from: owner })
            await this.registry.setAttribute(oneHundred, "hasPassedKYC/AML", 1, "notes", { from: owner })
            await this.registry.setAttribute(oneHundred, "canBurn", 1, "notes", { from: owner })
            await this.token.initialize({from: owner})
            await this.token.setTotalSupply(10000*10**18, {from: owner})
            await this.token.setBalanceSheet(this.balanceSheet.address, { from: owner })
            await this.token.setAllowanceSheet(this.allowanceSheet.address, { from: owner })   
            this.controller = await TokenController.new({ from: owner })
            await this.token.transferOwnership(this.controller.address, {from: owner})
            await this.controller.initialize({ from: owner })
            await this.controller.issueClaimOwnership(this.token.address, {from: owner})
            this.fastPauseMints = await FastPauseMints.new(pauseKey2, this.controller.address, { from: owner })
            await this.controller.setRegistry(this.registry.address, { from: owner })
            await this.controller.setTrueUSD(this.token.address, { from: owner })
            await this.controller.setTusdRegistry(this.registry.address, { from: owner })
            await this.controller.transferMintKey(mintKey, { from: owner })
            await this.tokenProxy.transferProxyOwnership(this.controller.address, {from: owner})
            await this.controller.claimTusdProxyOwnership({from: owner})
            await this.registry.setAttribute(oneHundred, "hasPassedKYC/AML", 1, web3.fromUtf8("notes"), { from: owner })
            await this.registry.setAttribute(otherAddress, "hasPassedKYC/AML", 1, web3.fromUtf8("notes"), { from: owner })
            await this.registry.setAttribute(oneHundred, "canBurn", 1, web3.fromUtf8("notes"), { from: owner })
            await this.registry.setAttribute(ratifier1, "isTUSDMintRatifier", 1, web3.fromUtf8("notes"), { from: owner })
            await this.registry.setAttribute(ratifier2, "isTUSDMintRatifier", 1, web3.fromUtf8("notes"), { from: owner })
            await this.registry.setAttribute(ratifier3, "isTUSDMintRatifier", 1, web3.fromUtf8("notes"), { from: owner })
            await this.registry.setAttribute(pauseKey, "isTUSDMintPausers", 1, web3.fromUtf8("notes"), { from: owner })
            await this.registry.setAttribute(this.fastPauseMints.address, "isTUSDMintPausers", 1, web3.fromUtf8("notes"), { from: owner })

            this.pausedTrueUSD = await PausedTrueUSD.new({ from: owner })
            await this.controller.setPausedImplementation(this.pausedTrueUSD.address, {from :owner})

            this.original = await CanDelegate.new(oneHundred, 10000*10**18, {from:owner})
            await this.original.delegateToNewContract(this.token.address, {from:owner})
        })

        it('current token is not paused', async function(){
            console.log(await this.token.balanceOf(oneHundred))
            await this.token.transfer(otherAddress, 10*10**18, { from: oneHundred })
        })

        it('current token is not paused', async function(){
            await this.token.burn(10000*10**18, { from: oneHundred })
        })

        describe('Paused TrueUSD', function() {
            beforeEach(async function () {
                await this.token.approve(anotherAccount, 100*10**18, { from: oneHundred })
                await this.pausedTrueUSD.setDelegateFrom(this.original.address, {from: owner})
                await this.controller.pauseTrueUSD({from: owner})
            })

            describe('token transfers are now paused', function(){
                it ('transfer is now paused', async function(){
                    await assertRevert(this.token.transfer(otherAddress, 10*10**18, { from: oneHundred }))
                    await assertRevert(this.original.transfer(otherAddress, 10*10**18, { from: oneHundred }))
                })
    
                it('burn is now paused', async function(){
                    await assertRevert(this.token.burn(10000*10**18, { from: oneHundred }))
                })    

                it('approve is now paused', async function(){
                    await assertRevert(this.token.approve(anotherAccount, 100*10**18, { from: oneHundred }))
                    await assertRevert(this.token.increaseApproval(anotherAccount, 100*10**18, { from: oneHundred }))
                    await assertRevert(this.token.decreaseApproval(anotherAccount, 100*10**18, { from: oneHundred }))
                })    
            })

            describe('getter functions still functioning', function(){
                it('balanceOf', async function(){
                    const balance = await this.token.balanceOf(oneHundred)
                    console.log(balance)
                })
                it('allowance', async function(){
                    const allowance = await this.token.allowance(oneHundred,balance)
                    console.log(allowance)
                })
            })

            describe('admin functions still functioning', function(){
                it('test admin functions', async function(){
                    await this.token.sponsorGas({from: otherAddress})
                    await this.controller.setTusdRegistry('0x0000000000000000000000000000000000000003',{from: owner})
                    assert.equal(await this.token.registry(), '0x0000000000000000000000000000000000000003')
                    await this.controller.incrementRedemptionAddressCount({from: owner})
                    assert.equal(await this.token.redemptionAddressCount(), 1)
                })

                it('can still wipe blacklisted account', async function(){
                    await this.registry.setAttribute(oneHundred, "isBlacklisted", 1, web3.fromUtf8("notes"), { from: owner })
                    await this.controller.wipeBlackListedTrueUSD(oneHundred, {from : owner})
                    await assertBalance(this.token, oneHundred,0)
                })

                it('can still set storage contracts', async function(){
                    this.newBalanceSheet = await BalanceSheet.new({ from: owner })
                    this.newAllowanceSheet = await AllowanceSheet.new({ from: owner })
                    await this.newBalanceSheet.transferOwnership(this.token.address,{ from: owner })
                    await this.newAllowanceSheet.transferOwnership(this.token.address,{ from: owner })
                    await this.controller.claimStorageForProxy(this.token.address, 
                                                       this.newBalanceSheet.address,
                                                       this.newAllowanceSheet.address, 
                                                       { from: owner })
                })
                
            })
        })

    })
})
