const AddressList = artifacts.require("AddressList");
const TrueUSD = artifacts.require("TrueUSD");
const TimeLockedAdmin = artifacts.require("TimeLockedAdmin");
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

contract('TimeLockedAdmin', function(accounts) {
    it("should work", async () => {
        const mintWhiteList = await AddressList.new("Mint whitelist", {gas: 3000000, from: accounts[0]})
        const burnWhiteList = await AddressList.new("Burn whitelist", {gas: 3000000, from: accounts[0]})
        const blackList = await AddressList.new("Blacklist", {gas: 3000000, from: accounts[0]})
        const trueUSD = await TrueUSD.new(mintWhiteList.address, burnWhiteList.address, blackList.address, {gas: 4000000, from: accounts[0]})
        await expectThrow(trueUSD.mint(accounts[3], 10, {gas: 3000000, from: accounts[0]})) //user 3 is not (yet) on whitelist
        await expectThrow(mintWhiteList.changeList(accounts[3], true, {gas: 3000000, from: accounts[1]})) //user 1 is not the owner
        await mintWhiteList.changeList(accounts[3], true, {gas: 3000000, from: accounts[0]})
        var balance = await trueUSD.balanceOf(accounts[3])
        assert.equal(balance, 0, "accounts[3] should start with nothing")
        await trueUSD.mint(accounts[3], 10, {gas: 3000000, from: accounts[0]})
        var balance = await trueUSD.balanceOf(accounts[3])
        assert.equal(balance, 10, "accounts[3] should have coins after mint")
        const timeLockedAdmin = await TimeLockedAdmin.new(trueUSD.address, burnWhiteList.address, mintWhiteList.address, blackList.address, {gas: 4000000, from: accounts[0]})
        await mintWhiteList.transferOwnership(timeLockedAdmin.address, {gas: 3000000, from: accounts[0]})
        await burnWhiteList.transferOwnership(timeLockedAdmin.address, {gas: 3000000, from: accounts[0]})
        await blackList.transferOwnership(timeLockedAdmin.address, {gas: 3000000, from: accounts[0]})
        await trueUSD.transferOwnership(timeLockedAdmin.address, {gas: 3000000, from: accounts[0]})
        await expectThrow(trueUSD.mint(accounts[3], 10, {gas: 3000000, from: accounts[0]})) //user 0 is no longer the owner
        await expectThrow(timeLockedAdmin.requestMint(accounts[3], 200, {gas: 3000000, from: accounts[0]})) //user 0 is owner but not the admin
        await expectThrow(timeLockedAdmin.requestMint(accounts[3], 200, {gas: 3000000, from: accounts[1]})) //user 1 is not (yet) the admin
        await timeLockedAdmin.transferAdminship(accounts[1], {gas: 3000000, from: accounts[0]})
        await timeLockedAdmin.requestMint(accounts[3], 200, {gas: 3000000, from: accounts[1]})
        await expectThrow(timeLockedAdmin.finalizeMint(0, {gas: 3000000, from: accounts[3]})) //mint request cannot be finalized this early
        var blocksDelay = 20 //NOTE: this should be a day's worth of blocks (24*60*60/15), but testing that takes too long, so instead change that value to 20 in the contract for testing
        for (var i = 0; i < blocksDelay/2; i++) {
          web3.currentProvider.send({jsonrpc: "2.0", method: "evm_mine", params: [], id: 0})
        }
        await expectThrow(timeLockedAdmin.finalizeMint(0, {gas: 3000000, from: accounts[3]})) //still not enough time has passed
        for (var i = 0; i < blocksDelay/2; i++) {
          web3.currentProvider.send({jsonrpc: "2.0", method: "evm_mine", params: [], id: 0})
        }
        await expectThrow(timeLockedAdmin.finalizeMint(0, {gas: 3000000, from: accounts[1]})) //only target of mint can finalize
        balance = await trueUSD.balanceOf(accounts[3])
        assert.equal(balance, 10, "accounts[3] should have coins after mint")
        await timeLockedAdmin.finalizeMint(0, {gas: 3000000, from: accounts[3]})
        balance = await trueUSD.balanceOf(accounts[3])
        assert.equal(balance, 210, "accounts[3] should have coins after mint")
        await timeLockedAdmin.requestMint(accounts[3], 3000, {gas: 3000000, from: accounts[1]})
        await timeLockedAdmin.requestMint(accounts[3], 40000, {gas: 3000000, from: accounts[1]})
        for (var i = 0; i < blocksDelay; i++) {
          web3.currentProvider.send({jsonrpc: "2.0", method: "evm_mine", params: [], id: 0})
        }
        await timeLockedAdmin.finalizeMint(2, {gas: 3000000, from: accounts[3]})
        await expectThrow(timeLockedAdmin.finalizeMint(2, {gas: 3000000, from: accounts[3]})) //can't double-finalize
        balance = await trueUSD.balanceOf(accounts[3])
        assert.equal(balance, 40210, "accounts[3] should have coins after mint")
        await timeLockedAdmin.transferAdminship(accounts[2], {gas: 3000000, from: accounts[0]})
        await expectThrow(timeLockedAdmin.finalizeMint(1, {gas: 3000000, from: accounts[3]})) //can't finalize because admin has been changed
        await expectThrow(timeLockedAdmin.requestTransferOwnership(accounts[2], {gas: 3000000, from: accounts[0]})) //only admin can request
        await timeLockedAdmin.requestTransferOwnership(accounts[2], {gas: 3000000, from: accounts[2]})
        await timeLockedAdmin.requestMint(accounts[3], 500000, {gas: 3000000, from: accounts[2]})
        await timeLockedAdmin.requestMint(accounts[3], 6000000, {gas: 3000000, from: accounts[2]})
        await expectThrow(timeLockedAdmin.finalizeTransferOwnership({gas: 3000000, from: accounts[2]})) //too early to finalize
        for (var i = 0; i < blocksDelay; i++) {
          web3.currentProvider.send({jsonrpc: "2.0", method: "evm_mine", params: [], id: 0})
        }
        await expectThrow(timeLockedAdmin.finalizeTransferOwnership({gas: 3000000, from: accounts[0]})) //only new owner can finalize
        await timeLockedAdmin.finalizeMint(3, {gas: 3000000, from: accounts[3]})
        await timeLockedAdmin.finalizeTransferOwnership({gas: 3000000, from: accounts[2]})
        await expectThrow(timeLockedAdmin.finalizeMint(4, {gas: 3000000, from: accounts[3]})) //timeLockedAdmin is no longer the owner of trueUSD
        await expectThrow(trueUSD.transferOwnership(timeLockedAdmin.address, {gas: 3000000, from: accounts[0]})) //user 0 is not owner
        await trueUSD.transferOwnership(timeLockedAdmin.address, {gas: 3000000, from: accounts[2]})
        await timeLockedAdmin.finalizeMint(4, {gas: 3000000, from: accounts[3]})
        balance = await trueUSD.balanceOf(accounts[3])
        assert.equal(balance, 6540210, "accounts[3] should have coins after mint")
    })
})
