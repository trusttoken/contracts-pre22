import assertRevert from './helpers/assertRevert'
import expectThrow from './helpers/expectThrow'
import assertBalance from './helpers/assertBalance'
import depositTokenTests from './DepositToken'

const Registry = artifacts.require("RegistryMock")
const TrueUSD = artifacts.require("TrueUSDMock")
const ForceEther = artifacts.require("ForceEther")
const DepositAddressRegistrar = artifacts.require("DepositAddressRegistrar")

const writeAttributeFor = require('./helpers/writeAttributeFor.js')
const bytes32 = require('./helpers/bytes32.js')
const BN = web3.utils.toBN;
const IS_DEPOSIT_ADDRESS = bytes32("isDepositAddress")

contract('DepositToken', function (accounts) {
    const [_, owner, oneHundred, anotherAccount, thirdAddress] = accounts
    beforeEach(async function () {
        this.registry = await Registry.new({ from: owner })
        this.token = await TrueUSD.new(owner, 0, { from: owner })
        this.mintableToken = this.token;
        await this.token.setRegistry(this.registry.address, { from: owner })
        await this.registry.subscribe(IS_DEPOSIT_ADDRESS, this.token.address, { from: owner })
        await this.token.mint(oneHundred, BN(100*10**18), { from: owner })
    })
    depositTokenTests([owner, oneHundred, anotherAccount, thirdAddress])
})
