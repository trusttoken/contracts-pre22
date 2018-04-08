import assertRevert from './helpers/assertRevert'
const AddressList = artifacts.require("AddressList")

contract('AddressList', function([_, owner, oneHundred, anotherAccount]) {
    beforeEach(async function () {
        this.list = await AddressList.new("Burn whitelist", { from: owner })
    })

    it("has the given name", async function () {
        const name = await this.list.name()
        assert.equal(name, "Burn whitelist", "Got wrong name")
    })

    it("initially maps users to false", async function () {
        const canBurn = await this.list.onList(oneHundred, { from: owner })
        assert.equal(canBurn, false, "User should not be on white list")
    })

    it("can set to true", async function () {
        await this.list.changeList(oneHundred, true, { from: owner })
        const canBurn = await this.list.onList(oneHundred)
        assert.equal(canBurn, true, "User should be on white list")
    })

    it("non-owner can't change list", async function () {
        await assertRevert(this.list.changeList(oneHundred, true, { from: anotherAccount }))
    })

    it('emits an event', async function () {
        const { logs } = await this.list.changeList(oneHundred, true, { from: owner })

        assert.equal(logs.length, 1)
        assert.equal(logs[0].event, 'ChangeList')
        assert.equal(logs[0].args.addr, oneHundred)
        assert.equal(logs[0].args.value, true)
    })
})
