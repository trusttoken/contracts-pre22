import gatedTokenTests from './GatedToken';
const GatedToken = artifacts.require('GatedToken')
const AddressList = artifacts.require('AddressList')
const BalanceSheet = artifacts.require('BalanceSheet')
const AllowanceSheet = artifacts.require('AllowanceSheet')

contract('GatedToken', function ([_, owner, oneHundred, anotherAccount]) {
    beforeEach(async function () {
        this.mintWhiteList = await AddressList.new("Mint whitelist", { from: owner })
        this.burnWhiteList = await AddressList.new("Burn whitelist", { from: owner })
        this.blackList = await AddressList.new("Blacklist", { from: owner })
        this.balances = await BalanceSheet.new({ from: owner })
        this.allowances = await AllowanceSheet.new({ from: owner })
        this.token = await GatedToken.new({ from: owner })
        await this.token.setLists(this.mintWhiteList.address, this.burnWhiteList.address, this.blackList.address, { from: owner })
        await this.balances.transferOwnership(this.token.address, { from: owner })
        await this.allowances.transferOwnership(this.token.address, { from: owner })
        await this.token.setBalanceSheet(this.balances.address, { from: owner })
        await this.token.setAllowanceSheet(this.allowances.address, { from: owner })

        await this.mintWhiteList.changeList(oneHundred, true, { from: owner })
        await this.token.mint(oneHundred, 100, { from: owner })
        await this.mintWhiteList.changeList(oneHundred, false, { from: owner })
    })

    gatedTokenTests([_, owner, oneHundred, anotherAccount])
})