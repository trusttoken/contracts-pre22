import basicTokenTests from './BasicToken'
const TrueUSDMock = artifacts.require('TrueUSDMock')
const Registry = artifacts.require('RegistryMock')

const BN = web3.utils.toBN;

contract('BasicToken', function ([_, owner, oneHundred, anotherAccount]) {
    beforeEach(async function () {
        this.token = await TrueUSDMock.new(oneHundred, BN(100*10**18), { from: owner })
        this.registry = await Registry.new({ from: owner });
        await this.token.setRegistry(this.registry.address, {from: owner});
    })

    basicTokenTests([owner, oneHundred, anotherAccount])
})
