import complianceTokenTests from './ComplianceToken';
const ComplianceToken = artifacts.require('ComplianceToken')
const Registry = artifacts.require('Registry')
const BalanceSheet = artifacts.require('BalanceSheet')
const AllowanceSheet = artifacts.require('AllowanceSheet')

contract('ComplianceToken', function ([_, owner, oneHundred, anotherAccount]) {
    beforeEach(async function () {
        this.registry = await Registry.new({ from: owner })
        this.balances = await BalanceSheet.new({ from: owner })
        this.allowances = await AllowanceSheet.new({ from: owner })
        this.token = await ComplianceToken.new({ from: owner })
        await this.token.setRegistry(this.registry.address, { from: owner })
        await this.balances.transferOwnership(this.token.address, { from: owner })
        await this.allowances.transferOwnership(this.token.address, { from: owner })
        await this.token.setBalanceSheet(this.balances.address, { from: owner })
        await this.token.setAllowanceSheet(this.allowances.address, { from: owner })

        await this.registry.setAttribute(oneHundred, "hasPassedKYC", 1, { from: owner })
        await this.token.mint(oneHundred, 100, { from: owner })
        await this.registry.setAttribute(oneHundred, "hasPassedKYC", 0, { from: owner })
    })

    complianceTokenTests([owner, oneHundred, anotherAccount])
})