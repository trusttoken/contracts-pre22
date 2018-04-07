import assertRevert from './helpers/assertRevert'
const NamableAddressList = artifacts.require("NamableAddressList")
var Web3 = require('web3')

contract('NamableAddressList', function([_, owner, anotherAccount]) {
    beforeEach(async function () {
        this.whitelist = await NamableAddressList.new("Burn whitelist", {from: owner})
    })

    it("owner can change name", async function() {
        let name = await this.whitelist.name()
        assert.equal(name, "Burn whitelist", "Got wrong name")
        await this.whitelist.changeName("fooList", {from: owner})
        name = await this.whitelist.name()
        assert.equal(name, "fooList", "Got wrong name")
    })

    it("non-owner can't change name", async function() {
        await assertRevert(this.whitelist.changeName("fooList", { from: anotherAccount }))
    })
})
