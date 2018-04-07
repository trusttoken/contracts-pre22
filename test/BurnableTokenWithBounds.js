import assertRevert from './helpers/assertRevert'
const BurnableTokenWithBoundsMock = artifacts.require('BurnableTokenWithBoundsMock')
import burnableTokenTests from './token/BurnableToken'

contract('BurnableTokenWithBounds', function ([_, owner, recipient]) {
    beforeEach(async function () {
        this.token = await BurnableTokenWithBoundsMock.new(recipient, 100, { from: owner })
    })

    burnableTokenWithBoundsTests([_, owner, recipient])
})

function burnableTokenWithBoundsTests([_, owner, recipient]) {
    describe('--BurnableTokenWithBounds Tests--', function () {
        describe('non-restrictive burn bounds', function () {
            beforeEach(async function () {
                await this.token.setBurnBounds(0, "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", { from: owner })
            })

            burnableTokenTests([_, recipient])
        })

        describe('restrictive burn bounds', function () {
            beforeEach(async function () {
                await this.token.setBurnBounds(10, 20, { from: owner })
            })

            it("allows burns with bounds and reverts others", async function () {
                await assertRevert(this.token.burn(9, { from: recipient }))
                await assertRevert(this.token.burn(21, { from: recipient }))
                await this.token.burn(10, { from: recipient })
                await this.token.burn(15, { from: recipient })
                await this.token.burn(20, { from: recipient })
            })
        })
    })

}

export default burnableTokenWithBoundsTests