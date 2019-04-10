import assertRevert from './helpers/assertRevert'
import assertBalance from './helpers/assertBalance'

const bytes32 = require('./helpers/bytes32.js')
const BN = web3.utils.toBN;

function redeemTokenTests([owner, oneHundred, anotherAccount]) {
    const notes = bytes32("some notes")
    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
    const CAN_BURN = bytes32("canBurn")

    describe('--Redeemable Token--', function () {
        beforeEach(async function () {
            await this.registry.setAttribute(oneHundred, CAN_BURN, 1, notes, { from: owner })
        })

        it('transfer to 0x0 does not burn trueUSD', async function(){
            await assertBalance(this.token, oneHundred, 100*10**18)
            await assertRevert(this.token.transfer(ZERO_ADDRESS, BN(10*10**18), {from : oneHundred}))
            await assertBalance(this.token, oneHundred, 100*10**18)
            await this.token.approve(anotherAccount, BN(10*10**18), {from : oneHundred})
            await assertRevert(this.token.transferFrom(oneHundred,ZERO_ADDRESS, BN(10*10**18), {from : anotherAccount}))
            const totalSupply = await this.token.totalSupply.call()
            assert(totalSupply.eq(BN(100*10**18)))
            const balanceOfZero = await this.token.balanceOf.call(ZERO_ADDRESS);
            assert(balanceOfZero.eq(BN(0)));
        })
        
        describe('--Redemption Addresses--', function () {
            const ADDRESS_ONE = '0x0000000000000000000000000000000000000001'
            const ADDRESS_TWO = '0x0000000000000000000000000000000000000002'

            it('transfers to Redemption addresses gets burned', async function(){
                await this.registry.setAttribute(ADDRESS_ONE, CAN_BURN, 1, notes, { from: owner })
                await this.registry.setAttribute(ADDRESS_TWO, CAN_BURN, 1, notes, { from: owner })
                let { logs } = await this.token.transfer(ADDRESS_ONE, BN(10*10**18), {from : oneHundred})
                assert.equal(logs[0].event, 'Transfer')
                assert.equal(logs[1].event, 'Burn')
                assert.equal(logs[2].event, 'Transfer')
                await assertBalance(this.token, oneHundred, 90*10**18)
                assert((await this.token.totalSupply.call()).eq(BN(90*10**18)))
                await assertRevert(this.token.transfer('0x0000000000000000000000000000000000000004', BN(10*10**18), {from: oneHundred}))
                assert((await this.token.totalSupply.call()).eq(BN(90*10**18)))
                await this.token.transfer(ADDRESS_TWO, BN(10*10**18), {from : oneHundred})
                assert((await this.token.totalSupply.call()).eq(BN(80*10**18)))
                await this.token.transfer(ADDRESS_ONE, BN(10*10**18), {from : oneHundred})
                assert((await this.token.totalSupply.call()).eq(BN(70*10**18)))
                const TEN = BN(10*10**18);
                await this.token.approve(oneHundred, TEN, {from: oneHundred})
                logs = (await this.token.transferFrom(oneHundred, ADDRESS_TWO, TEN, {from:oneHundred})).logs
                assert.equal(logs[0].event, 'Transfer')
                assert.equal(logs[1].event, 'Burn')
                assert.equal(logs[2].event, 'Transfer')
                assert((await this.token.totalSupply.call()).eq(BN(60*10**18)))
            })

            it('transfers to Redemption addresses fails if Redemption address cannot burn', async function(){
                await assertRevert(this.token.transfer(ADDRESS_ONE, BN(10*10**18), {from : oneHundred}))
            })
        })
    })
}

export default redeemTokenTests
