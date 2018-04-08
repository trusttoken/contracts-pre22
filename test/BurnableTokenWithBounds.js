import assertRevert from './helpers/assertRevert'
import burnableTokenTests from './token/BurnableToken'

function burnableTokenWithBoundsTests([_, owner, oneHundred, anotherAccount]) {
    describe('--BurnableTokenWithBounds Tests--', function () {
        describe('non-restrictive burn bounds', function () {
            beforeEach(async function () {
                await this.token.setBurnBounds(0, "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", { from: owner })
            })

            burnableTokenTests([_, owner, oneHundred, anotherAccount])
        })

        describe('setBurnBounds', function () {
            it('sets the bounds', async function () {
                await this.token.setBurnBounds(10, 20, { from: owner })

                const min = await this.token.burnMin()
                assert.equal(min, 10)
                const max = await this.token.burnMax()
                assert.equal(max, 20)
            })

            it('emits an event', async function () {
                const { logs } = await this.token.setBurnBounds(10, 20, { from: owner })

                assert.equal(logs.length, 1)
                assert.equal(logs[0].event, 'SetBurnBounds')
                assert.equal(logs[0].args.newMin, 10)
                assert.equal(logs[0].args.newMax, 20)
            })

            it('cannot set max less than min', async function () {
                await assertRevert(this.token.setBurnBounds(20, 10, { from: owner }))
            })

            it('cannot be called by non-owner', async function () {
                await assertRevert(this.token.setBurnBounds(10, 20, { from: anotherAccount }))
            })
        })

        describe('restrictive burn bounds', function () {
            it("allows burns within bounds and reverts others", async function () {
                await this.token.setBurnBounds(10, 20, { from: owner })
                await assertRevert(this.token.burn(9, { from: oneHundred }))
                await assertRevert(this.token.burn(21, { from: oneHundred }))
                await this.token.burn(10, { from: oneHundred })
                await this.token.burn(15, { from: oneHundred })
                await this.token.burn(20, { from: oneHundred })
            })
        })
    })

}

export default burnableTokenWithBoundsTests