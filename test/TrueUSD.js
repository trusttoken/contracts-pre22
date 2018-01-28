const AddressList = artifacts.require("AddressList");
const TrueUSD = artifacts.require("TrueUSD");
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

contract('TrueUSD', function(accounts) {
    it("should work", async () => {
        const mintWhiteList = await AddressList.new("Mint whitelist", {gas: 3000000, from: accounts[0]})
        const burnWhiteList = await AddressList.new("Burn whitelist", {gas: 3000000, from: accounts[0]})
        const blackList = await AddressList.new("Blacklist", {gas: 3000000, from: accounts[0]})
        const trueUSD = await TrueUSD.new(mintWhiteList.address, burnWhiteList.address, blackList.address, {gas: 4000000, from: accounts[0]})
        await expectThrow(trueUSD.mint(accounts[3], 10, {gas: 3000000, from: accounts[0]})) //user 3 is not (yet) on whitelist
        await expectThrow(mintWhiteList.changeList(accounts[3], true, {gas: 3000000, from: accounts[1]})) //user 1 is not the owner
        await mintWhiteList.changeList(accounts[3], true, {gas: 3000000, from: accounts[0]})
        async function userHasCoins(id, amount) {
          var balance = await trueUSD.balanceOf(accounts[id])
          assert.equal(balance, amount, "userHasCoins fail: actual balance "+balance)
        }
        await userHasCoins(3, 0)
        await trueUSD.mint(accounts[3], 12345, {gas: 3000000, from: accounts[0]})
        await userHasCoins(3, 12345)
        await userHasCoins(0, 0)
        await trueUSD.transfer(accounts[4], 11000, {gas: 3000000, from: accounts[3]})
        await userHasCoins(3, 1345)
        await userHasCoins(4, 11000-7)
        await trueUSD.pause()
        await expectThrow(trueUSD.transfer(accounts[5], 9999, {gas: 3000000, from: accounts[4]}))
        await trueUSD.unpause()
        await trueUSD.transfer(accounts[5], 9999, {gas: 3000000, from: accounts[4]})
        await userHasCoins(5, 9999-6)
        await userHasCoins(0, 7+6)
    })
})
