import assertRevert from './helpers/assertRevert'
const Registry = artifacts.require('Registry')
const RegistryAccessManagerMock = artifacts.require('RegistryAccessManagerMock')

contract('Registry', function ([_, owner, oneHundred, anotherAccount]) {
    beforeEach(async function () {
        this.registry = await Registry.new({ from: owner })
    })

    describe('read/write', function () {
        it('works for owner', async function () {
            const { receipt } = await this.registry.setAttribute(anotherAccount, "foo", 3, { from: owner })
            const attr = await this.registry.getAttribute(anotherAccount, "foo")
            assert.equal(attr[0], 3)
            assert.equal(attr[1], owner)
            assert.equal(attr[2], web3.eth.getBlock(receipt.blockNumber).timestamp)
            const hasAttr = await this.registry.hasAttribute(anotherAccount, "foo")
            assert.equal(hasAttr, true)
        })

        it('sets only desired attribute', async function () {
            const { receipt } = await this.registry.setAttribute(anotherAccount, "foo", 3, { from: owner })
            const attr = await this.registry.getAttribute(anotherAccount, "bar")
            assert.equal(attr[0], 0)
            assert.equal(attr[1], 0)
            assert.equal(attr[2], 0)
            const hasAttr = await this.registry.hasAttribute(anotherAccount, "bar")
            assert.equal(hasAttr, false)
        })

        it('emits an event', async function () {
            const { logs } = await this.registry.setAttribute(anotherAccount, "foo", 3, { from: owner })

            assert.equal(logs.length, 1)
            assert.equal(logs[0].event, 'SetAttribute')
            assert.equal(logs[0].args.who, anotherAccount)
            assert.equal(logs[0].args.attribute, "foo")
            assert.equal(logs[0].args.value, 3)
            assert.equal(logs[0].args.adminAddr, owner)
        })

        it('cannot be called by random non-owner', async function () {
            await assertRevert(this.registry.setAttribute(anotherAccount, "foo", 3, { from: oneHundred }))
        })

        it('owner can let others write', async function () {
            await this.registry.setAttribute(oneHundred, "canWriteTofoo", 3, { from: owner })
            await this.registry.setAttribute(anotherAccount, "foo", 3, { from: oneHundred })
        })

        it('others can only write what they are allowed to', async function () {
            await this.registry.setAttribute(oneHundred, "canWritefoo", 3, { from: owner })
            await assertRevert(this.registry.setAttribute(anotherAccount, "bar", 3, { from: oneHundred }))
        })
    })

    describe('set manager', function () {
        beforeEach(async function () {
            this.manager = await RegistryAccessManagerMock.new({ from: owner })
        })

        it('sets the manager', async function () {
            await this.registry.setManager(this.manager.address, { from: owner })

            let manager = await this.registry.accessManager()
            assert.equal(manager, this.manager.address)
        })

        it('emits an event', async function () {
            let oldManager = await this.registry.accessManager()
            const { logs } = await this.registry.setManager(this.manager.address, { from: owner })

            assert.equal(logs.length, 1)
            assert.equal(logs[0].event, 'SetManager')
            assert.equal(logs[0].args.oldManager, oldManager)
            assert.equal(logs[0].args.newManager, this.manager.address)
        })

        it('cannot be called by non-owner', async function () {
            await assertRevert(this.registry.setManager(this.manager.address, { from: anotherAccount }))
        })
    })
})
