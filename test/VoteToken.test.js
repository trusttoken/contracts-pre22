import assertRevert from './helpers/assertRevert'
import assertBalance from './helpers/assertBalance'
const TrustToken = artifacts.require('TrustToken')

const bytes32 = require('./helpers/bytes32.js')
const BN = web3.utils.toBN

contract('VoteToken', function (accounts) {
    const [, owner, oneHundred, anotherAccount] = accounts
    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
    describe('Metadata', async function () {
        beforeEach(async function () {
          this.trusttoken = await TrustToken.new()
        })
    
        it('Should the name be TrustToken', async function () {
            const name = await this.trusttoken.name.call()
            assert.equal(name, 'TrustToken')
        })
    })
})
