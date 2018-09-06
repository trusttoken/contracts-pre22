import assertRevert from './helpers/assertRevert'
import assertBalance from './helpers/assertBalance'
import mintableTokenTests from './token/MintableToken';
import burnableTokenTests from './token/BurnableToken';
import standardTokenTests from './token/StandardToken';
import basicTokenTests from './token/BasicToken';
const Registry = artifacts.require('Registry')

function tokenWithFeesTests([owner, oneHundred, anotherAccount], transfersToZeroBecomeBurns) {
    describe('--TokenWithFees Tests--', function () {
        describe('fees are initially set to 0', function () {
            basicTokenTests([owner, oneHundred, anotherAccount], transfersToZeroBecomeBurns)
            standardTokenTests([owner, oneHundred, anotherAccount])
            burnableTokenTests([owner, oneHundred, anotherAccount], transfersToZeroBecomeBurns)
            mintableTokenTests([owner, oneHundred, anotherAccount])
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

            it('cannot set to address(0)', async function () {
                await assertRevert(this.token.changeStaker(0x0, { from: owner }))
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
            const amount = 48*10**18

            beforeEach(async function () {
                await this.token.changeStakingFees(2, 20, 2, 20, 5*10**18, 2, 20, 5*10**18, { from: owner })
            })

            it('burn', async function () {
                const fee = Math.floor(amount * 2 / 20) + 5*10**18
                await this.token.burn(amount, "burn note", { from: oneHundred })
                await assertBalance(this.token, oneHundred, 100*10**18 - amount)
                await assertBalance(this.token, owner, fee)
            })

            if (transfersToZeroBecomeBurns) {
                describe('transfers to 0x0 become burns', function () {
                    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
                    it('burn', async function () {
                        const fee = Math.floor(amount * 2 / 20) + 5*10**18
                        await this.token.transfer(ZERO_ADDRESS, amount, { from: oneHundred })
                        await assertBalance(this.token, oneHundred, 100*10**18 - amount)
                        await assertBalance(this.token, owner, fee)
                    })
                })
            }
            it ('check staking fees', async function(){
              const transferFee = Math.floor(amount * 2 / 20)
              const burnFee = Math.floor(amount * 2 / 20) + 5*10**18
              const mintFee = Math.floor(amount * 2 / 20) + 5*10**18
              let contractTransferFee = await this.token.checkTransferFee(amount,{ from: owner })
              let contractBurnFee = await this.token.checkBurnFee(amount,{ from: owner })
              let contractMintFee = await this.token.checkMintFee(amount,{ from: owner })
              assert.equal(contractTransferFee,transferFee)
              assert.equal(contractBurnFee,burnFee)
              assert.equal(contractMintFee,mintFee)
            })

            it('mint', async function () {
                const fee = Math.floor(amount * 2 / 20) + 5*10**18
                await this.token.mint(anotherAccount, amount, { from: owner })
                await assertBalance(this.token, anotherAccount, amount - fee)
                await assertBalance(this.token, owner, fee)
            })

            it('transfer', async function () {
                const fee = Math.floor(amount * 2 / 20)
                await this.token.transfer(anotherAccount, amount, { from: oneHundred })
                await assertBalance(this.token, oneHundred, 100*10**18 - amount)
                await assertBalance(this.token, owner, fee)
                await assertBalance(this.token, anotherAccount, amount - fee)
            })

            it('transfer to user with noFees property', async function () {
                await this.registry.setAttribute(anotherAccount, "noFees", 1, "some notes", { from: owner })
                await this.token.transfer(anotherAccount, amount, { from: oneHundred })
                await assertBalance(this.token, oneHundred, 100*10**18 - amount)
                await assertBalance(this.token, owner, 0)
                await assertBalance(this.token, anotherAccount, amount)
            })

            it('transfer from user with noFees property', async function () {
                await this.registry.setAttribute(oneHundred, "noFees", 1, "some notes", { from: owner })
                await this.token.transfer(anotherAccount, amount, { from: oneHundred })
                await assertBalance(this.token, oneHundred, 100*10**18 - amount)
                await assertBalance(this.token, owner, 0)
                await assertBalance(this.token, anotherAccount, amount)
            })

            it('transferFrom', async function () {
                const fee = Math.floor(amount * 2 / 20)
                await this.token.approve(anotherAccount, amount, { from: oneHundred })
                await this.token.transferFrom(oneHundred, anotherAccount, amount, { from: anotherAccount })
                await assertBalance(this.token, oneHundred, 100*10**18 - amount)
                await assertBalance(this.token, owner, fee)
                await assertBalance(this.token, anotherAccount, amount - fee)
            })
        })
    })
}

export default tokenWithFeesTests
