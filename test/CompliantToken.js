import assertRevert from './helpers/assertRevert'
import mintableTokenTests from './token/MintableToken';
import burnableTokenTests from './token/BurnableToken';
import standardTokenTests from './token/StandardToken';
import basicTokenTests from './token/BasicToken';
const Registry = artifacts.require('Registry')

function compliantTokenTests([owner, oneHundred, anotherAccount], transfersToZeroBecomeBurns = false) {
    describe('--CompliantToken Tests--', function () {
        const notes = "some notes"

        describe('minting', function () {
            describe('when user is on mint whitelist', function () {
                beforeEach(async function () {
                    await this.registry.setAttribute(anotherAccount, "hasPassedKYC/AML", 1, notes, { from: owner })
                })

                mintableTokenTests([owner, oneHundred, anotherAccount])
            })

            it('rejects mint when user is not on mint whitelist', async function () {
                await assertRevert(this.token.mint(anotherAccount, 100*10**18, { from: owner }))
            })

            it('rejects mint when user is blacklisted', async function () {
                await this.registry.setAttribute(anotherAccount, "hasPassedKYC/AML", 1, notes, { from: owner })
                await this.registry.setAttribute(anotherAccount, "isBlacklisted", 1, notes, { from: owner })
                await assertRevert(this.token.mint(anotherAccount, 100*10**18, { from: owner }))
            })
        })

        describe('burning', function () {
            describe('when user is on burn whitelist', function () {
                beforeEach(async function () {
                    await this.registry.setAttribute(oneHundred, "canBurn", 1, notes, { from: owner })
                })

                burnableTokenTests([owner, oneHundred, anotherAccount], transfersToZeroBecomeBurns)

                it('rejects burn when user is on blacklist', async function () {
                    await this.registry.setAttribute(oneHundred, "isBlacklisted", 1, notes, { from: owner })
                    await assertRevert(this.token.burn(20*10**18, { from: oneHundred }))
                })
            })

            it('rejects burn when user is not on burn whitelist', async function () {
                await assertRevert(this.token.burn(20*10**18, { from: oneHundred }))
            })
        })

        if (transfersToZeroBecomeBurns) {
            describe('transfers to 0x0 become burns', function () {
                const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
                describe('burning', function () {
                    describe('when user is on burn whitelist', function () {
                        beforeEach(async function () {
                            await this.registry.setAttribute(oneHundred, "canBurn", 1, notes, { from: owner })
                        })

                        burnableTokenTests([owner, oneHundred, anotherAccount], transfersToZeroBecomeBurns)

                        it('rejects burn when user is on blacklist', async function () {
                            await this.registry.setAttribute(oneHundred, "isBlacklisted", 1, notes, { from: owner })
                            await assertRevert(this.token.transfer(ZERO_ADDRESS, 20*10**18, { from: oneHundred }))
                        })
                    })

                    it('rejects burn when user is not on burn whitelist', async function () {
                        await assertRevert(this.token.transfer(ZERO_ADDRESS, 20*10**18, { from: oneHundred }))
                    })
                })
            })
        }

        describe('transferring', function () {
            describe('when user is not on blacklist', function () {
                basicTokenTests([owner, oneHundred, anotherAccount], transfersToZeroBecomeBurns)
                standardTokenTests([owner, oneHundred, anotherAccount])
            })

            describe('when user is on blacklist', function () {
                it('rejects transfer from blacklisted account', async function () {
                    await this.registry.setAttribute(oneHundred, "isBlacklisted", 1, notes, { from: owner })
                    await assertRevert(this.token.transfer(anotherAccount, 100*10**18, { from: oneHundred }))
                })

                it('rejects transfer to blacklisted account', async function () {
                    await this.registry.setAttribute(anotherAccount, "isBlacklisted", 1, notes, { from: owner })
                    await assertRevert(this.token.transfer(anotherAccount, 100*10**18, { from: oneHundred }))
                })

                it('rejects transferFrom to blacklisted account', async function () {
                    await this.registry.setAttribute(oneHundred, "isBlacklisted", 1, notes, { from: owner })
                    await this.token.approve(anotherAccount, 100*10**18, { from: oneHundred })
                    await assertRevert(this.token.transferFrom(oneHundred, owner, 100*10**18, { from: anotherAccount }))
                })

                it('rejects transferFrom by blacklisted spender', async function () {
                    await this.registry.setAttribute(anotherAccount, "isBlacklisted", 1, notes, { from: owner })
                    await this.token.approve(anotherAccount, 100*10**18, { from: oneHundred })
                    await assertRevert(this.token.transferFrom(oneHundred, owner, 100*10**18, { from: anotherAccount }))
                })
            })
        })

        describe('CanWriteTo-', function (){
            beforeEach(async function () {
                const canWriteToKYCAttribute = await this.registry.writeAttributeFor.call("hasPassedKYC/AML")
                await this.registry.setAttribute(oneHundred, canWriteToKYCAttribute, 1, notes, { from: owner })
            })

            it('address other than the owner can write attribute if they have canWrite access', async function(){
                await this.registry.setAttribute(anotherAccount, "hasPassedKYC/AML", 1, notes, { from: oneHundred })
            })
        })

        describe('wipe account', function () {
            beforeEach(async function () {
                await this.registry.setAttribute(oneHundred, "isBlacklisted", 1, notes, { from: owner })
            })

            it('will not wipe non-blacklisted account', async function () {
                await this.registry.setAttribute(oneHundred, "isBlacklisted", 0, notes, { from: owner })
                await assertRevert(this.token.wipeBlacklistedAccount(oneHundred, { from: owner }))
            })

            it('sets balance to 0', async function () {
                await this.token.wipeBlacklistedAccount(oneHundred, { from: owner })
                const balance = await this.token.balanceOf.call(oneHundred)
                assert.equal(balance, 0)
            })

            it('emits events', async function () {
                const { logs } = await this.token.wipeBlacklistedAccount(oneHundred, { from: owner })

                assert.equal(logs.length, 2)
                assert.equal(logs[0].event, 'WipeBlacklistedAccount')
                assert.equal(logs[0].args.account, oneHundred)
                assert.equal(logs[0].args.balance, 100*10**18)
                assert.equal(logs[1].event, 'Transfer')
                assert.equal(logs[1].args.value, 100*10**18)
                assert.equal(logs[1].args.to, 0)
                assert.equal(logs[1].args.from, oneHundred)
            })

            it('cannot be called by non-owner', async function () {
                await assertRevert(this.token.wipeBlacklistedAccount(oneHundred, { from: anotherAccount }))
            })
        })
    })

}

export default compliantTokenTests
