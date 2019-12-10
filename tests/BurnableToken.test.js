import burnableTokenTests from './BurnableToken'
const BurnableTokenMock = artifacts.require('BurnableTokenMock')

const BN = web3.utils.toBN;

contract('BurnableToken', function ([_, owner, oneHundred, anotherAccount]) {
    beforeEach(async function () {
        this.token = await BurnableTokenMock.new(oneHundred, BN(100).mul(BN(10**18)), { from: owner })
        this.mintableToken = this.token
    })

    burnableTokenTests([owner, oneHundred, anotherAccount])
})
