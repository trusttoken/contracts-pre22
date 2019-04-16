import compliantTokenTests from './CompliantToken';
const CompliantTokenMock = artifacts.require('CompliantTokenMock')
const Registry = artifacts.require('RegistryMock')
const BalanceSheet = artifacts.require('BalanceSheet')
const AllowanceSheet = artifacts.require('AllowanceSheet')

const BN = web3.utils.toBN;
const bytes32 = require('./helpers/bytes32.js')

contract('CompliantToken', function ([_, owner, oneHundred, anotherAccount]) {
    beforeEach(async function () {
        this.registry = await Registry.new({ from: owner })
        this.token = await CompliantTokenMock.new(oneHundred, BN(100*10**18), { from: owner })
        this.mintableToken = this.token
        await this.token.setRegistry(this.registry.address, { from: owner })
        await this.registry.subscribe(bytes32("isBlacklisted"), this.token.address, { from: owner });
        await this.registry.subscribe(bytes32("canBurn"), this.token.address, { from: owner });
    })

    compliantTokenTests([owner, oneHundred, anotherAccount])
})
