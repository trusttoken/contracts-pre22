import assertRevert from './helpers/assertRevert'
import burnableTokenTests from './BurnableToken'

const BN = web3.utils.toBN;

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
                await this.token.setBurnBounds(BN(10*10**18), BN(20*10**18), { from: owner })

                const min = await this.token.burnMin.call()
                assert(BN(10*10**18).eq(min))
                const max = await this.token.burnMax.call()
                assert(BN(20*10**18).eq(max))
            })

            it('emits an event', async function () {
                const { logs } = await this.token.setBurnBounds(BN(10*10**18), BN(20*10**18), { from: owner })

                assert.equal(logs.length, 1)
                assert.equal(logs[0].event, 'SetBurnBounds')
                assert(BN(10*10**18).eq(logs[0].args.newMin))
                assert(BN(20*10**18).eq(logs[0].args.newMax))
            })

            it('cannot set max less than min', async function () {
                await assertRevert(this.token.setBurnBounds(BN(20*10**18), BN(10*10**18), { from: owner }))
            })

            it('cannot be called by non-owner', async function () {
                await assertRevert(this.token.setBurnBounds(BN(10*10**18), BN(20*10**18), { from: anotherAccount }))
            })
        })

        describe('restrictive burn bounds', function () {
            it("allows burns within bounds and reverts others", async function () {
                await this.token.setBurnBounds(BN(10*10**18), BN(20*10**18), { from: owner })
                await assertRevert(this.token.burn(BN(9*10**18), { from: oneHundred }))
                await assertRevert(this.token.burn(BN(21*10**18), { from: oneHundred }))
                await this.token.burn(BN(10*10**18), { from: oneHundred })
                await this.token.burn(BN(15*10**18), { from: oneHundred })
                await this.token.burn(BN(20*10**18), { from: oneHundred })
            })
        })

        if (transfersToZeroBecomeBurns) {
            const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
            describe('transfers to 0x0 become burns', function () {
                describe('restrictive burn bounds', function () {
                    it("allows burns within bounds and reverts others", async function () {
                        await this.token.setBurnBounds(BN(10*10**18), BN(20*10**18), { from: owner })
                        await assertRevert(this.token.transfer(ZERO_ADDRESS, BN(9*10**18), { from: oneHundred }))
                        await assertRevert(this.token.transfer(ZERO_ADDRESS, BN(21*10**18), { from: oneHundred }))
                        await this.token.transfer(ZERO_ADDRESS, BN(10*10**18), { from: oneHundred })
                        await this.token.transfer(ZERO_ADDRESS, BN(15*10**18), { from: oneHundred })
                        await this.token.transfer(ZERO_ADDRESS, BN(20*10**18), { from: oneHundred })
                    })
                })
            })
        }
    })
}

export default burnableTokenWithBoundsTests
