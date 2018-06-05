import basicTokenTests from './BasicToken'
import standardTokenTests from './StandardToken'
const StandardTokenMock = artifacts.require('StandardTokenMock')

contract('StandardToken', function ([_, owner, oneHundred, anotherAccount]) {
    beforeEach(async function () {
        this.token = await StandardTokenMock.new(oneHundred, 100*10**18)
    })

    basicTokenTests([owner, oneHundred, anotherAccount])
    standardTokenTests([owner, oneHundred, anotherAccount])
})
