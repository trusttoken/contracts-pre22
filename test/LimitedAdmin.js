const WhiteList = artifacts.require("WhiteList");
const TrueUSD = artifacts.require("TrueUSD");
const LimitedAdmin = artifacts.require("LimitedAdmin");
var Web3 = require('web3');

//https://github.com/OpenZeppelin/zeppelin-solidity/blob/master/test/helpers/expectThrow.js
expectThrow = async promise => {
  try {
    await promise;
  } catch (error) {
    // // TODO: Check jump destination to destinguish between a throw
    // //       and an actual invalid jump.
    // const invalidOpcode = error.message.search('invalid opcode') >= 0;
    // // TODO: When we contract A calls contract B, and B throws, instead
    // //       of an 'invalid jump', we get an 'out of gas' error. How do
    // //       we distinguish this from an actual out of gas event? (The
    // //       testrpc log actually show an 'invalid jump' event.)
    // const outOfGas = error.message.search('out of gas') >= 0;
    // const revert = error.message.search('revert') >= 0;
    // assert(
    //   invalidOpcode || outOfGas || revert,
    //   'Expected throw, got \'' + error + '\' instead',
    // );
    return;
  }
  assert.fail('Expected throw not received');
};

contract('LimitedAdmin', function(accounts) {
    it("should work", async () => {
        const mintWhiteList = await WhiteList.new("Mint whitelist", {gas: 3000000, from: accounts[0]})
        const burnWhiteList = await WhiteList.new("Burn whitelist", {gas: 3000000, from: accounts[0]})
        const trueUSD = await TrueUSD.new(mintWhiteList.address, burnWhiteList.address, {gas: 3000000, from: accounts[0]})
        await expectThrow(trueUSD.mint(accounts[3], 10, {gas: 3000000, from: accounts[0]})) //user 3 is not (yet) on whitelist
        await expectThrow(mintWhiteList.changeWhiteList(accounts[3], true, {gas: 3000000, from: accounts[1]})) //user 1 is not the owner
        await mintWhiteList.changeWhiteList(accounts[3], true, {gas: 3000000, from: accounts[0]})
        var balance = await trueUSD.balanceOf(accounts[3])
        assert.equal(balance, 0, "accounts[3] should start with nothing")
        await trueUSD.mint(accounts[3], 10, {gas: 3000000, from: accounts[0]})
        var balance = await trueUSD.balanceOf(accounts[3])
        assert.equal(balance, 10, "accounts[3] should have coins after mint")
        const limitedAdmin = await LimitedAdmin.new(trueUSD.address, {gas: 3000000, from: accounts[0]})
        await trueUSD.transferOwnership(limitedAdmin.address, {gas: 3000000, from: accounts[0]})
        await expectThrow(trueUSD.mint(accounts[3], 10, {gas: 3000000, from: accounts[0]})) //user 0 is no longer the owner
        await expectThrow(limitedAdmin.requestMint(accounts[3], 200, {gas: 3000000, from: accounts[0]})) //user 0 is owner but not the admin
        await expectThrow(limitedAdmin.requestMint(accounts[3], 200, {gas: 3000000, from: accounts[1]})) //user 1 is not (yet) the admin
        await limitedAdmin.transferAdminship(accounts[1], {gas: 3000000, from: accounts[0]})
        await limitedAdmin.requestMint(accounts[3], 200, {gas: 3000000, from: accounts[1]})
        await expectThrow(limitedAdmin.finalizeMint(0, {gas: 3000000, from: accounts[3]})) //mint request cannot be finalized this early
        var blocksDelay = 20 //NOTE: this should be a day's worth of blocks (24*60*60/15), but testing that takes too long, so instead change that value to 20 in the contract for testing
        for (var i = 0; i < blocksDelay/2; i++) {
          web3.currentProvider.send({jsonrpc: "2.0", method: "evm_mine", params: [], id: 0})
        }
        await expectThrow(limitedAdmin.finalizeMint(0, {gas: 3000000, from: accounts[3]})) //still not enough time has passed
        for (var i = 0; i < blocksDelay/2; i++) {
          web3.currentProvider.send({jsonrpc: "2.0", method: "evm_mine", params: [], id: 0})
        }
        await expectThrow(limitedAdmin.finalizeMint(0, {gas: 3000000, from: accounts[1]})) //only target of mint can finalize
        balance = await trueUSD.balanceOf(accounts[3])
        assert.equal(balance, 10, "accounts[3] should have coins after mint")
        await limitedAdmin.finalizeMint(0, {gas: 3000000, from: accounts[3]})
        balance = await trueUSD.balanceOf(accounts[3])
        assert.equal(balance, 210, "accounts[3] should have coins after mint")
        await limitedAdmin.requestMint(accounts[3], 3000, {gas: 3000000, from: accounts[1]})
        await limitedAdmin.requestMint(accounts[3], 40000, {gas: 3000000, from: accounts[1]})
        for (var i = 0; i < blocksDelay; i++) {
          web3.currentProvider.send({jsonrpc: "2.0", method: "evm_mine", params: [], id: 0})
        }
        await limitedAdmin.finalizeMint(2, {gas: 3000000, from: accounts[3]})
        await expectThrow(limitedAdmin.finalizeMint(2, {gas: 3000000, from: accounts[3]})) //can't double-finalize
        balance = await trueUSD.balanceOf(accounts[3])
        assert.equal(balance, 40210, "accounts[3] should have coins after mint")
        await limitedAdmin.transferAdminship(accounts[2], {gas: 3000000, from: accounts[0]})
        await expectThrow(limitedAdmin.finalizeMint(1, {gas: 3000000, from: accounts[3]})) //can't finalize because admin has been changed
        await expectThrow(limitedAdmin.requestTransferOwnership(accounts[2], {gas: 3000000, from: accounts[0]})) //only admin can request
        await limitedAdmin.requestTransferOwnership(accounts[2], {gas: 3000000, from: accounts[2]})
        await limitedAdmin.requestMint(accounts[3], 500000, {gas: 3000000, from: accounts[2]})
        await limitedAdmin.requestMint(accounts[3], 6000000, {gas: 3000000, from: accounts[2]})
        await expectThrow(limitedAdmin.finalizeTransferOwnership({gas: 3000000, from: accounts[2]})) //too early to finalize
        for (var i = 0; i < blocksDelay; i++) {
          web3.currentProvider.send({jsonrpc: "2.0", method: "evm_mine", params: [], id: 0})
        }
        await expectThrow(limitedAdmin.finalizeTransferOwnership({gas: 3000000, from: accounts[0]})) //only new owner can finalize
        await limitedAdmin.finalizeMint(3, {gas: 3000000, from: accounts[3]})
        await limitedAdmin.finalizeTransferOwnership({gas: 3000000, from: accounts[2]})
        await expectThrow(limitedAdmin.finalizeMint(4, {gas: 3000000, from: accounts[3]})) //limitedAdmin is no longer the owner of trueUSD
        await expectThrow(trueUSD.transferOwnership(limitedAdmin.address, {gas: 3000000, from: accounts[0]})) //user 0 is not owner
        await trueUSD.transferOwnership(limitedAdmin.address, {gas: 3000000, from: accounts[2]})
        await limitedAdmin.finalizeMint(4, {gas: 3000000, from: accounts[3]})
        balance = await trueUSD.balanceOf(accounts[3])
        assert.equal(balance, 6540210, "accounts[3] should have coins after mint")
    })
})
