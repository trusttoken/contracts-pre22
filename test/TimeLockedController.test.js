import assertRevert from './helpers/assertRevert'
import assertBalance from './helpers/assertBalance'
import increaseTime, { duration } from './helpers/increaseTime'
const Registry = artifacts.require("Registry")
const TrueUSD = artifacts.require("TrueUSD")
const BalanceSheet = artifacts.require("BalanceSheet")
const AllowanceSheet = artifacts.require("AllowanceSheet")
const TimeLockedController = artifacts.require("TimeLockedController")
const TrueUSDMock = artifacts.require("TrueUSDMock")
const ForceEther = artifacts.require("ForceEther")

contract('TimeLockedController', function (accounts) {
    describe('--TimeLockedController Tests--', function () {
        const [_, owner, oneHundred, admin] = accounts

        beforeEach(async function () {
            this.registry = await Registry.new({ from: owner })
            this.token = await TrueUSDMock.new(oneHundred, 100, { from: owner })
            await this.token.setRegistry(this.registry.address, { from: owner })
            this.controller = await TimeLockedController.new({ from: owner })
            await this.registry.transferOwnership(this.controller.address, { from: owner })
            await this.token.transferOwnership(this.controller.address, { from: owner })
            await this.controller.issueClaimOwnership(this.registry.address, { from: owner })
            await this.controller.issueClaimOwnership(this.token.address, { from: owner })
            await this.controller.setTrueUSD(this.token.address, { from: owner })
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

        describe('setDelegatedFrom', function () {
            it('sets delegatedFrom', async function () {
                await this.controller.setDelegatedFrom(oneHundred, { from: owner })

                const addr = await this.token.delegatedFrom()
                assert.equal(addr, oneHundred)
            })

            it('cannot be called by others', async function () {
                await assertRevert(this.controller.setDelegatedFrom(oneHundred, { from: admin }))
            })
        })

        describe('changeTokenName', function () {
            it('sets the token name', async function () {
                await this.controller.changeTokenName("FooCoin", "FCN", { from: owner })

                const name = await this.token.name()
                assert.equal(name, "FooCoin")
                const symbol = await this.token.symbol()
                assert.equal(symbol, "FCN")
            })

            it('cannot be called by others', async function () {
                await assertRevert(this.controller.changeTokenName("FooCoin", "FCN", { from: admin }))
            })
        })

        describe('setBurnBounds', function () {
            it('sets burnBounds', async function () {
                await this.controller.setBurnBounds(3, 4, { from: owner })

                const min = await this.token.burnMin()
                assert.equal(min, 3)
                const max = await this.token.burnMax()
                assert.equal(max, 4)
            })

            it('cannot be called by others', async function () {
                await assertRevert(this.controller.setBurnBounds(3, 4, { from: admin }))
            })
        })

        describe('changeStaker', function () {
            it('sets staker', async function () {
                await this.controller.changeStaker(oneHundred, { from: owner })

                const staker = await this.token.staker()
                assert.equal(staker, oneHundred)
            })

            it('cannot be called by others', async function () {
                await assertRevert(this.controller.changeStaker(oneHundred, { from: admin }))
            })
        })

        describe('delegateToNewContract', function () {
            it('sets delegate', async function () {
                await this.controller.delegateToNewContract(oneHundred, { from: owner })

                const delegate = await this.token.delegate()
                assert.equal(delegate, oneHundred)
            })

            it('cannot be called by others', async function () {
                await assertRevert(this.controller.delegateToNewContract(oneHundred, { from: admin }))
            })
        })

        describe('transferAdminship', function () {
            it('emits an event', async function () {
                const { logs } = await this.controller.transferAdminship(oneHundred, { from: owner })

                assert.equal(logs.length, 1)
                assert.equal(logs[0].event, 'TransferAdminship')
                assert.equal(logs[0].args.previousAdmin, admin)
                assert.equal(logs[0].args.newAdmin, oneHundred)
            })

            it('cannot set to 0x0', async function () {
                await assertRevert(this.controller.transferAdminship(0x0, { from: owner }))
            })

            it('cannot be called by others', async function () {
                await assertRevert(this.controller.transferAdminship(oneHundred, { from: admin }))
            })
        })

        describe('requestReclaimContract', function () {
            it('reclaims the contract', async function () {
                const balances = await this.token.balances()
                let balanceOwner = await BalanceSheet.at(balances).owner()
                assert.equal(balanceOwner, this.token.address)

                await this.controller.requestReclaimContract(balances, { from: owner })
                await this.controller.issueClaimOwnership(balances, { from: owner })
                balanceOwner = await BalanceSheet.at(balances).owner()
                assert.equal(balanceOwner, this.controller.address)
            })

            it('emits an event', async function () {
                const balances = await this.token.balances()
                const { logs } = await this.controller.requestReclaimContract(balances, { from: owner })

                assert.equal(logs.length, 1)
                assert.equal(logs[0].event, 'RequestReclaimContract')
                assert.equal(logs[0].args.other, balances)
            })

            it('cannot be called by others', async function () {
                const balances = await this.token.balances()
                await assertRevert(this.controller.requestReclaimContract(balances, { from: admin }))
            })
        })

        describe('requestReclaimEther', function () {
            it('reclaims ether', async function () {
                const balance1 = web3.fromWei(web3.eth.getBalance(oneHundred), 'ether').toNumber()
                const forceEther = await ForceEther.new({ from: oneHundred, value: 1000000000 })
                await forceEther.destroyAndSend(this.token.address)
                await this.controller.requestReclaimEther({ from: owner })
                const balance2 = web3.fromWei(web3.eth.getBalance(owner), 'ether').toNumber()
                assert.isAbove(balance2, balance1)
            })

            it('cannot be called by others', async function () {
                const forceEther = await ForceEther.new({ from: oneHundred, value: 1000000000 })
                await forceEther.destroyAndSend(this.token.address)
                await assertRevert(this.controller.requestReclaimEther({ from: admin }))
            })
        })

        describe('requestReclaimToken', function () {
            it('reclaims token', async function () {
                await this.token.transfer(this.token.address, 40, { from: oneHundred })
                await this.controller.requestReclaimToken(this.token.address, { from: owner })
                await assertBalance(this.token, owner, 40)
            })

            it('cannot be called by others', async function () {
                await this.token.transfer(this.token.address, 40, { from: oneHundred })
                await assertRevert(this.controller.requestReclaimToken(this.token.address, { from: admin }))
            })
        })

        describe('delegateToNewContract', function () {
            it('changes fees', async function () {
                await this.controller.changeStakingFees(1, 2, 3, 4, 5, 6, 7, 8, { from: owner })
                const transferFeeNumerator = await this.token.transferFeeNumerator()
                assert.equal(transferFeeNumerator, 1)
                const transferFeeDenominator = await this.token.transferFeeDenominator()
                assert.equal(transferFeeDenominator, 2)
                const mintFeeNumerator = await this.token.mintFeeNumerator()
                assert.equal(mintFeeNumerator, 3)
                const mintFeeDenominator = await this.token.mintFeeDenominator()
                assert.equal(mintFeeDenominator, 4)
                const mintFeeFlat = await this.token.mintFeeFlat()
                assert.equal(mintFeeFlat, 5)
                const burnFeeNumerator = await this.token.burnFeeNumerator()
                assert.equal(burnFeeNumerator, 6)
                const burnFeeDenominator = await this.token.burnFeeDenominator()
                assert.equal(burnFeeDenominator, 7)
                const burnFeeFlat = await this.token.burnFeeFlat()
                assert.equal(burnFeeFlat, 8)
            })

            it('cannot be called by others', async function () {
                await assertRevert(this.controller.changeStakingFees(1, 2, 3, 4, 5, 6, 7, 8, { from: admin }))
            })
        })
    })

    describe('--TimeLockedController old test--', function () {
        it("should work", async function () {
            const registry = await Registry.new()
            const balances = await BalanceSheet.new()
            const allowances = await AllowanceSheet.new()
            const trueUSD = await TrueUSD.new()
            await balances.transferOwnership(trueUSD.address)
            await allowances.transferOwnership(trueUSD.address)
            await trueUSD.setBalanceSheet(balances.address)
            await trueUSD.setAllowanceSheet(allowances.address)
            await registry.setAttribute(accounts[3], "hasPassedKYC/AML", 1, { from: accounts[0] })
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
            await assertBalance(trueUSD, accounts[3], 9)
            await assertRevert(timeLockedController.requestMint(accounts[3], 200, { from: accounts[1] })) //user 1 is not (yet) the admin
            await timeLockedController.transferAdminship(accounts[1], { from: accounts[0] })
            await timeLockedController.requestMint(accounts[3], 200, { from: accounts[1] })
            await assertRevert(timeLockedController.finalizeMint(1, { from: accounts[3] })) //mint request cannot be finalized this early
            await increaseTime(duration.hours(12))
            await assertRevert(timeLockedController.finalizeMint(1, { from: accounts[3] })) //still not enough time has passed
            await increaseTime(duration.hours(12))
            await timeLockedController.finalizeMint(1, { from: accounts[1] }) //only target of mint can finalize
            await assertBalance(trueUSD, accounts[3], 209)
            await timeLockedController.requestMint(accounts[3], 3000, { from: accounts[1] })
            await timeLockedController.requestMint(accounts[3], 40000, { from: accounts[1] })
            await increaseTime(duration.days(1))
            await timeLockedController.finalizeMint(3, { from: accounts[1] })
            await assertRevert(timeLockedController.finalizeMint(3, { from: accounts[1] })) //can't double-finalize
            await assertBalance(trueUSD, accounts[3], 40209)
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
            await assertBalance(trueUSD, accounts[3], 540209)
        })
    })
})
