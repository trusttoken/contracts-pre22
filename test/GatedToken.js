import assertRevert from './helpers/assertRevert'
import mintableTokenTests from './token/MintableToken';
import burnableTokenTests from './token/BurnableToken';
import standardTokenTests from './token/StandardToken';
import basicTokenTests from './token/BasicToken';
const AddressList = artifacts.require('AddressList')

function gatedTokenTests([owner, oneHundred, anotherAccount]) {
    describe('--GatedToken Tests--', function () {
        describe('setLists', function () {
            let mintWhiteList2, burnWhiteList2, blackList2

            beforeEach(async function () {
                mintWhiteList2 = await AddressList.new("Mint whitelist", { from: owner })
                burnWhiteList2 = await AddressList.new("Burn whitelist", { from: owner })
                blackList2 = await AddressList.new("Blacklist", { from: owner })
            })

            it('sets the lists', async function () {
                await this.token.setLists(mintWhiteList2.address, burnWhiteList2.address, blackList2.address, { from: owner })

                let list = await this.token.canReceiveMintWhiteList()
                assert.equal(list, mintWhiteList2.address)
                list = await this.token.canBurnWhiteList()
                assert.equal(list, burnWhiteList2.address)
                list = await this.token.blackList()
                assert.equal(list, blackList2.address)
            })

            it('emits an event', async function () {
                const { logs } = await this.token.setLists(mintWhiteList2.address, burnWhiteList2.address, blackList2.address, { from: owner })

                assert.equal(logs.length, 1)
                assert.equal(logs[0].event, 'SetLists')
                assert.equal(logs[0].args.mintList, mintWhiteList2.address)
                assert.equal(logs[0].args.burnList, burnWhiteList2.address)
                assert.equal(logs[0].args.blackList, blackList2.address)
            })

            it('cannot be called by non-owner', async function () {
                await assertRevert(this.token.setLists(mintWhiteList2.address, burnWhiteList2.address, blackList2.address, { from: anotherAccount }))
            })
        })

        describe('minting', function () {
            describe('when user is on mint whitelist', function () {
                beforeEach(async function () {
                    await this.mintWhiteList.changeList(anotherAccount, true, { from: owner })
                })

                mintableTokenTests([owner, oneHundred, anotherAccount])
            })

            it('rejects mint when user is not on mint whitelist', async function () {
                await assertRevert(this.token.mint(anotherAccount, 100, { from: owner }))
            })
        })

        describe('burning', function () {
            describe('when user is on burn whitelist', function () {
                beforeEach(async function () {
                    await this.burnWhiteList.changeList(oneHundred, true, { from: owner })
                })

                burnableTokenTests([owner, oneHundred, anotherAccount])

                it('rejects burn when user is on blacklist', async function () {
                    await this.blackList.changeList(oneHundred, true, { from: owner })
                    await assertRevert(this.token.burn(20, { from: oneHundred }))
                })
            })

            it('rejects burn when user is not on burn whitelist', async function () {
                await assertRevert(this.token.burn(20, { from: oneHundred }))
            })
        })

        describe('transferring', function () {
            describe('when user is not on blacklist', function () {
                basicTokenTests([owner, oneHundred, anotherAccount])
                standardTokenTests([owner, oneHundred, anotherAccount])
            })

            describe('when user is on blacklist', function () {
                it('rejects transfer from blacklisted account', async function () {
                    await this.blackList.changeList(oneHundred, true, { from: owner })
                    await assertRevert(this.token.transfer(anotherAccount, 100, { from: oneHundred }))
                })

                it('rejects transfer to blacklisted account', async function () {
                    await this.blackList.changeList(oneHundred, true, { from: owner })
                    await assertRevert(this.token.transfer(anotherAccount, 100, { from: oneHundred }))
                })

                it('rejects transferFrom to blacklisted account', async function () {
                    await this.blackList.changeList(oneHundred, true, { from: owner })
                    await this.token.approve(anotherAccount, 100, { from: oneHundred })
                    await assertRevert(this.token.transferFrom(oneHundred, owner, 100, { from: anotherAccount }))
                })

                it('rejects transferFrom by blacklisted spender', async function () {
                    await this.blackList.changeList(anotherAccount, true, { from: owner })
                    await this.token.approve(anotherAccount, 100, { from: oneHundred })
                    await assertRevert(this.token.transferFrom(oneHundred, owner, 100, { from: anotherAccount }))
                })
            })
        })

        describe('wipe account', function () {
            beforeEach(async function () {
                await this.blackList.changeList(oneHundred, true, { from: owner })
            })

            it('will not wipe non-blacklisted account', async function () {
                await this.blackList.changeList(oneHundred, false, { from: owner })
                await assertRevert(this.token.wipeBlacklistedAccount(oneHundred, { from: owner }))
            })

            it('sets balance to 0', async function () {
                await this.token.wipeBlacklistedAccount(oneHundred, { from: owner })
                const balance = await this.token.balanceOf(oneHundred)
                assert.equal(balance, 0)
            })

            it('emits an event', async function () {
                const { logs } = await this.token.wipeBlacklistedAccount(oneHundred, { from: owner })

                assert.equal(logs.length, 1)
                assert.equal(logs[0].event, 'WipeBlacklistedAccount')
                assert.equal(logs[0].args.account, oneHundred)
                assert.equal(logs[0].args.balance, 100)
            })

            it('cannot be called by non-owner', async function () {
                await assertRevert(this.token.wipeBlacklistedAccount(oneHundred, { from: anotherAccount }))
            })
        })
    })

}

export default gatedTokenTests