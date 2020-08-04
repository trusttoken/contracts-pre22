import depositTokenTests from './DepositToken'

const Registry = artifacts.require('RegistryMock')
const TrueUSD = artifacts.require('TrueUSDMock')

const BN = web3.utils.toBN

contract('DepositToken', function (accounts) {
  const [, owner, oneHundred, anotherAccount, thirdAddress] = accounts
  beforeEach(async function () {
    this.registry = await Registry.new({ from: owner })
    this.token = await TrueUSD.new(owner, 0, { from: owner })
    this.mintableToken = this.token
    await this.token.setRegistry(this.registry.address, { from: owner })
    await this.token.mint(oneHundred, BN(100 * 10 ** 18), { from: owner })
  })
  depositTokenTests([owner, oneHundred, anotherAccount, thirdAddress])
})
