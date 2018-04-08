import assertRevert from './helpers/assertRevert'
import increaseTime, { duration } from './helpers/increaseTime'
const AddressList = artifacts.require("AddressList")
const TrueUSD = artifacts.require("TrueUSD")
const BalanceSheet = artifacts.require("BalanceSheet")
const AllowanceSheet = artifacts.require("AllowanceSheet")
const TimeLockedController = artifacts.require("TimeLockedController")
var Web3 = require('web3')

contract('TimeLockedController', function(accounts) {
    it("should work", async function () {
        const mintWhiteList = await AddressList.new("Mint whitelist")
        const burnWhiteList = await AddressList.new("Burn whitelist")
        const blackList = await AddressList.new("Blacklist")
        const noFeesList = await AddressList.new("No Fees list")
        const balances = await BalanceSheet.new()
        const allowances = await AllowanceSheet.new()
        const trueUSD = await TrueUSD.new()
        await balances.transferOwnership(trueUSD.address)
        await allowances.transferOwnership(trueUSD.address)
        await trueUSD.setBalanceSheet(balances.address)
        await trueUSD.setAllowanceSheet(allowances.address)
        await mintWhiteList.changeList(accounts[3], true, {from: accounts[0]})
        async function userHasCoins(id, amount) {
          var balance = await trueUSD.balanceOf(accounts[id])
          assert.equal(balance, amount, "userHasCoins fail: actual balance "+balance)
        }
        const timeLockedController = await TimeLockedController.new({from: accounts[0]})
        await mintWhiteList.transferOwnership(timeLockedController.address, {from: accounts[0]})
        await burnWhiteList.transferOwnership(timeLockedController.address, {from: accounts[0]})
        await blackList.transferOwnership(timeLockedController.address, {from: accounts[0]})
        await trueUSD.transferOwnership(timeLockedController.address, {from: accounts[0]})
        await timeLockedController.issueClaimOwnership(mintWhiteList.address, {from: accounts[0]})
        await timeLockedController.issueClaimOwnership(burnWhiteList.address, {from: accounts[0]})
        await timeLockedController.issueClaimOwnership(blackList.address, {from: accounts[0]})
        await timeLockedController.issueClaimOwnership(trueUSD.address, {from: accounts[0]})
        await timeLockedController.setTrueUSD(trueUSD.address)
        await timeLockedController.setLists(mintWhiteList.address, burnWhiteList.address, blackList.address, noFeesList.address, {from: accounts[0]})
        await assertRevert(trueUSD.mint(accounts[3], 10, {from: accounts[0]})) //user 0 is no longer the owner
        await timeLockedController.requestMint(accounts[3], 9, {from: accounts[0]})
        await timeLockedController.finalizeMint(0, {from: accounts[0]}) // the owner can finalize immediately
        await userHasCoins(3, 9)
        await assertRevert(timeLockedController.requestMint(accounts[3], 200, {from: accounts[1]})) //user 1 is not (yet) the admin
        await timeLockedController.transferAdminship(accounts[1], {from: accounts[0]})
        await timeLockedController.requestMint(accounts[3], 200, {from: accounts[1]})
        await assertRevert(timeLockedController.finalizeMint(1, {from: accounts[3]})) //mint request cannot be finalized this early
        await increaseTime(duration.hours(12))
        await assertRevert(timeLockedController.finalizeMint(1, {from: accounts[3]})) //still not enough time has passed
        await increaseTime(duration.hours(12))
        await timeLockedController.finalizeMint(1, {from: accounts[1]}) //only target of mint can finalize
        await userHasCoins(3, 209)
        await timeLockedController.requestMint(accounts[3], 3000, {from: accounts[1]})
        await timeLockedController.requestMint(accounts[3], 40000, {from: accounts[1]})
        await increaseTime(duration.days(1))
        await timeLockedController.finalizeMint(3, {from: accounts[1]})
        await assertRevert(timeLockedController.finalizeMint(3, {from: accounts[1]})) //can't double-finalize
        await userHasCoins(3, 40209)
        await timeLockedController.transferAdminship(accounts[2], {from: accounts[0]})
        await assertRevert(timeLockedController.finalizeMint(2, {from: accounts[3]})) //can't finalize because admin has been changed
        await assertRevert(timeLockedController.transferChild(trueUSD.address, accounts[2], {from: accounts[1]})) //only owner
        await timeLockedController.requestMint(accounts[3], 500000, {from: accounts[2]})
        await timeLockedController.transferChild(trueUSD.address, accounts[2], {from: accounts[0]})
        await timeLockedController.transferChild(mintWhiteList.address, accounts[2], {from: accounts[0]})
        await timeLockedController.transferChild(burnWhiteList.address, accounts[2], {from: accounts[0]})
        await timeLockedController.transferChild(blackList.address, accounts[2], {from: accounts[0]})
        await trueUSD.claimOwnership({from: accounts[2]})
        await assertRevert(timeLockedController.finalizeMint(4, {from: accounts[2]})) //timeLockedController is no longer the owner of trueUSD
        await trueUSD.transferOwnership(timeLockedController.address, {from: accounts[2]})
        await timeLockedController.issueClaimOwnership(trueUSD.address, {from: accounts[0]})
        await increaseTime(duration.days(1))
        await timeLockedController.finalizeMint(4, {from: accounts[2]})
        await userHasCoins(3, 540209)
    })
})
