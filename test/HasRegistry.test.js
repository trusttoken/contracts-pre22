import hasRegistryTests from './HasRegistry';
const HasRegistry = artifacts.require('HasRegistry')

contract('HasRegistry', function ([_, owner, oneHundred, anotherAccount]) {
    beforeEach(async function () {
        this.token = await HasRegistry.new({ from: owner })
    })

    hasRegistryTests([owner, oneHundred, anotherAccount])
})