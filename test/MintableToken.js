import assertRevert from './helpers/assertRevert'
import assertBalance from './helpers/assertBalance'

const BN = web3.utils.toBN;

function mintableTokenTests([owner, oneHundred, anotherAccount]) {
    describe('-MintableToken Tests-', function () {
        const amount = BN(100*10**18)

        describe('when the sender is the token owner', function () {
            const from = owner
            const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

            it('mints the requested amount', async function () {
                await this.mintableToken.mint(anotherAccount, amount, { from })

                await assertBalance(this.token, anotherAccount, amount);
            })

            it('cannot mint to 0x0', async function () {
                await assertRevert(this.mintableToken.mint(ZERO_ADDRESS, amount, { from }))
            })

            it('emits a mint finished event', async function () {
                const { logs } = await this.mintableToken.mint(anotherAccount, amount, { from })

                assert.equal(logs.length, 2)
                assert.equal(logs[0].event, 'Mint')
                assert.equal(logs[0].args.to, anotherAccount)
                assert(logs[0].args.value.eq(amount))
                assert.equal(logs[1].event, 'Transfer')
            })
        })

        describe('when the sender is not the token owner', function () {
            const from = anotherAccount

            it('reverts', async function () {
                await assertRevert(this.mintableToken.mint(anotherAccount, amount, { from }))
            })
        })
    })
}

export default mintableTokenTests
