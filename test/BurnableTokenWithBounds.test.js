import burnableTokenWithBoundsTests from './BurnableTokenWithBounds'
const BurnableTokenWithBoundsMock = artifacts.require('BurnableTokenWithBoundsMock')

contract('BurnableTokenWithBounds', function ([_, owner, oneHundred, anotherAccount]) {
    beforeEach(async function () {
        this.token = await BurnableTokenWithBoundsMock.new(oneHundred, 100, { from: owner })
    })

    burnableTokenWithBoundsTests([owner, oneHundred, anotherAccount])
})