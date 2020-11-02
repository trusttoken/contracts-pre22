import mintableTokenTests from './MintableToken'
const TrueUSDMock = artifacts.require('TrueUSDMock')
const Registry = artifacts.require('RegistryMock')

contract('MintableToken', function ([, owner, anotherAccount]) {
  beforeEach(async function () {
    this.token = await TrueUSDMock.new(owner, 0, { from: owner })
    this.mintableToken = this.token
    this.registry = await Registry.new({ from: owner })
    await this.token.setRegistry(this.registry.address, { from: owner })
  })

  mintableTokenTests([owner, anotherAccount])
})
