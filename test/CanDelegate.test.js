import canDelegateTests from './CanDelegate'
const CanDelegateMock = artifacts.require('CanDelegateMock')

contract('CanDelegate', function ([_, owner, oneHundred, anotherAccount]) {
    beforeEach(async function () {
        this.token = await CanDelegateMock.new(oneHundred, 100, { from: owner })
    })

    canDelegateTests([owner, oneHundred, anotherAccount])
})