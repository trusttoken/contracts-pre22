import assertRevert from './helpers/assertRevert'
import expectThrow from './helpers/expectThrow'
import burnableTokenWithBoundsTests from './BurnableTokenWithBounds'
import basicTokenTests from './token/BasicToken';
import standardTokenTests from './token/StandardToken';
import burnableTokenTests from './token/BurnableToken';
import compliantTokenTests from './CompliantToken';
import tokenWithFeesTests from './TokenWithFees';
const Registry = artifacts.require("Registry")
const TrueUSD = artifacts.require("TrueUSD")
const TrueUSDMock = artifacts.require("TrueUSDMock")
const BalanceSheet = artifacts.require("BalanceSheet")
const AllowanceSheet = artifacts.require("AllowanceSheet")
const ForceEther = artifacts.require("ForceEther")
const GlobalPause = artifacts.require("GlobalPause")

contract('TrueUSD', function (accounts) {
    const [_, owner, oneHundred, anotherAccount] = accounts
    const notes = "some notes"

    describe('--TrueUSD Tests: 1 contract--', function () {
        beforeEach(async function () {
            // Set up a TrueUSD contract with 100 tokens for 'oneHundred'.
            this.registry = await Registry.new({ from: owner })
            this.balances = await BalanceSheet.new({ from: owner })
            this.allowances = await AllowanceSheet.new({ from: owner })
            this.token = await TrueUSD.new({ from: owner })
            await this.token.initialize(0, { from: owner })
            this.globalPause = await GlobalPause.new({ from: owner })
            await this.token.setGlobalPause(this.globalPause.address, { from: owner })    
            await this.token.setRegistry(this.registry.address, { from: owner })
            await this.balances.transferOwnership(this.token.address, { from: owner })
            await this.allowances.transferOwnership(this.token.address, { from: owner })
            await this.token.setBalanceSheet(this.balances.address, { from: owner })
            await this.token.setAllowanceSheet(this.allowances.address, { from: owner })
            await this.registry.setAttribute(oneHundred, "hasPassedKYC/AML", 1, notes, { from: owner })
            await this.token.mint(oneHundred, 100*10**18, { from: owner })
            await this.registry.setAttribute(oneHundred, "hasPassedKYC/AML", 0, notes, { from: owner })
        })

        it('trueUSD does not accept ether', async function(){
            await assertRevert(this.token.sendTransaction({from: oneHundred, gas: 600000, value: 1000}));                  
            const balanceWithEther = web3.fromWei(web3.eth.getBalance(this.token.address), 'ether').toNumber()
            assert.equal(balanceWithEther, 0)
        })

        it('only pendingOwner can claim ownership of TUSD', async function(){
            await this.token.transferOwnership(oneHundred, { from: owner })
            await assertRevert(this.token.claimOwnership({ from: anotherAccount }))
        })

        describe('burn', function () {
            describe('user is on burn whitelist', function () {
                beforeEach(async function () {
                    await this.registry.setAttribute(oneHundred, "canBurn", 1, notes, { from: owner })
                })

                burnableTokenWithBoundsTests([owner, oneHundred, anotherAccount], true)
            })

            describe('user is not on burn whitelist', function () {
                it("reverts burn", async function () {
                    await this.token.setBurnBounds(10*10**18, 20*10**18, { from: owner })
                    await assertRevert(this.token.burn(15*10**18,  { from: oneHundred }))
                })
            })
        })

        describe('round down burn amount', function () {
            it("burns 10.50", async function () {
                await this.registry.setAttribute(oneHundred, "canBurn", 1, notes, { from: owner })
                await this.token.setBurnBounds(10*10**18, 20*10**18, { from: owner })
                await this.token.burn(10.503*10**18, { from: oneHundred })
                let remainingBalance = await this.token.balanceOf(oneHundred)
                assert.equal(remainingBalance, 89.5*10**18)
            })
        })


        describe('when there are no burn bounds', function () {
            beforeEach(async function () {
                await this.token.setBurnBounds(0, "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", { from: owner })
            })

            compliantTokenTests([owner, oneHundred, anotherAccount], true)
        })

        describe('when everyone is on the whitelists and there are no burn bounds', function () {
            beforeEach(async function () {
                await this.token.setBurnBounds(0, "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", { from: owner })
                await this.registry.setAttribute(owner, "hasPassedKYC/AML", 1, notes, { from: owner })
                await this.registry.setAttribute(oneHundred, "hasPassedKYC/AML", 1, notes, { from: owner })
                await this.registry.setAttribute(anotherAccount, "hasPassedKYC/AML", 1, notes, { from: owner })
                await this.registry.setAttribute(owner, "canBurn", 1, notes, { from: owner })
                await this.registry.setAttribute(oneHundred, "canBurn", 1, notes, { from: owner })
                await this.registry.setAttribute(anotherAccount, "canBurn", 1, notes, { from: owner })
            })

            tokenWithFeesTests([owner, oneHundred, anotherAccount], true)
        })

        it("old long interaction trace test", async function () {
            await assertRevert(this.token.mint(accounts[3], 10, { from: owner })) //user 3 is not (yet) on whitelist
            await assertRevert(this.registry.setAttribute(accounts[3], "hasPassedKYC/AML", 1, notes, { from: anotherAccount })) //anotherAccount is not the owner
            await this.registry.setAttribute(accounts[3], "hasPassedKYC/AML", 1, notes, { from: owner })
            const userHasCoins = async (id, amount) => {
                var balance = await this.token.balanceOf(accounts[id])
                assert.equal(balance, amount, "userHasCoins fail: actual balance " + balance)
            }
            await this.token.changeStakingFees(7, 10000, 0, 10000, 0, 0, 10000, 0, { from: owner })
            await userHasCoins(3, 0)
            await this.token.mint(accounts[3], 12345, { from: owner })
            await userHasCoins(3, 12345)
            await userHasCoins(1, 0)
            await this.token.transfer(accounts[4], 11000, { from: accounts[3] })
            await userHasCoins(3, 1345)
            await userHasCoins(4, 11000 - 7)
            await this.token.pause({ from: owner })
            await assertRevert(this.token.transfer(accounts[5], 9999, { from: accounts[4] }))
            await this.token.unpause({ from: owner })
        })

        it("can change name", async function () {
            let name = await this.token.name()
            assert.equal(name, "TrueUSD")
            let symbol = await this.token.symbol()
            assert.equal(symbol, "TUSD")
            await this.token.changeTokenName("FooCoin", "FCN", { from: owner })
            name = await this.token.name()
            assert.equal(name, "FooCoin")
            symbol = await this.token.symbol()
            assert.equal(symbol, "FCN")
        })
    })
})
