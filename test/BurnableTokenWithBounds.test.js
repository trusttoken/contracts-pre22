import burnableTokenWithBoundsTests from './BurnableTokenWithBounds'
const BurnableTokenWithBoundsMock = artifacts.require('BurnableTokenWithBoundsMock')
const GlobalPause = artifacts.require("GlobalPause")

contract('BurnableTokenWithBounds', function ([_, owner, oneHundred, anotherAccount]) {
    beforeEach(async function () {
        this.token = await BurnableTokenWithBoundsMock.new(oneHundred, 100*10**18, { from: owner })
        this.globalPause = await GlobalPause.new({ from: owner })
        await this.token.setGlobalPause(this.globalPause.address, { from: owner })
    })

    burnableTokenWithBoundsTests([owner, oneHundred, anotherAccount])
})
