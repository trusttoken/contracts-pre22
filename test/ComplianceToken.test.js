import complianceTokenTests from './ComplianceToken';
const ComplianceTokenMock = artifacts.require('ComplianceTokenMock')
const Registry = artifacts.require('Registry')
const BalanceSheet = artifacts.require('BalanceSheet')
const AllowanceSheet = artifacts.require('AllowanceSheet')

contract('ComplianceToken', function ([_, owner, oneHundred, anotherAccount]) {
    beforeEach(async function () {
        this.registry = await Registry.new({ from: owner })
        this.token = await ComplianceTokenMock.new(oneHundred, 100, { from: owner })
        await this.token.setRegistry(this.registry.address, { from: owner })
    })

    complianceTokenTests([owner, oneHundred, anotherAccount])
})