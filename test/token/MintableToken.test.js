import mintableTokenTests from './MintableToken'
const TrueUSDMock = artifacts.require('TrueUSDMock')
const BalanceSheet = artifacts.require('BalanceSheet')
const AllowanceSheet = artifacts.require('AllowanceSheet')
const Registry = artifacts.require('RegistryMock')

const bytes32 = require('../helpers/bytes32.js')

contract('MintableToken', function ([_, owner, oneHundred, anotherAccount]) {
    beforeEach(async function () {
        const balanceSheet = await BalanceSheet.new({ from: owner })
        const allowanceSheet = await AllowanceSheet.new({ from: owner })
        this.token = await TrueUSDMock.new(owner, 0, { from: owner })
        this.registry = await Registry.new({ from: owner });
        await this.token.setRegistry(this.registry.address, { from: owner })
        await balanceSheet.transferOwnership(this.token.address, { from: owner })
        await this.token.setBalanceSheet(balanceSheet.address, { from: owner })
        await allowanceSheet.transferOwnership(this.token.address, { from: owner })
        await this.token.setAllowanceSheet(allowanceSheet.address, { from: owner })
    })

    mintableTokenTests([owner, oneHundred, anotherAccount])
})
