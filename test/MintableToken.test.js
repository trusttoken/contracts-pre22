import mintableTokenTests from './MintableToken'
const TrueUSDMock = artifacts.require('TrueUSDMock')
const Registry = artifacts.require('RegistryMock')

const bytes32 = require('./helpers/bytes32.js')

contract('MintableToken', function ([_, owner, oneHundred, anotherAccount]) {
    beforeEach(async function () {
        this.token = await TrueUSDMock.new(owner, 0, { from: owner })
        this.mintableToken = this.token
        this.registry = await Registry.new({ from: owner });
        await this.token.setRegistry(this.registry.address, { from: owner })
    })

    mintableTokenTests([owner, oneHundred, anotherAccount])
})
