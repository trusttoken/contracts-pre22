import assertRevert from '../helpers/assertRevert'

function basicTokenTests([owner, oneHundred, anotherAccount]) {
    describe('--BasicToken Tests--', function () {
        const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

        describe('total supply', function () {
            it('returns the total amount of tokens', async function () {
                const totalSupply = await this.token.totalSupply()

                assert.equal(totalSupply, 100)
            })
        })

        describe('balanceOf', function () {
            describe('when the requested account has no tokens', function () {
                it('returns zero', async function () {
                    const balance = await this.token.balanceOf(owner)

                    assert.equal(balance, 0)
                })
            })

            describe('when the requested account has some tokens', function () {
                it('returns the total amount of tokens', async function () {
                    const balance = await this.token.balanceOf(oneHundred)

                    assert.equal(balance, 100)
                })
            })
        })

        describe('transfer', function () {
            describe('when the anotherAccount is not the zero address', function () {
                const to = anotherAccount

                describe('when the sender does not have enough balance', function () {
                    const amount = 101

                    it('reverts', async function () {
                        await assertRevert(this.token.transfer(to, amount, { from: oneHundred }))
                    })
                })

                describe('when the sender has enough balance', function () {
                    const amount = 100

                    it('transfers the requested amount', async function () {
                        await this.token.transfer(to, amount, { from: oneHundred })

                        const senderBalance = await this.token.balanceOf(oneHundred)
                        assert.equal(senderBalance, 0)

                        const anotherAccountBalance = await this.token.balanceOf(to)
                        assert.equal(anotherAccountBalance, amount)
                    })

                    it('emits a transfer event', async function () {
                        const { logs } = await this.token.transfer(to, amount, { from: oneHundred })

                        assert.equal(logs.length, 1)
                        assert.equal(logs[0].event, 'Transfer')
                        assert.equal(logs[0].args.from, oneHundred)
                        assert.equal(logs[0].args.to, to)
                        assert(logs[0].args.value.eq(amount))
                    })
                })
            })

            describe('when the anotherAccount is the zero address', function () {
                const to = ZERO_ADDRESS

                it('reverts', async function () {
                    await assertRevert(this.token.transfer(to, 100, { from: oneHundred }))
                })
            })
        })
    })
}

export default basicTokenTests