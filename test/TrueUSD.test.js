import assertRevert from './helpers/assertRevert'
import burnableTokenWithBoundsTests from './BurnableTokenWithBounds'
import basicTokenTests from './token/BasicToken';
import standardTokenTests from './token/StandardToken';
import burnableTokenTests from './token/BurnableToken';
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

contract('TrueUSD: chaining 2 contracts', function (accounts) {
    const _ = accounts[0]
    const owners = [accounts[1], accounts[2]]
    const oneHundreds = [accounts[4], accounts[5]]
    const anotherAccounts = [accounts[7], accounts[8]]

    beforeEach(async function () {
        this.mintWhiteLists = []
        this.burnWhiteLists = []
        this.blackLists = []
        this.noFeesLists = []
        this.balancess = []
        this.allowancess = []
        this.tokens = []

        for (let i = 0; i < 2; i++) {
            this.mintWhiteLists[i] = await AddressList.new("Mint whitelist", { from: owners[i] })
            this.burnWhiteLists[i] = await AddressList.new("Burn whitelist", { from: owners[i] })
            this.blackLists[i] = await AddressList.new("Blacklist", { from: owners[i] })
            this.noFeesLists[i] = await AddressList.new("No Fees list", { from: owners[i] })

            this.balancess[i] = await BalanceSheet.new({ from: owners[i] })
            this.allowancess[i] = await AllowanceSheet.new({ from: owners[i] })
            this.tokens[i] = await TrueUSD.new({ from: owners[i] })
            await this.tokens[i].setLists(this.mintWhiteLists[i].address, this.burnWhiteLists[i].address, this.blackLists[i].address, { from: owners[i] })
            await this.tokens[i].setNoFeesList(this.noFeesLists[i].address, { from: owners[i] })
            await this.balancess[i].transferOwnership(this.tokens[i].address, { from: owners[i] })
            await this.allowancess[i].transferOwnership(this.tokens[i].address, { from: owners[i] })
            await this.tokens[i].setBalanceSheet(this.balancess[i].address, { from: owners[i] })
            await this.tokens[i].setAllowanceSheet(this.allowancess[i].address, { from: owners[i] })

            await this.mintWhiteLists[i].changeList(oneHundreds[i], true, { from: owners[i] })
            await this.tokens[i].mint(oneHundreds[i], 100, { from: owners[i] })
            await this.mintWhiteLists[i].changeList(oneHundreds[i], false, { from: owners[i] })
        }
    })

    describe('chaining two contracts', function () {
        beforeEach(async function () {
            await this.tokens[0].delegateToNewContract(this.tokens[1].address, { from: owners[0] })
            await this.tokens[1].setDelegatedFrom(this.tokens[0].address, { from: owners[1] })
        })

        describe('delegation disables', function () {
            beforeEach(async function () {
                this.token = this.tokens[0]
            })

            it("setNoFeesList", async function () {
                await assertRevert(this.token.setNoFeesList(this.noFeesLists[1].address, { from: owners[0] }))
            })

            it("mint", async function () {
                await this.mintWhiteLists[0].changeList(anotherAccounts[0], true, { from: owners[0] })
                await assertRevert(this.token.mint(anotherAccounts[0], 100, { from: owners[0] }))
            })

            it("setBalanceSheet", async function () {
                const sheet = await BalanceSheet.new({ from: owners[0] })
                await sheet.transferOwnership(this.token.address, { from: owners[0] })
                await assertRevert(this.token.setBalanceSheet(sheet.address, { from: owners[0] }))
            })

            it("setAllowanceSheet", async function () {
                const sheet = await AllowanceSheet.new({ from: owners[0] })
                await sheet.transferOwnership(this.token.address, { from: owners[0] })
                await assertRevert(this.token.setBalanceSheet(sheet.address, { from: owners[0] }))
            })

            it("setBurnBounds", async function () {
                await assertRevert(this.token.setBurnBounds(0, 1, { from: owners[0] }))
            })

            it("setLists", async function () {
                await assertRevert(this.token.setLists(this.mintWhiteLists[1].address, this.burnWhiteLists[1].address, this.blackLists[1].address, { from: owners[0] }))
            })

            it("changeStaker", async function () {
                await assertRevert(this.token.changeStaker(anotherAccounts[0], { from: owners[0] }))
            })

            it("wipeBlacklistedAccount", async function () {
                await this.blackLists[0].changeList(anotherAccounts[0], true, { from: owners[0] })
                await assertRevert(this.token.wipeBlacklistedAccount(anotherAccounts[0], { from: owners[0] }))
            })

            it("changeStakingFees", async function () {
                await assertRevert(this.token.changeStakingFees(1, 2, 3, 4, 5, 6, 7, 8, { from: owners[0] }))
            })
        })
    })
})


contract('TrueUSD: chaining 3 contracts', function (accounts) {
    const _ = accounts[0]
    const owners = [accounts[1], accounts[2], accounts[3]]
    const oneHundreds = [accounts[4], accounts[5], accounts[6]]
    const anotherAccounts = [accounts[7], accounts[8], accounts[9]]

    beforeEach(async function () {
        this.mintWhiteLists = []
        this.burnWhiteLists = []
        this.blackLists = []
        this.noFeesLists = []
        this.balancess = []
        this.allowancess = []
        this.tokens = []

        for (let i = 0; i < 3; i++) {
            this.mintWhiteLists[i] = await AddressList.new("Mint whitelist", { from: owners[i] })
            this.burnWhiteLists[i] = await AddressList.new("Burn whitelist", { from: owners[i] })
            this.blackLists[i] = await AddressList.new("Blacklist", { from: owners[i] })
            this.noFeesLists[i] = await AddressList.new("No Fees list", { from: owners[i] })

            this.balancess[i] = await BalanceSheet.new({ from: owners[i] })
            this.allowancess[i] = await AllowanceSheet.new({ from: owners[i] })
            this.tokens[i] = await TrueUSD.new({ from: owners[i] })
            await this.tokens[i].setLists(this.mintWhiteLists[i].address, this.burnWhiteLists[i].address, this.blackLists[i].address, { from: owners[i] })
            await this.tokens[i].setNoFeesList(this.noFeesLists[i].address, { from: owners[i] })
            await this.balancess[i].transferOwnership(this.tokens[i].address, { from: owners[i] })
            await this.allowancess[i].transferOwnership(this.tokens[i].address, { from: owners[i] })
            await this.tokens[i].setBalanceSheet(this.balancess[i].address, { from: owners[i] })
            await this.tokens[i].setAllowanceSheet(this.allowancess[i].address, { from: owners[i] })

            await this.mintWhiteLists[i].changeList(oneHundreds[i], true, { from: owners[i] })
            await this.tokens[i].mint(oneHundreds[i], 100, { from: owners[i] })
            await this.mintWhiteLists[i].changeList(oneHundreds[i], false, { from: owners[i] })
        }
    })

    describe('chaining three contracts', function () {
        beforeEach(async function () {
            await this.tokens[0].delegateToNewContract(this.tokens[1].address, { from: owners[0] })
            await this.tokens[1].setDelegatedFrom(this.tokens[0].address, { from: owners[1] })
            await this.tokens[1].delegateToNewContract(this.tokens[2].address, { from: owners[1] })
            await this.tokens[2].setDelegatedFrom(this.tokens[1].address, { from: owners[2] })
        })

        for (var i = 0; i < 2; i++) {
            describe('contract ' + i + ' behaves', function () {
                beforeEach(async function () {
                    this.token = this.tokens[i]
                })

                basicTokenTests([owners[2], oneHundreds[2], anotherAccounts[2]])
                standardTokenTests([owners[2], oneHundreds[2], anotherAccounts[2]])

                describe('burn', function () {
                    beforeEach(async function () {
                        await this.burnWhiteLists[2].changeList(oneHundreds[2], true, { from: owners[2] })
                        await this.tokens[2].setBurnBounds(0, "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", { from: owners[2] })
                    })

                    burnableTokenTests([owners[2], oneHundreds[2], anotherAccounts[2]])
                })
            })
        }
    })
})
