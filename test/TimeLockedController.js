const AddressList = artifacts.require("AddressList");
const TrueUSD = artifacts.require("TrueUSD");
const TimeLockedController = artifacts.require("TimeLockedController");
var Web3 = require('web3');

//simplified from https://github.com/OpenZeppelin/zeppelin-solidity/blob/master/test/helpers/expectThrow.js
expectThrow = async promise => {
  try {
    await promise;
  } catch (error) {
    return;
  }
  assert.fail('Expected throw not received');
};

contract('TimeLockedController', function(accounts) {
    it("should work", async () => {
        const mintWhiteList = await AddressList.new("Mint whitelist", {gas: 3000000, from: accounts[0]})
        const burnWhiteList = await AddressList.new("Burn whitelist", {gas: 3000000, from: accounts[0]})
        const blackList = await AddressList.new("Blacklist", {gas: 3000000, from: accounts[0]})
        const trueUSD = await TrueUSD.new(mintWhiteList.address, burnWhiteList.address, blackList.address, {gas: 4000000, from: accounts[0]})
        await mintWhiteList.changeList(accounts[3], true, {gas: 3000000, from: accounts[0]})
        async function userHasCoins(id, amount) {
          var balance = await trueUSD.balanceOf(accounts[id])
          assert.equal(balance, amount, "userHasCoins fail: actual balance "+balance)
        }
        const timeLockedController = await TimeLockedController.new(trueUSD.address, burnWhiteList.address, mintWhiteList.address, blackList.address, {gas: 5000000, from: accounts[0]})
        await mintWhiteList.transferOwnership(timeLockedController.address, {gas: 3000000, from: accounts[0]})
        await burnWhiteList.transferOwnership(timeLockedController.address, {gas: 3000000, from: accounts[0]})
        await blackList.transferOwnership(timeLockedController.address, {gas: 3000000, from: accounts[0]})
        await trueUSD.transferOwnership(timeLockedController.address, {gas: 3000000, from: accounts[0]})
        await trueUSD.mint(accounts[3], 10, {gas: 3000000, from: accounts[0]}) //user 0 is still the owner until claimOwnership
        await userHasCoins(3, 10)
        await timeLockedController.issueClaimOwnership(mintWhiteList.address, {gas: 3000000, from: accounts[0]})
        await timeLockedController.issueClaimOwnership(burnWhiteList.address, {gas: 3000000, from: accounts[0]})
        await timeLockedController.issueClaimOwnership(blackList.address, {gas: 3000000, from: accounts[0]})
        await timeLockedController.issueClaimOwnership(trueUSD.address, {gas: 3000000, from: accounts[0]})
        await expectThrow(trueUSD.mint(accounts[3], 10, {gas: 3000000, from: accounts[0]})) //user 0 is no longer the owner
        await timeLockedController.requestMint(accounts[3], 9, {gas: 3000000, from: accounts[0]})
        await timeLockedController.finalizeMint(0, {gas: 3000000, from: accounts[0]}) // the owner can finalize immediately
        await userHasCoins(3, 19)
        await expectThrow(timeLockedController.requestMint(accounts[3], 200, {gas: 3000000, from: accounts[1]})) //user 1 is not (yet) the admin
        await timeLockedController.transferAdminship(accounts[1], {gas: 3000000, from: accounts[0]})
        await timeLockedController.requestMint(accounts[3], 200, {gas: 3000000, from: accounts[1]})
        await expectThrow(timeLockedController.finalizeMint(1, {gas: 3000000, from: accounts[3]})) //mint request cannot be finalized this early
        var blocksDelay = 20 //NOTE: this should be a day's worth of blocks (24*60*60/15), but testing that takes too long, so instead change that value to 20 in the contract for testing
        for (var i = 0; i < blocksDelay/2; i++) {
          web3.currentProvider.send({jsonrpc: "2.0", method: "evm_mine", params: [], id: 0})
        }
        await expectThrow(timeLockedController.finalizeMint(1, {gas: 3000000, from: accounts[3]})) //still not enough time has passed
        for (var i = 0; i < blocksDelay/2; i++) {
          web3.currentProvider.send({jsonrpc: "2.0", method: "evm_mine", params: [], id: 0})
        }
        await timeLockedController.finalizeMint(1, {gas: 3000000, from: accounts[1]}) //only target of mint can finalize
        await userHasCoins(3, 219)
        await timeLockedController.requestMint(accounts[3], 3000, {gas: 3000000, from: accounts[1]})
        await timeLockedController.requestMint(accounts[3], 40000, {gas: 3000000, from: accounts[1]})
        for (var i = 0; i < blocksDelay; i++) {
          web3.currentProvider.send({jsonrpc: "2.0", method: "evm_mine", params: [], id: 0})
        }
        await timeLockedController.finalizeMint(3, {gas: 3000000, from: accounts[1]})
        await expectThrow(timeLockedController.finalizeMint(3, {gas: 3000000, from: accounts[1]})) //can't double-finalize
        await userHasCoins(3, 40219)
        await timeLockedController.transferAdminship(accounts[2], {gas: 3000000, from: accounts[0]})
        await expectThrow(timeLockedController.finalizeMint(2, {gas: 3000000, from: accounts[3]})) //can't finalize because admin has been changed
        await expectThrow(timeLockedController.requestTransferChildrenOwnership(accounts[2], {gas: 3000000, from: accounts[1]})) //only admin/owner can request
        await timeLockedController.requestTransferChildrenOwnership(accounts[2], {gas: 3000000, from: accounts[2]})
        await timeLockedController.requestMint(accounts[3], 500000, {gas: 3000000, from: accounts[2]})
        await timeLockedController.requestMint(accounts[3], 6000000, {gas: 3000000, from: accounts[2]})
        await expectThrow(timeLockedController.finalizeTransferChildrenOwnership({gas: 3000000, from: accounts[2]})) //too early to finalize
        for (var i = 0; i < blocksDelay; i++) {
          web3.currentProvider.send({jsonrpc: "2.0", method: "evm_mine", params: [], id: 0})
        }
        await timeLockedController.finalizeTransferChildrenOwnership({gas: 3000000, from: accounts[0]})
        await timeLockedController.finalizeMint(4, {gas: 3000000, from: accounts[2]}) // can still finalize because ownership isn't transferred until claimed
        await userHasCoins(3, 540219)
        await trueUSD.claimOwnership({gas: 3000000, from: accounts[2]})
        await expectThrow(timeLockedController.finalizeMint(5, {gas: 3000000, from: accounts[2]})) //timeLockedController is no longer the owner of trueUSD
        await trueUSD.transferOwnership(timeLockedController.address, {gas: 3000000, from: accounts[2]})
        await timeLockedController.issueClaimOwnership(trueUSD.address, {gas: 3000000, from: accounts[0]})
        await timeLockedController.finalizeMint(5, {gas: 3000000, from: accounts[2]})
        await userHasCoins(3, 6540219)
    })
})
