import assertRevert from './helpers/assertRevert'
const NamableAddressList = artifacts.require("NamableAddressList")

contract('NamableAddressList', function([_, owner, anotherAccount]) {
    beforeEach(async function () {
        this.whitelist = await NamableAddressList.new("Burn whitelist", {from: owner})
    })

    describe('changeName', function () {
        it("owner can change name", async function () {
            let name = await this.whitelist.name()
            assert.equal(name, "Burn whitelist", "Got wrong name")
            await this.whitelist.changeName("fooList", {from: owner})
            name = await this.whitelist.name()
            assert.equal(name, "fooList", "Got wrong name")
        })

        it('emits an event', async function () {
            const { logs } = await this.whitelist.changeName("fooList", { from: owner })

            assert.equal(logs.length, 1)
            assert.equal(logs[0].event, 'ChangeName')
            assert.equal(logs[0].args.name, "fooList")
        })

        it("non-owner can't change name", async function () {
            await assertRevert(this.whitelist.changeName("fooList", { from: anotherAccount }))
        })
    })
})
