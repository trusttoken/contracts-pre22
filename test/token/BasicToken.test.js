import basicTokenTests from './BasicToken'
const BasicToken = artifacts.require('BasicTokenMock')

contract('BasicToken', function ([_, owner, oneHundred, anotherAccount]) {
    beforeEach(async function () {
        this.token = await BasicToken.new(oneHundred, 100*10**18, { from: owner })
    })

    basicTokenTests([owner, oneHundred, anotherAccount])
})
