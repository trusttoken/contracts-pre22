import compliantTokenTests from './CompliantToken'
const CompliantTokenMock = artifacts.require('CompliantTokenMock')
const Registry = artifacts.require('RegistryMock')

const BN = web3.utils.toBN

contract('CompliantToken', function ([, owner, oneHundred, anotherAccount]) {
  beforeEach(async function () {
    this.registry = await Registry.new({ from: owner })
    this.token = await CompliantTokenMock.new(oneHundred, BN(100 * 10 ** 18), { from: owner })
    this.mintableToken = this.token
    await this.token.setRegistry(this.registry.address, { from: owner })
  })

  compliantTokenTests([owner, oneHundred, anotherAccount])
})
