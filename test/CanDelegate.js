import assertRevert from './helpers/assertRevert'
import mintableTokenTests from './token/MintableToken';
import burnableTokenTests from './token/BurnableToken';
import standardTokenTests from './token/StandardToken';
import basicTokenTests from './token/BasicToken';

function canDelegateTests([owner, oneHundred, anotherAccount]) {
    describe('--CanDelegate Tests--', function () {
        describe('when not yet delegating', function () {
            mintableTokenTests([owner, oneHundred, anotherAccount])
            burnableTokenTests([owner, oneHundred, anotherAccount])
            basicTokenTests([owner, oneHundred, anotherAccount])
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
    })
}

export default canDelegateTests