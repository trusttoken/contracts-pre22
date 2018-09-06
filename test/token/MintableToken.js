import assertRevert from '../helpers/assertRevert'

function mintableTokenTests([owner, oneHundred, anotherAccount]) {
    describe('-MintableToken Tests-', function () {
        const amount = 100*10**18

        describe('when the sender is the token owner', function () {
            const from = owner

            it('mints the requested amount', async function () {
                await this.token.mint(anotherAccount, amount, { from })

                const balance = await this.token.balanceOf(anotherAccount)
                assert.equal(balance, amount)
            })

            it('emits a mint finished event', async function () {
                const { logs } = await this.token.mint(anotherAccount, amount, { from })

                assert.equal(logs.length, 2)
                assert.equal(logs[0].event, 'Mint')
                assert.equal(logs[0].args.to, anotherAccount)
                assert.equal(logs[0].args.value, amount)
                assert.equal(logs[1].event, 'Transfer')
            })
        })

        describe('when the sender is not the token owner', function () {
            const from = anotherAccount

            it('reverts', async function () {
                await assertRevert(this.token.mint(anotherAccount, amount, { from }))
            })
        })
    })
}

export default mintableTokenTests
