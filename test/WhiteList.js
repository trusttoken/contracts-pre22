const WhiteList = artifacts.require("WhiteList");
const TrueUSD = artifacts.require("TrueUSD");
var Web3 = require('web3');

contract('WhiteList', function(accounts) {
    it("should work", async () => {
        const mintWhiteList = await WhiteList.new("Mint whitelist", {gas: 3000000, from: accounts[0]})
        const burnWhiteList = await WhiteList.new("Burn whitelist", {gas: 3000000, from: accounts[0]})

        const name = await mintWhiteList.name();
        assert.equal(Web3.utils.toAscii(name).replace(/\u0000/g, ''), "Mint whitelist", "Got wrong name");

        const trueUSD = await TrueUSD.new(mintWhiteList.address, burnWhiteList.address, {gas: 3000000, from: accounts[0]})
        let canMint = await trueUSD.onMintWhitelist(accounts[0])
        let canBurn = await trueUSD.onBurnWhitelist(accounts[0])
        assert.equal(canMint, false, "User should not be on white list");
        assert.equal(canBurn, false, "User should not be on white list");

        await mintWhiteList.changeWhiteList(accounts[0], true)//.send({gas: 3000000, from: accounts[0]})
        canMint = await trueUSD.onMintWhitelist(accounts[0])
        canBurn = await trueUSD.onBurnWhitelist(accounts[0])
        assert.equal(canMint, true, "User should be on white list");
        assert.equal(canBurn, false, "User should not be on white list");

        await burnWhiteList.changeWhiteList(accounts[0], true)//.send({gas: 3000000, from: accounts[0]})
        canMint = await trueUSD.onMintWhitelist(accounts[0])
        canBurn = await trueUSD.onBurnWhitelist(accounts[0])
        assert.equal(canMint, true, "User should be on white list");
        assert.equal(canBurn, true, "User should not be on white list");
    })
})
