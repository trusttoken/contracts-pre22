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

        describe('restrictive burn bounds', function () {
            beforeEach(async function () {
                await this.token.setBurnBounds(10, 20, { from: owner })
            })

            it("allows burns with bounds and reverts others", async function () {
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