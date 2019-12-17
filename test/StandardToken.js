import assertRevert from './helpers/assertRevert'
import assertBalance from './helpers/assertBalance'

const BN = web3.utils.toBN;
const INFINITE_AMOUNT = BN('ff00000000000000000000000000000000000000000000000000000000000000')

function standardTokenTests([owner, oneHundred, anotherAccount]) {
    describe('--StandardToken Tests--', function () {
        const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

        describe('approve', function () {
            describe('when the spender is not the zero address', function () {
                const spender = anotherAccount

                describe('when the sender has enough balance', function () {
                    const amount = BN(100*10**18)

                    it('emits an approval event', async function () {
                        const { logs } = await this.token.approve(spender, amount, { from: oneHundred })

                        assert.equal(logs.length, 1)
                        assert.equal(logs[0].event, 'Approval')
                        assert.equal(logs[0].args.owner, oneHundred)
                        assert.equal(logs[0].args.spender, spender)
                        assert(logs[0].args.value.eq(amount))
                    })

                    describe('when there was no approved amount before', function () {
                        it('approves the requested amount', async function () {
                            await this.token.approve(spender, amount, { from: oneHundred })

                            const allowance = await this.token.allowance.call(oneHundred, spender)
                            assert(allowance.eq(amount))
                        })
                    })

                    describe('when the spender had an approved amount', function () {
                        beforeEach(async function () {
                            await this.token.approve(spender, BN(1*10**18), { from: oneHundred })
                        })

                        it('approves the requested amount and replaces the previous one', async function () {
                            await this.token.approve(spender, amount, { from: oneHundred })

                            const allowance = await this.token.allowance.call(oneHundred, spender)
                            assert(allowance.eq(amount))
                        })
                    })
                })

                describe('when the sender does not have enough balance', function () {
                    const amount = BN(101*10**18)

                    it('emits an approval event', async function () {
                        const { logs } = await this.token.approve(spender, amount, { from: oneHundred })

                        assert.equal(logs.length, 1)
                        assert.equal(logs[0].event, 'Approval')
                        assert.equal(logs[0].args.owner, oneHundred)
                        assert.equal(logs[0].args.spender, spender)
                        assert(logs[0].args.value.eq(amount))
                    })

                    describe('when there was no approved amount before', function () {
                        it('approves the requested amount', async function () {
                            await this.token.approve(spender, amount, { from: oneHundred })

                            const allowance = await this.token.allowance.call(oneHundred, spender)
                            assert(allowance.eq(amount))
                        })
                    })

                    describe('when the spender had an approved amount', function () {
                        beforeEach(async function () {
                            await this.token.approve(spender, BN(1*10**18), { from: oneHundred })
                        })

                        it('approves the requested amount and replaces the previous one', async function () {
                            await this.token.approve(spender, amount, { from: oneHundred })

                            const allowance = await this.token.allowance.call(oneHundred, spender)
                            assert(allowance.eq(amount))
                        })
                    })
                })
            })

            describe('when the spender is the zero address', function () {
                const amount = BN(100*10**18)
                const spender = ZERO_ADDRESS

                it('approves the requested amount', async function () {
                    await this.token.approve(spender, amount, { from: oneHundred })

                    const allowance = await this.token.allowance.call(oneHundred, spender)
                    assert(allowance.eq(amount))
                })

                it('emits an approval event', async function () {
                    const { logs } = await this.token.approve(spender, amount, { from: oneHundred })

                    assert.equal(logs.length, 1)
                    assert.equal(logs[0].event, 'Approval')
                    assert.equal(logs[0].args.owner, oneHundred)
                    assert.equal(logs[0].args.spender, spender)
                    assert(logs[0].args.value.eq(amount))
                })
            })
        })

        describe('transfer from', function () {
            const spender = anotherAccount

            describe('when the anotherAccount is not the zero address', function () {
                const to = owner

                describe('when the spender has enough approved balance', function () {
                    beforeEach(async function () {
                        await this.token.approve(spender, BN(100*10**18), { from: oneHundred })
                    })

                    describe('when the oneHundred has enough balance', function () {
                        const amount = BN(100*10**18)

                        it('transfers the requested amount', async function () {
                            await this.token.transferFrom(oneHundred, to, amount, { from: spender })
                            await assertBalance(this.token, oneHundred, 0)
                            await assertBalance(this.token, to, amount)
                        })

                        it('decreases the spender allowance', async function () {
                            await this.token.transferFrom(oneHundred, to, amount, { from: spender })

                            const allowance = await this.token.allowance.call(oneHundred, spender)
                            assert(allowance.eq(BN(0)), `${allowance} should equal 0`)
                        })

                        it('emits a transfer event', async function () {
                            const { logs } = await this.token.transferFrom(oneHundred, to, amount, { from: spender })

                            assert.equal(logs.length, 1)
                            assert.equal(logs[0].event, 'Transfer')
                            assert.equal(logs[0].args.from, oneHundred)
                            assert.equal(logs[0].args.to, to)
                            assert(logs[0].args.value.eq(amount))
                        })
                    })

                    describe('when the spender had infinite approval', function() {
                        const amount = BN(100*10**18)

                        beforeEach(async function() {
                            await this.token.approve(spender, INFINITE_AMOUNT, { from: oneHundred });
                        })

                        it('does not decrease allowance', async function() {
                            const { logs } = await this.token.transferFrom(oneHundred, to, amount, { from: spender })
                            const allowance = await this.token.allowance.call(oneHundred, spender)
                            assert(allowance.eq(INFINITE_AMOUNT))
                            const balance = await this.token.balanceOf(to)
                            assert(amount.eq(balance))
                        })
                    })

                    describe('when the oneHundred does not have enough balance', function () {
                        const amount = BN(101*10**18)

                        it('reverts', async function () {
                            await assertRevert(this.token.transferFrom(oneHundred, to, amount, { from: spender }))
                        })
                    })
                })

                describe('when the spender does not have enough approved balance', function () {
                    beforeEach(async function () {
                        await this.token.approve(spender, BN(99*10**18), { from: oneHundred })
                    })

                    describe('when the oneHundred has enough balance', function () {
                        const amount = BN(100*10**18)

                        it('reverts', async function () {
                            await assertRevert(this.token.transferFrom(oneHundred, to, amount, { from: spender }))
                        })
                    })

                    describe('when the oneHundred does not have enough balance', function () {
                        const amount = BN(101*10**18)

                        it('reverts', async function () {
                            await assertRevert(this.token.transferFrom(oneHundred, to, amount, { from: spender }))
                        })
                    })
                })
            })
        })

        describe('decrease approval', function () {
            describe('when the spender is not the zero address', function () {
                const spender = anotherAccount

                describe('when the sender has enough balance', function () {
                    const amount = BN(100*10**18)

                    it('emits an approval event', async function () {
                        const { logs } = await this.token.decreaseAllowance(spender, amount, { from: oneHundred })

                        assert.equal(logs.length, 1)
                        assert.equal(logs[0].event, 'Approval')
                        assert.equal(logs[0].args.owner, oneHundred)
                        assert.equal(logs[0].args.spender, spender)
                        assert(logs[0].args.value.eq(BN(0)), `${logs[0].args.value} should equal 0`)
                    })

                    describe('when there was no approved amount before', function () {
                        it('keeps the allowance to zero', async function () {
                            await this.token.decreaseAllowance(spender, amount, { from: oneHundred })

                            const allowance = await this.token.allowance.call(oneHundred, spender)
                            assert(allowance.eq(BN(0)), `${allowance} should equal 0`)
                        })
                    })

                    describe('when the spender had an approved amount', function () {
                        beforeEach(async function () {
                            await this.token.approve(spender, amount.add(BN(1*10**18)), { from: oneHundred })
                        })

                        it('decreases the spender allowance subtracting the requested amount', async function () {
                            await this.token.decreaseAllowance(spender, amount, { from: oneHundred })

                            const allowance = await this.token.allowance.call(oneHundred, spender)
                            assert(allowance.eq(BN(1*10**18)), `${allowance} should equal 1e18`)
                        })
                    })
                })

                describe('when the sender does not have enough balance', function () {
                    const amount = BN(101*10**18)

                    it('emits an approval event', async function () {
                        const { logs } = await this.token.decreaseAllowance(spender, amount, { from: oneHundred })

                        assert.equal(logs.length, 1)
                        assert.equal(logs[0].event, 'Approval')
                        assert.equal(logs[0].args.owner, oneHundred)
                        assert.equal(logs[0].args.spender, spender)
                        assert(logs[0].args.value.eq(BN(0)))
                    })

                    describe('when there was no approved amount before', function () {
                        it('keeps the allowance to zero', async function () {
                            await this.token.decreaseAllowance(spender, amount, { from: oneHundred })

                            const allowance = await this.token.allowance.call(oneHundred, spender)
                            assert(allowance.eq(BN(0)), `${allowance} should equal 0`)
                        })
                    })

                    describe('when the spender had an approved amount', function () {
                        beforeEach(async function () {
                            await this.token.approve(spender, BN(amount).add(BN(1*10**18)), { from: oneHundred })
                        })

                        it('decreases the spender allowance subtracting the requested amount', async function () {
                            await this.token.decreaseAllowance(spender, amount, { from: oneHundred })

                            const allowance = await this.token.allowance.call(oneHundred, spender)
                            assert(allowance.eq(BN(1*10**18)), `${allowance} should equal 1e18`)
                        })
                    })
                })
            })

            describe('when the spender is the zero address', function () {
                const amount = BN(100*10**18)
                const spender = ZERO_ADDRESS

                it('decreases the requested amount', async function () {
                    await this.token.decreaseAllowance(spender, amount, { from: oneHundred })

                    const allowance = await this.token.allowance.call(oneHundred, spender)
                    assert(allowance.eq(BN(0)))
                })

                it('emits an approval event', async function () {
                    const { logs } = await this.token.decreaseAllowance(spender, amount, { from: oneHundred })

                    assert.equal(logs.length, 1)
                    assert.equal(logs[0].event, 'Approval')
                    assert.equal(logs[0].args.owner, oneHundred)
                    assert.equal(logs[0].args.spender, spender)
                    assert(logs[0].args.value.eq(BN(0)))
                })
            })
        })

        describe('increase approval', function () {
            const amount = BN(100*10**18)

            describe('when the spender is not the zero address', function () {
                const spender = anotherAccount

                describe('when the sender has enough balance', function () {
                    it('emits an approval event', async function () {
                        const { logs } = await this.token.increaseAllowance(spender, amount, { from: oneHundred })

                        assert.equal(logs.length, 1)
                        assert.equal(logs[0].event, 'Approval')
                        assert.equal(logs[0].args.owner, oneHundred)
                        assert.equal(logs[0].args.spender, spender)
                        assert(logs[0].args.value.eq(amount))
                    })

                    describe('when there was no approved amount before', function () {
                        it('approves the requested amount', async function () {
                            await this.token.increaseAllowance(spender, amount, { from: oneHundred })

                            const allowance = await this.token.allowance.call(oneHundred, spender)
                            assert(allowance.eq(amount))
                        })
                    })

                    describe('when the spender had an approved amount', function () {
                        beforeEach(async function () {
                            await this.token.approve(spender, BN(1*10**18), { from: oneHundred })
                        })

                        it('increases the spender allowance adding the requested amount', async function () {
                            await this.token.increaseAllowance(spender, amount, { from: oneHundred })

                            const allowance = await this.token.allowance.call(oneHundred, spender)
                            assert(allowance, BN(amount).add(BN(1*10**18)))
                        })
                    })
                })

                describe('when the sender does not have enough balance', function () {
                    const amount = BN(101*10**18)

                    it('emits an approval event', async function () {
                        const { logs } = await this.token.increaseAllowance(spender, amount, { from: oneHundred })

                        assert.equal(logs.length, 1)
                        assert.equal(logs[0].event, 'Approval')
                        assert.equal(logs[0].args.owner, oneHundred)
                        assert.equal(logs[0].args.spender, spender)
                        assert(logs[0].args.value.eq(amount))
                    })

                    describe('when there was no approved amount before', function () {
                        it('approves the requested amount', async function () {
                            await this.token.increaseAllowance(spender, amount, { from: oneHundred })

                            const allowance = await this.token.allowance.call(oneHundred, spender)
                            assert(allowance.eq(amount))
                        })
                    })

                    describe('when the spender had an approved amount', function () {
                        beforeEach(async function () {
                            await this.token.approve(spender, BN(1*10**18), { from: oneHundred })
                        })

                        it('increases the spender allowance adding the requested amount', async function () {
                            await this.token.increaseAllowance(spender, amount, { from: oneHundred })

                            const allowance = await this.token.allowance.call(oneHundred, spender)
                            assert(allowance.eq(BN(amount).add(BN(1*10**18))))
                        })
                    })
                })
            })

            describe('when the spender is the zero address', function () {
                const spender = ZERO_ADDRESS

                it('approves the requested amount', async function () {
                    await this.token.increaseAllowance(spender, amount, { from: oneHundred })

                    const allowance = await this.token.allowance.call(oneHundred, spender)
                    assert(allowance.eq(amount))
                })

                it('emits an approval event', async function () {
                    const { logs } = await this.token.increaseAllowance(spender, amount, { from: oneHundred })

                    assert.equal(logs.length, 1)
                    assert.equal(logs[0].event, 'Approval')
                    assert.equal(logs[0].args.owner, oneHundred)
                    assert.equal(logs[0].args.spender, spender)
                    assert(logs[0].args.value.eq(amount))
                })
            })
        })
    })
}

export default standardTokenTests
