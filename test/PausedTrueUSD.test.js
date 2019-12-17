import assertRevert from './helpers/assertRevert'
import assertBalance from './helpers/assertBalance'
const Registry = artifacts.require("RegistryMock")
const BalanceSheet = artifacts.require("BalanceSheet")
const AllowanceSheet = artifacts.require("AllowanceSheet")
const TokenController = artifacts.require("TokenControllerMock")
const FastPauseMints = artifacts.require("FastPauseMints")
const Proxy = artifacts.require("OwnedUpgradeabilityProxy")
const PausedTrueUSD = artifacts.require("PausedTrueUSDMock")
const CanDelegate = artifacts.require('CanDelegateMock')
const TrueUSD = artifacts.require("TrueUSDMock")

const bytes32 = require('./helpers/bytes32.js');
const BN = web3.utils.toBN;

contract('PausedTrueUSD', function (accounts) {

    describe('--PausedTrueUSD Tests--', function () {
        const [_, owner, oneHundred, otherAddress, mintKey, pauseKey, pauseKey2, ratifier1, ratifier2, ratifier3, redemptionAdmin] = accounts
        const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
        const notes = bytes32('notes')
        const RATIFIER = bytes32("isTUSDMintRatifier");
        const DOLLAR = BN(10**18)
        const TEN_THOUSAND = DOLLAR.mul(BN(10000));
        const CAN_BURN = bytes32("canBurn")
        const BLACKLISTED = bytes32("isBlacklisted")

        beforeEach(async function () {
            this.registry = await Registry.new({ from: owner })
            this.tokenProxy = await Proxy.new({ from: owner })
            this.tusdImplementation = await TrueUSD.new(owner, 0, { from: owner })
            this.token = await TrueUSD.at(this.tokenProxy.address)
            await this.tokenProxy.upgradeTo(this.tusdImplementation.address,{ from: owner })
            await this.registry.subscribe(CAN_BURN, this.token.address, { from: owner })
            await this.registry.subscribe(BLACKLISTED, this.token.address, { from: owner })
            await this.token.initialize({from: owner})
            await this.token.setTotalSupply(TEN_THOUSAND, {from: owner})
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
            await this.registry.setAttribute(oneHundred, CAN_BURN, 1, notes, { from: owner })
            await this.registry.setAttribute(ratifier1, RATIFIER, 1, notes, { from: owner })
            await this.registry.setAttribute(ratifier2, RATIFIER, 1, notes, { from: owner })
            await this.registry.setAttribute(ratifier3, RATIFIER, 1, notes, { from: owner })
            await this.registry.setAttribute(pauseKey, bytes32("isTUSDMintPausers"), 1, notes, { from: owner })
            await this.registry.setAttribute(this.fastPauseMints.address, bytes32("isTUSDMintPausers"), 1, notes, { from: owner })

            this.pausedTrueUSD = await PausedTrueUSD.new({ from: owner })
            await this.controller.setPausedImplementation(this.pausedTrueUSD.address, {from :owner})

            this.original = await CanDelegate.new(oneHundred, TEN_THOUSAND, {from:owner})
            await this.original.delegateToNewContract(this.token.address, {from:owner})

            await this.controller.setMintThresholds(BN(10000).mul(DOLLAR),BN(30000).mul(DOLLAR),BN(1000000).mul(DOLLAR), { from: owner })
            await this.controller.setMintLimits(BN(10000).mul(DOLLAR),BN(30000).mul(DOLLAR),BN(1000000).mul(DOLLAR),{ from: owner })
            await this.controller.refillMultiSigMintPool({ from: owner })
            await this.controller.refillRatifiedMintPool({ from: owner })
            await this.controller.refillInstantMintPool({ from: owner })
            await this.controller.instantMint(oneHundred, TEN_THOUSAND, { from: owner})
            await this.controller.refillInstantMintPool({ from: owner })
            await this.controller.setMintLimits(0,0,0, { from: owner })
        })

        it('current token is not paused', async function(){
            assert.equal(await this.token.paused(), false);
            await this.token.transfer(otherAddress, BN(10*10**18), { from: oneHundred })
        })

        it ('unpaused token can burn', async function() {
            await this.token.burn(TEN_THOUSAND, { from: oneHundred })
        })

        describe('Paused TrueUSD', function() {
            beforeEach(async function () {
                await this.token.approve(otherAddress, BN(100*10**18), { from: oneHundred })
                await this.controller.pauseToken({from: owner})
                const pausedToken = await PausedTrueUSD.at(this.token.address)
                await pausedToken.setDelegateFrom(this.original.address, {from: owner})
            })

            describe('token transfers are now paused', function(){
                it ('transfer is now paused', async function(){
                    assert.equal(await this.token.paused(), true);
                    await assertRevert(this.token.transfer(otherAddress, BN(10*10**18), { from: oneHundred }))
                    await assertRevert(this.original.transfer(otherAddress, BN(10*10**18), { from: oneHundred }))
                })
    
                it('burn is now paused', async function(){
                    await assertRevert(this.token.burn(TEN_THOUSAND, { from: oneHundred }))
                })    

                it('approve is now paused', async function(){
                    await assertRevert(this.token.approve(otherAddress, BN(100*10**18), { from: oneHundred }))
                    await assertRevert(this.token.increaseAllowance(otherAddress, BN(100*10**18), { from: oneHundred }))
                    await assertRevert(this.token.decreaseAllowance(otherAddress, BN(100*10**18), { from: oneHundred }))
                })    

                it('transferFroms is now paused', async function(){
                    await assertRevert(this.token.transferFrom(oneHundred, owner, BN(100*10**18), { from: otherAddress }))
                })    

                it('mint is now paused', async function(){
                    await this.controller.setMintThresholds(BN(30*10**18),BN(300).mul(BN(10**18)),BN(3000).mul(BN(10**18)), { from: owner })
                    await this.controller.setMintLimits(BN(30*10**18),BN(300).mul(BN(10**18)),BN(3000).mul(BN(10**18)),{ from: owner })
                    await this.controller.refillMultiSigMintPool({ from: owner })
                    await this.controller.refillRatifiedMintPool({ from: owner })
                    await this.controller.refillInstantMintPool({ from: owner })

                    await assertRevert(this.controller.instantMint(oneHundred, BN(100).mul(BN(10**18)), { from: otherAddress }))
                })
            })

            describe('getter functions still functioning', function(){
                it('balanceOf', async function(){
                    const balance = Number(await this.token.balanceOf.call(oneHundred))
                    const balanceOrg = Number(await this.original.balanceOf.call(oneHundred))
                    assert.equal(balance,balanceOrg)
                })
                it('allowance', async function(){
                    const allowance = await this.token.allowance.call(oneHundred,otherAddress)
                    const allowanceOrg = await this.original.allowance.call(oneHundred,otherAddress)
                    assert(allowance.eq(allowanceOrg))
                })

                it('totalSupply', async function(){
                    const totalSupply = await this.token.totalSupply.call()
                    const totalSupplyOrg = await this.original.totalSupply.call()
                    assert(totalSupply.eq(totalSupplyOrg))
                })

                it('registry', async function(){
                    const registry = await this.token.registry.call()
                    assert.equal(registry,this.registry.address)
                })
                it('Rounding', async function(){
                    const decimals = await this.token.decimals.call()
                    assert.equal(decimals,18)
                })
                it('Decimal', async function(){
                    const rounding = await this.token.rounding.call()
                    assert.equal(rounding,2)
                })
                it('Name', async function(){
                    const name = await this.token.name.call()
                    assert.equal(name,"TrueUSD")
                })
                it('Symbol', async function(){
                    const symbol = await this.token.symbol.call()
                    assert.equal(symbol,"TUSD")
                })
            })

            describe('admin functions still functioning', function(){
                it('can sponsor gas pool', async function(){
                    await this.registry.setAttributeValue(oneHundred, bytes32("canSetFutureRefundMinGasPrice"), 1, { from: owner });
                    await this.token.setMinimumGasPriceForFutureRefunds(1, { from: oneHundred })
                    await this.token.sponsorGas({ from: otherAddress })
                    const remainingPool = await this.token.remainingGasRefundPool.call()
                    assert(remainingPool.eq(BN(9)), "Pool should be 9, instead " + remainingPool)
                })
                it ('can set token registry', async function() {
                    await this.controller.setTokenRegistry('0x0000000000000000000000000000000000000003',{from: owner})
                    assert.equal(await this.token.registry.call(), '0x0000000000000000000000000000000000000003')
                })

                it('can still wipe blacklisted account', async function(){
                    await this.registry.setAttribute(oneHundred, BLACKLISTED, 1, notes, { from: owner })
                    await this.controller.wipeBlackListedTrueUSD(oneHundred, {from : owner})
                    await assertBalance(this.token, oneHundred,0)
                })

                it('cannot wipe blacklisted account if not blacklisted', async function(){
                    await assertRevert(this.controller.wipeBlackListedTrueUSD(oneHundred, {from : owner}))
                })
            })
        })

    })
})
