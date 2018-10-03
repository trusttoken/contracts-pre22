import assertRevert from './helpers/assertRevert'
import expectThrow from './helpers/expectThrow'
import burnableTokenWithBoundsTests from './BurnableTokenWithBounds'
import basicTokenTests from './token/BasicToken';
import standardTokenTests from './token/StandardToken';
import burnableTokenTests from './token/BurnableToken';
import compliantTokenTests from './CompliantToken';
import tokenWithFeesTests from './TokenWithFees';
const Registry = artifacts.require("Registry")
const TrueUSD = artifacts.require("TrueUSD")
const TrueUSDMock = artifacts.require("TrueUSDMock")
const BalanceSheet = artifacts.require("BalanceSheet")
const AllowanceSheet = artifacts.require("AllowanceSheet")
const ForceEther = artifacts.require("ForceEther")
const GlobalPause = artifacts.require("GlobalPause")

contract('TrueUSD', function (accounts) {
    const [_, owner, oneHundred, anotherAccount] = accounts
    const notes = "some notes"

    describe('--TrueUSD Tests: 1 contract--', function () {
        beforeEach(async function () {
            // Set up a TrueUSD contract with 100 tokens for 'oneHundred'.
            this.registry = await Registry.new({ from: owner })
            this.balances = await BalanceSheet.new({ from: owner })
            this.allowances = await AllowanceSheet.new({ from: owner })
            this.token = await TrueUSD.new({ from: owner })
            this.globalPause = await GlobalPause.new({ from: owner })
            await this.token.setGlobalPause(this.globalPause.address, { from: owner })    
            await this.token.setRegistry(this.registry.address, { from: owner })
            await this.balances.transferOwnership(this.token.address, { from: owner })
            await this.allowances.transferOwnership(this.token.address, { from: owner })
            await this.token.setBalanceSheet(this.balances.address, { from: owner })
            await this.token.setAllowanceSheet(this.allowances.address, { from: owner })

            await this.registry.setAttribute(oneHundred, "hasPassedKYC/AML", 1, notes, { from: owner })
            await this.token.mint(oneHundred, 100*10**18, { from: owner })
            await this.registry.setAttribute(oneHundred, "hasPassedKYC/AML", 0, notes, { from: owner })
        })

        describe('burn', function () {
            describe('user is on burn whitelist', function () {
                beforeEach(async function () {
                    await this.registry.setAttribute(oneHundred, "canBurn", 1, notes, { from: owner })
                })

                burnableTokenWithBoundsTests([owner, oneHundred, anotherAccount], true)
            })

            describe('user is not on burn whitelist', function () {
                it("reverts burn", async function () {
                    await this.token.setBurnBounds(10*10**18, 20*10**18, { from: owner })
                    await assertRevert(this.token.burn(15*10**18, "burn note",  { from: oneHundred }))
                })
            })


        })

        describe('round down burn amount', function () {

            it("burns 10.50", async function () {
                await this.registry.setAttribute(oneHundred, "canBurn", 1, notes, { from: owner })
                await this.token.setBurnBounds(10*10**18, 20*10**18, { from: owner })
                await this.token.burn(10.503*10**18, "burn note", { from: oneHundred })
                let remainingBalance = await this.token.balanceOf(oneHundred)
                assert.equal(remainingBalance, 89.5*10**18)
            })
        })


        describe('when there are no burn bounds', function () {
            beforeEach(async function () {
                await this.token.setBurnBounds(0, "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", { from: owner })
            })

            compliantTokenTests([owner, oneHundred, anotherAccount], true)
        })

        describe('when everyone is on the whitelists and there are no burn bounds', function () {
            beforeEach(async function () {
                await this.token.setBurnBounds(0, "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", { from: owner })
                await this.registry.setAttribute(owner, "hasPassedKYC/AML", 1, notes, { from: owner })
                await this.registry.setAttribute(oneHundred, "hasPassedKYC/AML", 1, notes, { from: owner })
                await this.registry.setAttribute(anotherAccount, "hasPassedKYC/AML", 1, notes, { from: owner })
                await this.registry.setAttribute(owner, "canBurn", 1, notes, { from: owner })
                await this.registry.setAttribute(oneHundred, "canBurn", 1, notes, { from: owner })
                await this.registry.setAttribute(anotherAccount, "canBurn", 1, notes, { from: owner })
            })

            tokenWithFeesTests([owner, oneHundred, anotherAccount], true)
        })

        it("old long interaction trace test", async function () {
            await assertRevert(this.token.mint(accounts[3], 10, { from: owner })) //user 3 is not (yet) on whitelist
            await assertRevert(this.registry.setAttribute(accounts[3], "hasPassedKYC/AML", 1, notes, { from: anotherAccount })) //anotherAccount is not the owner
            await this.registry.setAttribute(accounts[3], "hasPassedKYC/AML", 1, notes, { from: owner })
            const userHasCoins = async (id, amount) => {
                var balance = await this.token.balanceOf(accounts[id])
                assert.equal(balance, amount, "userHasCoins fail: actual balance " + balance)
            }
            await this.token.changeStakingFees(7, 10000, 0, 10000, 0, 0, 10000, 0, { from: owner })
            await userHasCoins(3, 0)
            await this.token.mint(accounts[3], 12345, { from: owner })
            await userHasCoins(3, 12345)
            await userHasCoins(1, 0)
            await this.token.transfer(accounts[4], 11000, { from: accounts[3] })
            await userHasCoins(3, 1345)
            await userHasCoins(4, 11000 - 7)
            await this.token.pause({ from: owner })
            await assertRevert(this.token.transfer(accounts[5], 9999, { from: accounts[4] }))
            await this.token.unpause({ from: owner })
            await assertRevert(this.token.delegateTransfer(accounts[5], 9999, accounts[4], { from: accounts[6] }))
            await this.token.setDelegatedFrom(accounts[6], { from: owner })
        })

        it("can change name", async function () {
            let name = await this.token.name()
            assert.equal(name, "TrueUSD")
            let symbol = await this.token.symbol()
            assert.equal(symbol, "TUSD")
            await this.token.changeTokenName("FooCoin", "FCN", { from: owner })
            name = await this.token.name()
            assert.equal(name, "FooCoin")
            symbol = await this.token.symbol()
            assert.equal(symbol, "FCN")
        })
    })

    describe('--TrueUSD Tests: chaining 2 contracts--', function () {
        const _ = accounts[0]
        const owners = [accounts[1], accounts[2]]
        const oneHundreds = [accounts[3], accounts[4]]
        const anotherAccounts = [accounts[5], accounts[6]]

        beforeEach(async function () {
            this.registries = []
            this.tokens = []

            for (let i = 0; i < 2; i++) {
                this.registries[i] = await Registry.new({ from: owners[i] })

                this.tokens[i] = await TrueUSDMock.new(oneHundreds[i], 100*10**18, { from: owners[i] })
                await this.tokens[i].setRegistry(this.registries[i].address, { from: owners[i] })
                await this.tokens[i].changeStakingFees(0, 10000, 0, 10000, 0, 0, 10000, 0, { from: owners[i] })        
            }
        })
        
        it('reclaim ether can not target a NoOwner', async function () {
            const forceEther = await ForceEther.new({ from: oneHundreds[0], value: 1000000000 })
            await forceEther.destroyAndSend(this.tokens[0].address)
            await expectThrow(this.tokens[0].reclaimEther(this.tokens[1].address, { from: owners[0] }))
        })

        describe('chaining two contracts', function () {
            beforeEach(async function () {
                await this.tokens[0].delegateToNewContract(this.tokens[1].address, { from: owners[0] })
                await this.tokens[1].setDelegatedFrom(this.tokens[0].address, { from: owners[1] })
            })

            describe('delegation disables', function () {
                beforeEach(async function () {
                    this.token = this.tokens[0]
                })

                it("setNoFeesList", async function () {
                    await assertRevert(this.token.setRegistry(this.registries[1].address, { from: owners[0] }))
                })

                it("mint", async function () {
                    await this.registries[0].setAttribute(anotherAccounts[0], "hasPassedKYC/AML", 1, notes, { from: owners[0] })
                    await assertRevert(this.token.mint(anotherAccounts[0], 100, { from: owners[0] }))
                })

                it("setBalanceSheet", async function () {
                    const sheet = await BalanceSheet.new({ from: owners[0] })
                    await sheet.transferOwnership(this.token.address, { from: owners[0] })
                    await assertRevert(this.token.setBalanceSheet(sheet.address, { from: owners[0] }))
                })

                it("setAllowanceSheet", async function () {
                    const sheet = await AllowanceSheet.new({ from: owners[0] })
                    await sheet.transferOwnership(this.token.address, { from: owners[0] })
                    await assertRevert(this.token.setBalanceSheet(sheet.address, { from: owners[0] }))
                })

                it("setBurnBounds", async function () {
                    await assertRevert(this.token.setBurnBounds(0, 1, { from: owners[0] }))
                })

                it("changeStaker", async function () {
                    await assertRevert(this.token.changeStaker(anotherAccounts[0], { from: owners[0] }))
                })

                it("wipeBlacklistedAccount", async function () {
                    await this.registries[0].setAttribute(anotherAccounts[0], "isBlacklisted", 1, notes, { from: owners[0] })
                    await assertRevert(this.token.wipeBlacklistedAccount(anotherAccounts[0], { from: owners[0] }))
                })

                it("changeStakingFees", async function () {
                    await assertRevert(this.token.changeStakingFees(1, 2, 3, 4, 5, 6, 7, 8, { from: owners[0] }))
                })
            })
        })

        // describe('Base contract behaves well', function () {
        //     beforeEach(async function () {
        //         this.token = this.tokens[0]
        //     })

        //     basicTokenTests([owners[1], oneHundreds[1], anotherAccounts[1]], true)
        //     standardTokenTests([owners[1], oneHundreds[1], anotherAccounts[1]])

        //     describe('burn', function () {
        //         beforeEach(async function () {
        //             await this.registries[1].setAttribute(oneHundreds[1], "canBurn", 1, notes, { from: owners[2] })
        //             await this.tokens[1].setBurnBounds(0, "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", { from: owners[2] })
        //         })

        //         burnableTokenTests([owners[1], oneHundreds[1], anotherAccounts[1]], true)
        //     })
        // })

        // describe('contract 1 behaves well', function () {
        //     beforeEach(async function () {
        //         this.token = this.tokens[1]
        //     })

        //     basicTokenTests([owners[1], oneHundreds[1], anotherAccounts[1]], true)
        //     standardTokenTests([owners[1], oneHundreds[1], anotherAccounts[1]])

        //     describe('burn', function () {
        //         beforeEach(async function () {
        //             await this.registries[1].setAttribute(oneHundreds[1], "canBurn", 1, notes, { from: owners[2] })
        //             await this.tokens[1].setBurnBounds(0, "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", { from: owners[2] })
        //         })

        //         burnableTokenTests([owners[1], oneHundreds[1], anotherAccounts[1]], true)
        //     })
        // })

    })

})
