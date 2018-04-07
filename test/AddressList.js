const AddressList = artifacts.require("AddressList")
var Web3 = require('web3')
import assertRevert from './helpers/assertRevert'

contract('AddressList', function(accounts) {
    it("should work", async () => {
        const burnWhiteList = await AddressList.new("Burn whitelist")

        let name = await burnWhiteList.name()
        assert.equal(name, "Burn whitelist", "Got wrong name")

        let canBurn = await burnWhiteList.onList(accounts[0])
        assert.equal(canBurn, false, "User should not be on white list")

        await burnWhiteList.changeList(accounts[0], true)
        canBurn = await burnWhiteList.onList(accounts[0])
        assert.equal(canBurn, true, "User should be on white list")
    })
})
