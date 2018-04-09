import mintableTokenTests from './MintableToken'
const MintableToken = artifacts.require('ModularMintableToken')
const BalanceSheet = artifacts.require('BalanceSheet')
const AllowanceSheet = artifacts.require('AllowanceSheet')

contract('MintableToken', function ([_, owner, oneHundred, anotherAccount]) {
    beforeEach(async function () {
        const balanceSheet = await BalanceSheet.new({ from: owner })
        const allowanceSheet = await AllowanceSheet.new({ from: owner })
        this.token = await MintableToken.new({ from: owner })
        await balanceSheet.transferOwnership(this.token.address, { from: owner })
        await this.token.setBalanceSheet(balanceSheet.address, { from: owner })
        await allowanceSheet.transferOwnership(this.token.address, { from: owner })
        await this.token.setAllowanceSheet(allowanceSheet.address, { from: owner })
    })

    mintableTokenTests([owner, oneHundred, anotherAccount])
})
