import assertRevert from './helpers/assertRevert'
import burnableTokenWithBoundsTests from './BurnableTokenWithBounds'
const AddressList = artifacts.require("AddressList")
const TrueUSD = artifacts.require("TrueUSD")
const BalanceSheet = artifacts.require("BalanceSheet")
const AllowanceSheet = artifacts.require("AllowanceSheet")
var Web3 = require('web3')

contract('TrueUSD-old-test', function(accounts) {
    it("should work", async () => {
        const mintWhiteList = await AddressList.new("Mint whitelist")
        const burnWhiteList = await AddressList.new("Burn whitelist")
        const blackList = await AddressList.new("Blacklist")
        const noFeesList = await AddressList.new("No Fees list")
        const balances = await BalanceSheet.new()
        const allowances = await AllowanceSheet.new()
        const trueUSD = await TrueUSD.new()
        await trueUSD.setLists(mintWhiteList.address, burnWhiteList.address, blackList.address, {from: accounts[0]})
        await trueUSD.setNoFeesList(noFeesList.address, {from: accounts[0]})
        await balances.transferOwnership(trueUSD.address)
        await allowances.transferOwnership(trueUSD.address)
        await trueUSD.setBalanceSheet(balances.address)
        await trueUSD.setAllowanceSheet(allowances.address)
        await assertRevert(trueUSD.mint(accounts[3], 10, {from: accounts[0]})) //user 3 is not (yet) on whitelist
        await assertRevert(mintWhiteList.changeList(accounts[3], true, {from: accounts[1]})) //user 1 is not the owner
        await mintWhiteList.changeList(accounts[3], true, {from: accounts[0]})
        async function userHasCoins(id, amount) {
          var balance = await trueUSD.balanceOf(accounts[id])
          assert.equal(balance, amount, "userHasCoins fail: actual balance "+balance)
        }
        await userHasCoins(3, 0)
        await trueUSD.mint(accounts[3], 12345, {from: accounts[0]})
        await userHasCoins(3, 12345)
        await userHasCoins(0, 0)
        await trueUSD.transfer(accounts[4], 11000, {from: accounts[3]})
        await userHasCoins(3, 1345)
        await userHasCoins(4, 11000-7)
        await trueUSD.pause()
        await assertRevert(trueUSD.transfer(accounts[5], 9999, {from: accounts[4]}))
        await trueUSD.unpause()
        await assertRevert(trueUSD.delegateTransferAllArgs(accounts[4], accounts[5], 9999, {from: accounts[6]}))
        await trueUSD.setDelegatedFrom(accounts[6], {from: accounts[0]})
        await trueUSD.delegateTransferAllArgs(accounts[4], accounts[5], 9999, {from: accounts[6]})
        await userHasCoins(4, 11000-7-9999)
        await userHasCoins(5, 9999-6)
        await userHasCoins(0, 7+6)
    })
    it("can change name", async () => {
        const trueUSD = await TrueUSD.new()
        let name = await trueUSD.name()
        assert.equal(name, "TrueUSD")
        let symbol = await trueUSD.symbol()
        assert.equal(symbol, "TUSD")
        await trueUSD.changeTokenName("FooCoin", "FCN")
        name = await trueUSD.name()
        assert.equal(name, "FooCoin")
        symbol = await trueUSD.symbol()
        assert.equal(symbol, "FCN")
    })
})

contract('TrueUSD', function ([_, owner, recipient, anotherAccount]) {
    beforeEach(async function () {
        // Set up a TrueUSD contract with 100 tokens for 'recipient'.
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

        await this.mintWhiteList.changeList(recipient, true, { from: owner })
        await this.token.mint(recipient, 100, { from: owner })
        await this.mintWhiteList.changeList(recipient, false, { from: owner })
    })

    describe('burn', function () {
        describe('user is on burn whitelist', function () {
            beforeEach(async function () {
                await this.burnWhiteList.changeList(recipient, true, { from: owner })
            })

            burnableTokenWithBoundsTests([_, owner, recipient])
        })

        describe('user is not on burn whitelist', function () {
            it("reverts burn", async function () {
                await assertRevert(this.token.burn(21, { from: recipient }))
            })
        })
    })
})
