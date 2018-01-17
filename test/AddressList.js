const AddressList = artifacts.require("AddressList");
const TrueUSD = artifacts.require("TrueUSD");
var Web3 = require('web3');

contract('AddressList', function(accounts) {
    it("should work", async () => {
        const mintWhiteList = await AddressList.new("Mint whitelist", {gas: 3000000, from: accounts[0]})
        const burnWhiteList = await AddressList.new("Burn whitelist", {gas: 3000000, from: accounts[0]})

        const name = await mintWhiteList.name();
        assert.equal(name, "Mint whitelist", "Got wrong name");

        const trueUSD = await TrueUSD.new(mintWhiteList.address, burnWhiteList.address, {gas: 3000000, from: accounts[0]})
        let canMint = await mintWhiteList.onList(accounts[0])
        let canBurn = await burnWhiteList.onList(accounts[0])
        assert.equal(canMint, false, "User should not be on white list");
        assert.equal(canBurn, false, "User should not be on white list");

        await mintWhiteList.changeList(accounts[0], true)//.send({gas: 3000000, from: accounts[0]})
        canMint = await mintWhiteList.onList(accounts[0])
        canBurn = await burnWhiteList.onList(accounts[0])
        assert.equal(canMint, true, "User should be on white list");
        assert.equal(canBurn, false, "User should not be on white list");

        await burnWhiteList.changeList(accounts[0], true)//.send({gas: 3000000, from: accounts[0]})
        canMint = await mintWhiteList.onList(accounts[0])
        canBurn = await burnWhiteList.onList(accounts[0])
        assert.equal(canMint, true, "User should be on white list");
        assert.equal(canBurn, true, "User should be on white list");
    })
})
