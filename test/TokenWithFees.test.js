import tokenWithFeesTests from './TokenWithFees';
const TokenWithFees = artifacts.require('TokenWithFees')
const AddressList = artifacts.require('AddressList')
const BalanceSheet = artifacts.require('BalanceSheet')
const AllowanceSheet = artifacts.require('AllowanceSheet')

contract('TokenWithFees', function ([_, owner, oneHundred, anotherAccount]) {
    beforeEach(async function () {
        this.balances = await BalanceSheet.new({ from: owner })
        this.allowances = await AllowanceSheet.new({ from: owner })
        this.noFeesList = await AddressList.new("No fees list", { from: owner })
        this.token = await TokenWithFees.new({ from: owner })
        await this.balances.transferOwnership(this.token.address, { from: owner })
        await this.allowances.transferOwnership(this.token.address, { from: owner })
        await this.token.setBalanceSheet(this.balances.address, { from: owner })
        await this.token.setAllowanceSheet(this.allowances.address, { from: owner })
        await this.token.setNoFeesList(this.noFeesList.address, { from: owner })

        await this.token.mint(oneHundred, 100, { from: owner })
    })

    tokenWithFeesTests([_, owner, oneHundred, anotherAccount])
})