import assertRevert from '../helpers/assertRevert'

function burnableTokenTests([owner, oneHundred, anotherAccount], transfersToZeroBecomeBurns = false) {
    describe('--BurnableToken Tests--', function () {
        const from = oneHundred
        const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

        describe('when the given amount is not greater than balance of the sender', function () {
            const amount = 10*10**18

            it('burns the requested amount', async function () {
                await this.token.burn(amount, { from })

                const balance = await this.token.balanceOf.call(from)
                assert.equal(balance, 90*10**18)
            })

            it('emits a burn event', async function () {
                const { logs } = await this.token.burn(amount, { from })
                assert.equal(logs.length, 2)
                assert.equal(logs[0].event, 'Burn')
                assert.equal(logs[0].args.burner, oneHundred)
                assert.equal(logs[0].args.value, amount)

                assert.equal(logs[1].event, 'Transfer')
                assert.equal(logs[1].args.from, oneHundred)
                assert.equal(logs[1].args.to, ZERO_ADDRESS)
                assert.equal(logs[1].args.value, amount)
            })
        })

        describe('when the given amount is greater than the balance of the sender', function () {
            const amount = 101*10**18
            it('reverts', async function () {
                await assertRevert(this.token.burn(amount, { from }))
            })
        })



        if(transfersToZeroBecomeBurns) {
            describe('transfers to 0x0 become burns', function () {
                describe('when the given amount is not greater than balance of the sender', function () {
                    const amount = 10*10**18

                    it('burns the requested amount', async function () {
                        await this.token.transfer(ZERO_ADDRESS, amount, { from })

                        const balance = await this.token.balanceOf.call(from)
                        assert.equal(balance, 90*10**18)
                    })

                    it('emits a burn event', async function () {
                        const { logs } = await this.token.transfer(ZERO_ADDRESS, amount, { from })
                        assert.equal(logs.length, 2)
                        assert.equal(logs[0].event, 'Burn')
                        assert.equal(logs[0].args.burner, oneHundred)
                        assert.equal(logs[0].args.value, amount)

                        assert.equal(logs[1].event, 'Transfer')
                        assert.equal(logs[1].args.from, oneHundred)
                        assert.equal(logs[1].args.to, ZERO_ADDRESS)
                        assert.equal(logs[1].args.value, amount)
                    })
                })

                describe('when the given amount is greater than the balance of the sender', function () {
                    const amount = 101*10**18

                    it('reverts', async function () {
                        await assertRevert(this.token.transfer(ZERO_ADDRESS, amount, { from }))
                    })
                })
            })
        }
    })
}

export default burnableTokenTests
