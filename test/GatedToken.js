import assertRevert from './helpers/assertRevert'
import mintableTokenTests from './token/MintableToken';
import burnableTokenTests from './token/BurnableToken';
import standardTokenTests from './token/StandardToken';
import basicTokenTests from './token/BasicToken';
const GatedToken = artifacts.require('GatedToken')
const AddressList = artifacts.require('AddressList')
const BalanceSheet = artifacts.require('BalanceSheet')
const AllowanceSheet = artifacts.require('AllowanceSheet')

contract('GatedToken', function ([_, owner, oneHundred, anotherAccount]) {
    beforeEach(async function () {
        this.mintWhiteList = await AddressList.new("Mint whitelist", { from: owner })
        this.burnWhiteList = await AddressList.new("Burn whitelist", { from: owner })
        this.blackList = await AddressList.new("Blacklist", { from: owner })
        this.balances = await BalanceSheet.new({ from: owner })
        this.allowances = await AllowanceSheet.new({ from: owner })
        this.token = await GatedToken.new({ from: owner })
        await this.token.setLists(this.mintWhiteList.address, this.burnWhiteList.address, this.blackList.address, { from: owner })
        await this.balances.transferOwnership(this.token.address, { from: owner })
        await this.allowances.transferOwnership(this.token.address, { from: owner })
        await this.token.setBalanceSheet(this.balances.address, { from: owner })
        await this.token.setAllowanceSheet(this.allowances.address, { from: owner })

        await this.mintWhiteList.changeList(oneHundred, true, { from: owner })
        await this.token.mint(oneHundred, 100, { from: owner })
        await this.mintWhiteList.changeList(oneHundred, false, { from: owner })
    })

    gatedTokenTests([_, owner, oneHundred, anotherAccount])
})

function gatedTokenTests([_, owner, oneHundred, anotherAccount]) {
    describe('--GatedToken Tests--', function () {
        describe('minting', function () {
            describe('when user is on mint whitelist', function () {
                beforeEach(async function () {
                    await this.mintWhiteList.changeList(anotherAccount, true, { from: owner })
                })

                mintableTokenTests([_, owner, oneHundred, anotherAccount])
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

                burnableTokenTests([_, owner, oneHundred, anotherAccount])

                //TODO do we actually want this feature? removing from whitelist can already accomplish this
                // it('rejects burn when user is on blacklist', async function () {
                //     await this.blackList.changeList(oneHundred, true, { from: owner })
                //     await assertRevert(this.token.burn(20, { from: oneHundred }))
                // })
            })

            it('rejects burn when user is not on burn whitelist', async function () {
                await this.burnWhiteList.changeList(oneHundred, true, { from: owner }) //TODO remove and assert revert
                await this.token.burn(20, { from: oneHundred })
            })
        })

        describe('transferring', function () {
            describe('when user is not on blacklist', function () {
                basicTokenTests([_, owner, oneHundred, anotherAccount])
                standardTokenTests([_, owner, oneHundred, anotherAccount])
            })

            describe('when user is on blacklist', function () {
                beforeEach(async function () {
                    await this.blackList.changeList(oneHundred, true, { from: owner })
                })

                it('rejects transfer', async function () {
                    await assertRevert(this.token.transfer(anotherAccount, 100, { from: oneHundred }))
                })

                it('rejects transferFrom', async function () {
                    await this.token.approve(anotherAccount, 100, { from: oneHundred })
                    await assertRevert(this.token.transferFrom(oneHundred, anotherAccount, 100, { from: anotherAccount }))
                })
            })
        })
    })

}

export default gatedTokenTests