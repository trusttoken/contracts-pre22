import assertRevert from './helpers/assertRevert'
import expectThrow from './helpers/expectThrow'
const Controller = artifacts.require("TokenController")
const CanDelegate = artifacts.require('CanDelegateMock')
const TrueUSD = artifacts.require('TrueUSD')
const TrueUSDMock = artifacts.require('TrueUSDMock')
const UpgradeHelperMock = artifacts.require("UpgradeHelperMock")


contract('Upgrade Helper', function (accounts) {
    const [_, owner, oneHundred, anotherAccount, thirdAddress] = accounts
    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

    describe('upgrade using Upgrade Helper', function(){
        beforeEach(async function () {
            this.original = await CanDelegate.new(oneHundred, 10*10**18, {from:owner})
            this.controller = await Controller.new({from:owner})
            this.token = await TrueUSD.new({from:owner})
            await this.controller.initialize({from: owner})
            await this.token.initialize({from: owner})
            this.helper = await UpgradeHelperMock.new(this.original.address, this.token.address, this.controller.address, {from:owner})
            await this.controller.transferOwnership(this.helper.address, {from: owner})
            await this.token.transferOwnership(this.helper.address, {from: owner})
            await this.original.transferOwnership(this.controller.address, {from: owner})
            await this.controller.issueClaimOwnership(this.original.address, {from: owner})
            await this.controller.setTrueUSD(this.original.address, {from: owner})
            await this.helper.upgrade({from: owner})
        })

        it('Controller points to new trueUSD', async function(){
            const trueUSD = await this.controller.trueUSD()
            assert.equal(trueUSD, this.token.address)
        })

        it('Controller owns new trueUSD', async function(){
            const tusdOwner = await this.token.owner()
            assert.equal(tusdOwner, this.controller.address)
        })

        it('controller has correct owner as pendingowner', async function(){
            const controllerOwner = await this.controller.pendingOwner()
            assert.equal(controllerOwner, owner)
        })

        it('oldTusd owned by controller', async function(){
            const originalOwner = await this.original.owner()
            assert.equal(originalOwner, this.controller.address)
        })

        it('token total supply correct', async function(){
            const totalSupply = Number(await this.token.totalSupply())
            assert.equal(totalSupply, 10*10**18)
        })
        it('token has correct balance and allowance sheet', async function(){
            const balanceSheet = await this.token.balances()
            assert.equal(balanceSheet, await this.original.balances())
            const allowanceSheet = await this.token.allowances()
            assert.equal(allowanceSheet, await this.original.allowances())
        })

        it('original token points to new token', async function(){
            const delegate = await this.original.delegate()
            assert.equal(delegate, this.token.address)
        })
        it('new tusd has correct registry', async function(){
            const registry = await this.token.registry()
            assert.equal(registry, '0x0000000000013949f288172bd7e36837bddc7211')
        })
    })
})
