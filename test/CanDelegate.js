import assertRevert from './helpers/assertRevert'
import mintableTokenTests from './token/MintableToken';
import burnableTokenTests from './token/BurnableToken';
import standardTokenTests from './token/StandardToken';
import basicTokenTests from './token/BasicToken';
const FailingDelegate = artifacts.require('FailingDelegate')
const SucceedingDelegate = artifacts.require('SucceedingDelegate')

function canDelegateTests([owner, oneHundred, anotherAccount], transfersToZeroBecomeBurns) {
    describe('--CanDelegate Tests--', function () {
        describe('when not yet delegating', function () {
            mintableTokenTests([owner, oneHundred, anotherAccount])
            burnableTokenTests([owner, oneHundred, anotherAccount], transfersToZeroBecomeBurns)
            basicTokenTests([owner, oneHundred, anotherAccount], transfersToZeroBecomeBurns)
            standardTokenTests([owner, oneHundred, anotherAccount])
        })

        describe('delegateToNewContract', function () {
            it('sets delegate', async function () {
                await this.token.delegateToNewContract("0x1", { from: owner })

                const delegate = await this.token.delegate()
                assert.equal(delegate, 0x1)
            })

            it('emits an event', async function () {
                const { logs } = await this.token.delegateToNewContract("0x1", { from: owner })

                assert.equal(logs.length, 1)
                assert.equal(logs[0].event, 'DelegateToNewContract')
                assert.equal(logs[0].args.newContract, 0x1)
            })

            it('cannot be called by non-owner', async function () {
                await assertRevert(this.token.delegateToNewContract("0x1", { from: anotherAccount }))
            })
        })

        describe('delegating to token that always fails', function () {
            beforeEach(async function () {
                this.failToken = await FailingDelegate.new({ from: owner })
                await this.token.delegateToNewContract(this.failToken.address, { from: owner })
            })

            it('transfer', async function () {
                await assertRevert(this.token.transfer(oneHundred, 50*10**18, { from: anotherAccount }))
            })

            it('transferFrom', async function () {
                await assertRevert(this.token.transferFrom(oneHundred, oneHundred, 50*10**18, { from: anotherAccount }))
            })

            it('approve', async function () {
                await assertRevert(this.token.approve(oneHundred, 50*10**18, { from: anotherAccount }))
            })

            it('increaseApproval', async function () {
                await assertRevert(this.token.increaseApproval(oneHundred, 50*10**18, { from: anotherAccount }))
            })

            it('decreaseApproval', async function () {
                await assertRevert(this.token.decreaseApproval(oneHundred, 50*10**18, { from: anotherAccount }))
            })
        })

        describe('delegating to token that always succeeds', function () {
            beforeEach(async function () {
                this.passToken = await SucceedingDelegate.new({ from: owner })
                await this.token.delegateToNewContract(this.passToken.address, { from: owner })
            })

            it('transfer', async function () {
                await this.token.transfer(oneHundred, 50*10**18, { from: anotherAccount })
            })

            it('transferFrom', async function () {
                await this.token.transferFrom(oneHundred, oneHundred, 50*10**18, { from: anotherAccount })
            })

            it('approve', async function () {
                await this.token.approve(oneHundred, 50*10**18, { from: anotherAccount })
            })

            it('increaseApproval', async function () {
                await this.token.increaseApproval(oneHundred, 50*10**18, { from: anotherAccount })
            })

            it('decreaseApproval', async function () {
                await this.token.decreaseApproval(oneHundred, 50*10**18, { from: anotherAccount })
            })
        })
    })
}

export default canDelegateTests
