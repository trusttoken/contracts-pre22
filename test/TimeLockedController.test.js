import assertRevert from './helpers/assertRevert'
import increaseTime, { duration } from './helpers/increaseTime'
const Registry = artifacts.require("Registry")
const TrueUSD = artifacts.require("TrueUSD")
const BalanceSheet = artifacts.require("BalanceSheet")
const AllowanceSheet = artifacts.require("AllowanceSheet")
const TimeLockedController = artifacts.require("TimeLockedController")
// const TimeLockedControllerMock = artifacts.require("TimeLockedControllerMock")
const TrueUSDMock = artifacts.require("TrueUSDMock")

contract('TimeLockedController', function ([_, owner, oneHundred, admin]) {
    beforeEach(async function () {
        // this.controller = await TimeLockedControllerMock.new(oneHundred, 100, { from: owner })
        this.registry = await Registry.new({ from: owner })
        this.trueUSD = await TrueUSDMock.new(oneHundred, 100, { from: owner })
        this.controller = await TimeLockedController.new({ from: owner })
        await this.registry.transferOwnership(this.controller.address, { from: owner })
        await this.trueUSD.transferOwnership(this.controller.address, { from: owner })
        await this.controller.issueClaimOwnership(this.registry.address, { from: owner })
        await this.controller.issueClaimOwnership(this.trueUSD.address, { from: owner })
        await this.controller.transferAdminship(admin, { from: owner })
    })

    describe('changeMintDelay', function () {
        it('sets the mint delay', async function () {
            await this.controller.changeMintDelay(duration.hours(12), { from: owner })

            const delay = await this.controller.mintDelay()
            assert.equal(delay, duration.hours(12))
        })

        it('emits an event', async function () {
            const { logs } = await this.controller.changeMintDelay(duration.hours(12), { from: owner })

            assert.equal(logs.length, 1)
            assert.equal(logs[0].event, 'ChangeMintDelay')
            assert.equal(logs[0].args.newDelay, duration.hours(12))
        })

        it('cannot be called by non-owner', async function () {
            await assertRevert(this.controller.changeMintDelay(duration.hours(12), { from: admin }))
        })
    })

    describe('setAttribute', function () {
        it('sets the attribute', async function () {
            await this.controller.setAttribute(this.registry.address, oneHundred, "foo", 3, { from: owner })

            const attr = await this.registry.hasAttribute(oneHundred, "foo")
            assert.equal(attr, true)
        })

        it('can be called by admin', async function () {
            await this.controller.setAttribute(this.registry.address, oneHundred, "foo", 3, { from: admin })
        })

        it('cannot be called by others', async function () {
            await assertRevert(this.controller.setAttribute(this.registry.address, oneHundred, "foo", 3, { from: oneHundred }))
        })
    })

    // describe('setDelegatedFrom', function () {
    //     it('sets delegatedFrom', async function () {
    //         let x = await this.trueUSD.owner()
    //         assert.equal(x, this.controller.address)
    //         x = await this.controller.owner()
    //         assert.equal(x, owner)
    //         await this.controller.setDelegatedFrom(oneHundred, { from: owner })

    //         // const addr = await this.trueUSD.delegatedFrom()
    //         // assert.equal(addr, oneHundred)
    //     })

    //     it('cannot be called by others', async function () {
    //         // await assertRevert(this.controller.setDelegatedFrom(oneHundred, { from: admin }))
    //     })
    // })

    // describe('changeTokenName', function () {
    //     it('sets the token name', async function () {
    //         await this.controller.changeTokenName("FooCoin", "FCN", { from: owner })
    //     })
    // })
})

contract('TimeLockedController - old test', function (accounts) {
    it("old long interaction trace test", async function () {
        const registry = await Registry.new()
        const balances = await BalanceSheet.new()
        const allowances = await AllowanceSheet.new()
        const trueUSD = await TrueUSD.new()
        await balances.transferOwnership(trueUSD.address)
        await allowances.transferOwnership(trueUSD.address)
        await trueUSD.setBalanceSheet(balances.address)
        await trueUSD.setAllowanceSheet(allowances.address)
        await registry.setAttribute(accounts[3], "hasPassedKYC", 1, { from: accounts[0] })
        async function userHasCoins(id, amount) {
            var balance = await trueUSD.balanceOf(accounts[id])
            assert.equal(balance, amount, "userHasCoins fail: actual balance " + balance)
        }
        const timeLockedController = await TimeLockedController.new({ from: accounts[0] })
        await registry.transferOwnership(timeLockedController.address, { from: accounts[0] })
        await trueUSD.transferOwnership(timeLockedController.address, { from: accounts[0] })
        await timeLockedController.issueClaimOwnership(registry.address, { from: accounts[0] })
        await timeLockedController.issueClaimOwnership(trueUSD.address, { from: accounts[0] })
        await timeLockedController.setTrueUSD(trueUSD.address)
        await timeLockedController.setRegistry(registry.address, { from: accounts[0] })
        await assertRevert(trueUSD.mint(accounts[3], 10, { from: accounts[0] })) //user 0 is no longer the owner
        await timeLockedController.requestMint(accounts[3], 9, { from: accounts[0] })
        await timeLockedController.finalizeMint(0, { from: accounts[0] }) // the owner can finalize immediately
        await userHasCoins(3, 9)
        await assertRevert(timeLockedController.requestMint(accounts[3], 200, { from: accounts[1] })) //user 1 is not (yet) the admin
        await timeLockedController.transferAdminship(accounts[1], { from: accounts[0] })
        await timeLockedController.requestMint(accounts[3], 200, { from: accounts[1] })
        await assertRevert(timeLockedController.finalizeMint(1, { from: accounts[3] })) //mint request cannot be finalized this early
        await increaseTime(duration.hours(12))
        await assertRevert(timeLockedController.finalizeMint(1, { from: accounts[3] })) //still not enough time has passed
        await increaseTime(duration.hours(12))
        await timeLockedController.finalizeMint(1, { from: accounts[1] }) //only target of mint can finalize
        await userHasCoins(3, 209)
        await timeLockedController.requestMint(accounts[3], 3000, { from: accounts[1] })
        await timeLockedController.requestMint(accounts[3], 40000, { from: accounts[1] })
        await increaseTime(duration.days(1))
        await timeLockedController.finalizeMint(3, { from: accounts[1] })
        await assertRevert(timeLockedController.finalizeMint(3, { from: accounts[1] })) //can't double-finalize
        await userHasCoins(3, 40209)
        await timeLockedController.transferAdminship(accounts[2], { from: accounts[0] })
        await assertRevert(timeLockedController.finalizeMint(2, { from: accounts[3] })) //can't finalize because admin has been changed
        await assertRevert(timeLockedController.transferChild(trueUSD.address, accounts[2], { from: accounts[1] })) //only owner
        await timeLockedController.requestMint(accounts[3], 500000, { from: accounts[2] })
        await timeLockedController.transferChild(trueUSD.address, accounts[2], { from: accounts[0] })
        await timeLockedController.transferChild(registry.address, accounts[2], { from: accounts[0] })
        await trueUSD.claimOwnership({ from: accounts[2] })
        await assertRevert(timeLockedController.finalizeMint(4, { from: accounts[2] })) //timeLockedController is no longer the owner of trueUSD
        await trueUSD.transferOwnership(timeLockedController.address, { from: accounts[2] })
        await timeLockedController.issueClaimOwnership(trueUSD.address, { from: accounts[0] })
        await increaseTime(duration.days(1))
        await timeLockedController.finalizeMint(4, { from: accounts[2] })
        await userHasCoins(3, 540209)
    })
})
