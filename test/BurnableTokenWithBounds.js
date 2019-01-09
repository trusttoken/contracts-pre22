import assertRevert from './helpers/assertRevert'
import burnableTokenTests from './token/BurnableToken'

function burnableTokenWithBoundsTests([owner, oneHundred, anotherAccount], transfersToZeroBecomeBurns = false) {
    describe('--BurnableTokenWithBounds Tests--', function () {
        describe('non-restrictive burn bounds', function () {
            beforeEach(async function () {
                await this.token.setBurnBounds(0, "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", { from: owner })
            })

            burnableTokenTests([owner, oneHundred, anotherAccount], transfersToZeroBecomeBurns)
        })

        describe('setBurnBounds', function () {
            it('sets the bounds', async function () {
                await this.token.setBurnBounds(10*10**18, 20*10**18, { from: owner })

                const min = await this.token.burnMin.call()
                assert.equal(min, 10*10**18)
                const max = await this.token.burnMax.call()
                assert.equal(max, 20*10**18)
            })

            it('emits an event', async function () {
                const { logs } = await this.token.setBurnBounds(10*10**18, 20*10**18, { from: owner })

                assert.equal(logs.length, 1)
                assert.equal(logs[0].event, 'SetBurnBounds')
                assert.equal(logs[0].args.newMin, 10*10**18)
                assert.equal(logs[0].args.newMax, 20*10**18)
            })

            it('cannot set max less than min', async function () {
                await assertRevert(this.token.setBurnBounds(20*10**18, 10*10**18, { from: owner }))
            })

            it('cannot be called by non-owner', async function () {
                await assertRevert(this.token.setBurnBounds(10*10**18, 20*10**18, { from: anotherAccount }))
            })
        })

        describe('restrictive burn bounds', function () {
            it("allows burns within bounds and reverts others", async function () {
                await this.token.setBurnBounds(10*10**18, 20*10**18, { from: owner })
                await assertRevert(this.token.burn(9*10**18, { from: oneHundred }))
                await assertRevert(this.token.burn(21*10**18, { from: oneHundred }))
                await this.token.burn(10*10**18, { from: oneHundred })
                await this.token.burn(15*10**18, { from: oneHundred })
                await this.token.burn(20*10**18, { from: oneHundred })
            })
        })

        if (transfersToZeroBecomeBurns) {
            const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
            describe('transfers to 0x0 become burns', function () {
                describe('restrictive burn bounds', function () {
                    it("allows burns within bounds and reverts others", async function () {
                        await this.token.setBurnBounds(10*10**18, 20*10**18, { from: owner })
                        await assertRevert(this.token.transfer(ZERO_ADDRESS, 9*10**18, { from: oneHundred }))
                        await assertRevert(this.token.transfer(ZERO_ADDRESS, 21*10**18, { from: oneHundred }))
                        await this.token.transfer(ZERO_ADDRESS, 10*10**18, { from: oneHundred })
                        await this.token.transfer(ZERO_ADDRESS, 15*10**18, { from: oneHundred })
                        await this.token.transfer(ZERO_ADDRESS, 20*10**18, { from: oneHundred })
                    })
                })
            })
        }
    })
}

export default burnableTokenWithBoundsTests
