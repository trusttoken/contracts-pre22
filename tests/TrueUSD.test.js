import assertRevert from './helpers/assertRevert'
import expectThrow from './helpers/expectThrow'
import burnableTokenWithBoundsTests from './BurnableTokenWithBounds'
import compliantTokenTests from './CompliantToken';
const Registry = artifacts.require("RegistryMock")
const TrueUSDMock = artifacts.require("TrueUSDMock")
const ForceEther = artifacts.require("ForceEther")

const BN = web3.utils.toBN;
const bytes32 = require('./helpers/bytes32.js')

contract('TrueUSD', function (accounts) {
    const [_, owner, oneHundred, anotherAccount] = accounts
    const notes = bytes32("some notes")
    const HUNDRED = BN(100).mul(BN(10**18))
    const CAN_BURN = bytes32("canBurn")
    const BLACKLISTED = bytes32("isBlacklisted")
    describe('TUSD init', function(){
        beforeEach(async function () {
            this.token = await TrueUSDMock.new(owner, 0, { from: owner })
        })

        it ('owner can set totalsupply', async function(){
            await this.token.setTotalSupply(HUNDRED,{ from: owner })
            const totalSupply = Number(await this.token.totalSupply.call())
            assert.equal(HUNDRED, totalSupply)
        })

        it('totalsupply cannot be set when it is not zero', async function(){
            await this.token.setTotalSupply(HUNDRED,{ from: owner })
            await assertRevert(this.token.setTotalSupply(HUNDRED,{ from: owner }))
        })

        it('only owner can set totalSupply', async function(){
            await assertRevert(this.token.setTotalSupply(HUNDRED,{ from: oneHundred }))
        })
    })

    describe('--TrueUSD Tests: 1 contract--', function () {
        beforeEach(async function () {
            // Set up a TrueUSD contract with 100 tokens for 'oneHundred'.
            this.registry = await Registry.new({ from: owner })
            this.token = await TrueUSDMock.new(owner, 0, { from: owner })
            this.mintableToken = this.token
            await this.token.setRegistry(this.registry.address, { from: owner })
            await this.registry.subscribe(CAN_BURN, this.token.address, { from: owner })
            await this.registry.subscribe(BLACKLISTED, this.token.address, { from: owner })
            await this.token.mint(oneHundred, HUNDRED, { from: owner })
        })

        it('trueUSD does not accept ether', async function(){
            await assertRevert(this.token.sendTransaction({from: oneHundred, gas: 800000, value: 1000}));                  
            const balanceWithEther = web3.utils.fromWei(await web3.eth.getBalance(this.token.address), 'ether')
            assert.equal(balanceWithEther, 0)
        })

        it('only pendingOwner can claim ownership of TUSD', async function(){
            await this.token.transferOwnership(oneHundred, { from: owner })
            await assertRevert(this.token.claimOwnership({ from: anotherAccount }))
        })

        describe('burn', function () {
            describe('user is on burn whitelist', function () {
                beforeEach(async function () {
                    await this.registry.setAttribute(oneHundred, CAN_BURN, 1, notes, { from: owner })
                })

                burnableTokenWithBoundsTests([owner, oneHundred, anotherAccount], false)
            })

            describe('user is not on burn whitelist', function () {
                it("reverts burn", async function () {
                    await this.token.setBurnBounds(BN(10*10**18), BN(20*10**18), { from: owner })
                    await assertRevert(this.token.burn(BN(15*10**18),  { from: oneHundred }))
                })
            })
        })

        describe('round down burn amount', function () {
            it("burns 10.50", async function () {
                await this.registry.setAttribute(oneHundred, CAN_BURN, 1, notes, { from: owner })
                await this.token.setBurnBounds(BN(10*10**18), BN(20*10**18), { from: owner })
                await this.token.burn(BN(10.503*10**18), { from: oneHundred })
                let remainingBalance = await this.token.balanceOf.call(oneHundred)
                assert(remainingBalance.eq(BN(895).mul(BN(10**17))))
            })
        })


        describe('when there are no burn bounds', function () {
            beforeEach(async function () {
                await this.token.setBurnBounds(0, "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", { from: owner })
            })

            compliantTokenTests([owner, oneHundred, anotherAccount], false)
        })

        it("correct name and symbol", async function () {
            let name = await this.token.name.call()
            assert.equal(name, "TrueUSD")
            let symbol = await this.token.symbol.call()
            assert.equal(symbol, "TUSD")
        })
    })
})
