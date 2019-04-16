import burnableTokenWithBoundsTests from './BurnableTokenWithBounds'
const BurnableTokenWithBoundsMock = artifacts.require('BurnableTokenWithBoundsMock')

const BN = web3.utils.toBN;

contract('BurnableTokenWithBounds', function ([_, owner, oneHundred, anotherAccount]) {
    beforeEach(async function () {
        this.token = await BurnableTokenWithBoundsMock.new(oneHundred, BN(100*10**18), { from: owner })
        this.mintableToken = this.token
    })

    burnableTokenWithBoundsTests([owner, oneHundred, anotherAccount])
})
