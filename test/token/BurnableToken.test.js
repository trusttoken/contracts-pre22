import burnableTokenTests from './BurnableToken'
const BurnableTokenMock = artifacts.require('BurnableTokenMock')

contract('BurnableToken', function ([_, owner, oneHundred, anotherAccount]) {
    beforeEach(async function () {
        this.token = await BurnableTokenMock.new(oneHundred, 100*10**18, { from: owner })
    })

    burnableTokenTests([owner, oneHundred, anotherAccount])
})
