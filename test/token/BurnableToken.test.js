import burnableTokenTests from './BurnableToken'
const TrueUSDMock = artifacts.require('TrueUSDMock')

const BN = web3.utils.toBN;

contract('BurnableToken', function ([_, owner, oneHundred, anotherAccount]) {
    beforeEach(async function () {
        this.token = await BurnableTokenMock.new(oneHundred, BN(100).mul(BN(10**18)), { from: owner })
        this.token.setBurnBounds(0, BN(10000).mul(BN(10**18)), { from: owner })
    })

    burnableTokenTests([owner, oneHundred, anotherAccount])
})
