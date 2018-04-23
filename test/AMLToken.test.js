import amlTokenTests from './AMLToken';
const AMLTokenMock = artifacts.require('AMLTokenMock')
const Registry = artifacts.require('Registry')
const BalanceSheet = artifacts.require('BalanceSheet')
const AllowanceSheet = artifacts.require('AllowanceSheet')

contract('AMLToken', function ([_, owner, oneHundred, anotherAccount]) {
    beforeEach(async function () {
        this.registry = await Registry.new({ from: owner })
        this.token = await AMLTokenMock.new(oneHundred, 100, { from: owner })
        await this.token.setRegistry(this.registry.address, { from: owner })
    })

    amlTokenTests([owner, oneHundred, anotherAccount])
})