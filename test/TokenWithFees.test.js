import tokenWithFeesTests from './TokenWithFees';
const TokenWithFees = artifacts.require('TokenWithFees')
const Registry = artifacts.require('Registry')
const BalanceSheet = artifacts.require('BalanceSheet')
const AllowanceSheet = artifacts.require('AllowanceSheet')

contract('TokenWithFees', function ([_, owner, oneHundred, anotherAccount]) {
    beforeEach(async function () {
        console.log(1)
        this.balances = await BalanceSheet.new({ from: owner })
        console.log(2)
        this.allowances = await AllowanceSheet.new({ from: owner })
        console.log(2)
        this.registry = await Registry.new({ from: owner })
        console.log(4)
        this.token = await TokenWithFees.new({ from: owner })
        console.log(5)
        await this.balances.transferOwnership(this.token.address, { from: owner })
        console.log(6)
        await this.allowances.transferOwnership(this.token.address, { from: owner })
        console.log(7)
        await this.token.setBalanceSheet(this.balances.address, { from: owner })
        console.log(8)
        await this.token.setAllowanceSheet(this.allowances.address, { from: owner })
        console.log(9)
        await this.token.setRegistry(this.registry.address, { from: owner })
        console.log(10)

        await this.token.mint(oneHundred, 100*10**18, { from: owner })
        console.log(11)
    })

    tokenWithFeesTests([owner, oneHundred, anotherAccount])
})
