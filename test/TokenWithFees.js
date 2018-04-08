import assertRevert from './helpers/assertRevert'
import mintableTokenTests from './token/MintableToken';
import burnableTokenTests from './token/BurnableToken';
import standardTokenTests from './token/StandardToken';
import basicTokenTests from './token/BasicToken';
const AddressList = artifacts.require('AddressList')

function tokenWithFeesTests([_, owner, oneHundred, anotherAccount]) {
    describe('--TokenWithFees Tests--', function () {
        describe('fees are initially set to 0', function () {
            basicTokenTests([_, owner, oneHundred, anotherAccount])
            standardTokenTests([_, owner, oneHundred, anotherAccount])
            burnableTokenTests([_, owner, oneHundred, anotherAccount])
            mintableTokenTests([_, owner, oneHundred, anotherAccount])
        })

        it('staker is originally owner', async function () {
            const staker = await this.token.staker()
            assert.equal(staker, owner)
        })

        describe('changeStaker', function () {
            it('changes staker', async function () {
                await this.token.changeStaker(anotherAccount, { from: owner })
                const staker = await this.token.staker()
                assert.equal(staker, anotherAccount)
            })

            it('emits an event', async function () {
                const { logs } = await this.token.changeStaker(anotherAccount, { from: owner })

                assert.equal(logs.length, 1)
                assert.equal(logs[0].event, 'ChangeStaker')
                assert.equal(logs[0].args.addr, anotherAccount)
            })

            it('cannot be called by non-owner', async function () {
                await assertRevert(this.token.changeStaker(anotherAccount, { from: anotherAccount }))
            })
        })

        describe('changeStakingFees', function () {
            it('changes fees', async function () {
                await this.token.changeStakingFees(1, 2, 3, 4, 5, 6, 7, 8, { from: owner })
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

            it('cannot set denominators to 0', async function () {
                await this.token.changeStakingFees(1, 2, 3, 4, 5, 6, 7, 8, { from: owner })
                await assertRevert(this.token.changeStakingFees(1, 0, 3, 4, 5, 6, 7, 8, { from: owner }))
                await assertRevert(this.token.changeStakingFees(1, 2, 3, 0, 5, 6, 7, 8, { from: owner }))
                await assertRevert(this.token.changeStakingFees(1, 2, 3, 4, 5, 6, 0, 8, { from: owner }))
            })

            it('cannot set fees to 100% or greater', async function () {
                await this.token.changeStakingFees(1, 2, 3, 4, 5, 6, 7, 8, { from: owner })
                await assertRevert(this.token.changeStakingFees(2, 2, 3, 4, 5, 6, 7, 8, { from: owner }))
                await assertRevert(this.token.changeStakingFees(1, 2, 4, 4, 5, 6, 7, 8, { from: owner }))
                await assertRevert(this.token.changeStakingFees(1, 2, 3, 4, 5, 7, 7, 8, { from: owner }))
            })

            it('emits an event', async function () {
                const { logs } = await this.token.changeStakingFees(1, 2, 3, 4, 5, 6, 7, 8, { from: owner })

                assert.equal(logs.length, 1)
                assert.equal(logs[0].event, 'ChangeStakingFees')
                assert.equal(logs[0].args.transferFeeNumerator, 1)
                assert.equal(logs[0].args.transferFeeDenominator, 2)
                assert.equal(logs[0].args.mintFeeNumerator, 3)
                assert.equal(logs[0].args.mintFeeDenominator, 4)
                assert.equal(logs[0].args.mintFeeFlat, 5)
                assert.equal(logs[0].args.burnFeeNumerator, 6)
                assert.equal(logs[0].args.burnFeeDenominator, 7)
                assert.equal(logs[0].args.burnFeeFlat, 8)
            })

            it('cannot be called by non-owner', async function () {
                await assertRevert(this.token.changeStakingFees(1, 2, 3, 4, 5, 6, 7, 8, { from: anotherAccount }))
            })
        })

        describe('fees are non-zero', function () {
            const amount = 48

            beforeEach(async function () {
                await this.token.changeStakingFees(2, 20, 2, 20, 5, 2, 20, 5, { from: owner })
            })

            it('burn', async function () {
                const fee = Math.floor(amount * 2 / 20) + 5
                await this.token.burn(amount, { from: oneHundred })
                let balance = await this.token.balanceOf(oneHundred)
                assert.equal(balance, 100 - amount)
                balance = await this.token.balanceOf(owner)
                assert.equal(balance, fee)
            })

            it('mint', async function () {
                const fee = Math.floor(amount * 2 / 20) + 5
                await this.token.mint(anotherAccount, amount, { from: owner })
                let balance = await this.token.balanceOf(anotherAccount)
                assert.equal(balance, amount - fee)
                balance = await this.token.balanceOf(owner)
                assert.equal(balance, fee)
            })

            it('transfer', async function () {
                const fee = Math.floor(amount * 2 / 20)
                await this.token.transfer(anotherAccount, amount, { from: oneHundred })
                let balance = await this.token.balanceOf(oneHundred)
                assert.equal(balance, 100 - amount)
                balance = await this.token.balanceOf(owner)
                assert.equal(balance, fee)
                balance = await this.token.balanceOf(anotherAccount)
                assert.equal(balance, amount - fee)
            })

            it('transferFrom', async function () {
                const fee = Math.floor(amount * 2 / 20)
                await this.token.approve(anotherAccount, amount, { from: oneHundred })
                await this.token.transferFrom(oneHundred, anotherAccount, amount, { from: anotherAccount })
                let balance = await this.token.balanceOf(oneHundred)
                assert.equal(balance, 100 - amount)
                balance = await this.token.balanceOf(owner)
                assert.equal(balance, fee)
                balance = await this.token.balanceOf(anotherAccount)
                assert.equal(balance, amount - fee)
            })
        })

        describe('setNoFeesList', function () {
            let newList

            beforeEach(async function () {
                newList = await AddressList.new("new", { from: owner })
            })

            it('sets the list', async function () {
                await this.token.setNoFeesList(newList.address, { from: owner })

                const list = await this.token.noFeesList()
                assert.equal(list, newList.address)
            })

            it('emits an event', async function () {
                const { logs } = await this.token.setNoFeesList(newList.address, { from: owner })

                assert.equal(logs.length, 1)
                assert.equal(logs[0].event, 'SetNoFeesList')
                assert.equal(logs[0].args.list, newList.address)
            })

            it('cannot be called by non-owner', async function () {
                await assertRevert(this.token.setNoFeesList(newList.address, { from: anotherAccount }))
            })
        })
    })
}

export default tokenWithFeesTests