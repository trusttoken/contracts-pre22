import assertRevert from './helpers/assertRevert'
import burnableTokenWithBoundsTests from './BurnableTokenWithBounds'
import basicTokenTests from './token/BasicToken';
const AddressList = artifacts.require("AddressList")
const TrueUSD = artifacts.require("TrueUSD")
const BalanceSheet = artifacts.require("BalanceSheet")
const AllowanceSheet = artifacts.require("AllowanceSheet")

contract('TrueUSD', function (accounts) {
    const [_, owner, oneHundred, anotherAccount] = accounts

    beforeEach(async function () {
        // Set up a TrueUSD contract with 100 tokens for 'oneHundred'.
        // We do not follow the Mock pattern here because one contract that
        // did all of this in its constructor would use more than a block's
        // maximum gas.
        this.mintWhiteList = await AddressList.new("Mint whitelist", { from: owner })
        this.burnWhiteList = await AddressList.new("Burn whitelist", { from: owner })
        this.blackList = await AddressList.new("Blacklist", { from: owner })
        this.noFeesList = await AddressList.new("No Fees list", { from: owner })
        this.balances = await BalanceSheet.new({ from: owner })
        this.allowances = await AllowanceSheet.new({ from: owner })
        this.token = await TrueUSD.new({ from: owner })
        await this.token.setLists(this.mintWhiteList.address, this.burnWhiteList.address, this.blackList.address, { from: owner })
        await this.token.setNoFeesList(this.noFeesList.address, { from: owner })
        await this.balances.transferOwnership(this.token.address, { from: owner })
        await this.allowances.transferOwnership(this.token.address, { from: owner })
        await this.token.setBalanceSheet(this.balances.address, { from: owner })
        await this.token.setAllowanceSheet(this.allowances.address, { from: owner })

        await this.mintWhiteList.changeList(oneHundred, true, { from: owner })
        await this.token.mint(oneHundred, 100, { from: owner })
        await this.mintWhiteList.changeList(oneHundred, false, { from: owner })
    })

    describe('burn', function () {
        describe('user is on burn whitelist', function () {
            beforeEach(async function () {
                await this.burnWhiteList.changeList(oneHundred, true, { from: owner })
            })

            burnableTokenWithBoundsTests([owner, oneHundred, anotherAccount])
        })

        describe('user is not on burn whitelist', function () {
            it("reverts burn", async function () {
                await assertRevert(this.token.burn(21, { from: oneHundred }))
            })
        })
    })

    it("old long interaction trace test", async function () {
        await assertRevert(this.token.mint(accounts[3], 10, { from: owner })) //user 3 is not (yet) on whitelist
        await assertRevert(this.mintWhiteList.changeList(accounts[3], true, { from: anotherAccount })) //user 1 is not the owner
        await this.mintWhiteList.changeList(accounts[3], true, { from: owner })
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
        await assertRevert(this.token.delegateTransfer(accounts[5], 9999, accounts[4], { from: accounts[6] }))
        await this.token.setDelegatedFrom(accounts[6], { from: owner })
        await this.token.delegateTransfer(accounts[5], 9999, accounts[4], { from: accounts[6] })
        await userHasCoins(4, 11000 - 7 - 9999)
        await userHasCoins(5, 9999 - 6)
        await userHasCoins(1, 7 + 6)
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
