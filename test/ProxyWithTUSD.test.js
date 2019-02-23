import assertRevert from './helpers/assertRevert'
import expectThrow from './helpers/expectThrow'
import burnableTokenWithBoundsTests from './BurnableTokenWithBounds'
import basicTokenTests from './token/BasicToken';
import standardTokenTests from './token/StandardToken';
import burnableTokenTests from './token/BurnableToken';
import compliantTokenTests from './CompliantToken';
const Registry = artifacts.require("RegistryMock")
const TrueUSD = artifacts.require("TrueUSDMock")
const TrueUSDMock = artifacts.require("TrueUSDMock")
const BalanceSheet = artifacts.require("BalanceSheet")
const AllowanceSheet = artifacts.require("AllowanceSheet")
const ForceEther = artifacts.require("ForceEther")
const TusdProxy = artifacts.require("OwnedUpgradeabilityProxy")

const bytes32 = require('./helpers/bytes32.js')
const BN = web3.utils.toBN;

contract('Proxy', function (accounts) {
    const [_, owner, oneHundred, anotherAccount] = accounts
    const notes = bytes32("some notes")

    describe('--Set up proxy--', function () {
        beforeEach(async function () {
            this.registry = await Registry.new({ from: owner })
            this.proxy = await TusdProxy.new({ from: owner })
            this.implementation = await TrueUSD.new(owner, 0, { from: owner })
            this.token = await TrueUSD.at(this.proxy.address)
            this.balanceSheet = await BalanceSheet.new({ from: owner })
            this.allowanceSheet = await AllowanceSheet.new({ from: owner })
            await this.balanceSheet.transferOwnership(this.token.address,{ from: owner })
            await this.allowanceSheet.transferOwnership(this.token.address,{ from: owner })
            await this.proxy.upgradeTo(this.implementation.address,{ from: owner })
            await this.registry.setAttribute(oneHundred, bytes32("hasPassedKYC/AML"), 1, notes, { from: owner })
            await this.registry.setAttribute(oneHundred, bytes32("canBurn"), 1, notes, { from: owner })
        })

        it('initializes proxy/tusd contract', async function(){
            await this.token.initialize({from: owner})
            const tokenOwner = await this.token.owner.call()
            assert.equal(tokenOwner, owner)
            const burnMin = await this.token.burnMin.call()
            assert(BN(10000).mul(BN(10**18)).eq(burnMin))
            const burnMax = await this.token.burnMax.call()
            assert(burnMax.eq(BN(20000000).mul(BN(10**18))))
        })

        it('cannot initialize a second time', async function(){
            await this.token.initialize({from: owner})
            await assertRevert(this.token.initialize({from: owner}))
        })

        describe('---Tusd setup functions---', function(){
            beforeEach(async function () {
                await this.token.initialize({from: owner})
            })

            it ('set storage contract', async function(){
                await this.token.setBalanceSheet(this.balanceSheet.address, { from: owner })
                await this.token.setAllowanceSheet(this.allowanceSheet.address, { from: owner })   
            })

            it ('set registry', async function(){
                await this.token.setRegistry(this.registry.address, { from: owner }) 
            })
        })
        describe('---Tusd token functions---', function(){
            beforeEach(async function () {
                await this.token.initialize({from: owner})
                await this.token.setBalanceSheet(this.balanceSheet.address, { from: owner })
                await this.token.setAllowanceSheet(this.allowanceSheet.address, { from: owner })   
                await this.token.setRegistry(this.registry.address, { from: owner }) 
                await this.token.mint(oneHundred, BN(100).mul(BN(10**18)), {from: owner})
            })
            it('proxy return totalSupply', async function(){
                await this.token.totalSupply.call()
            })    

            it('can transfer token', async function(){
                await this.token.transfer(anotherAccount,BN(10*10**18), {from: oneHundred})
            }) 

            basicTokenTests([owner, oneHundred, anotherAccount])
            standardTokenTests([owner, oneHundred, anotherAccount])

        })
    })
})
