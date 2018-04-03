const NamableAddressList = artifacts.require("NamableAddressList");
var Web3 = require('web3');

//copied from https://github.com/OpenZeppelin/zeppelin-solidity/blob/master/test/helpers/assertRevert.js
//TODO: how to import this directly from node_modules or zeppelin fork?
assertRevert = async promise => {
  try {
    await promise;
    assert.fail('Expected revert not received');
  } catch (error) {
    const revertFound = error.message.search('revert') >= 0;
    assert(revertFound, `Expected "revert", got ${error} instead`);
  }
};

contract('NamableAddressList', function(accounts) {
    it("should work", async () => {
        const burnWhiteList = await NamableAddressList.new("Burn whitelist")

        let name = await burnWhiteList.name();
        assert.equal(name, "Burn whitelist", "Got wrong name");
        await assertRevert(burnWhiteList.changeName("fooList", {from: accounts[1]}))
        await burnWhiteList.changeName("fooList", {from: accounts[0]})
        name = await burnWhiteList.name();
        assert.equal(name, "fooList", "Got wrong name");

        let canBurn = await burnWhiteList.onList(accounts[0])
        assert.equal(canBurn, false, "User should not be on white list");

        await burnWhiteList.changeList(accounts[0], true)
        canBurn = await burnWhiteList.onList(accounts[0])
        assert.equal(canBurn, true, "User should be on white list");
    })
})
