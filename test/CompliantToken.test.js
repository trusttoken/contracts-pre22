import compliantTokenTests from './CompliantToken';
const CompliantTokenMock = artifacts.require('CompliantTokenMock')
const Registry = artifacts.require('Registry')
const BalanceSheet = artifacts.require('BalanceSheet')
const AllowanceSheet = artifacts.require('AllowanceSheet')
const GlobalPause = artifacts.require("GlobalPause")

contract('CompliantToken', function ([_, owner, oneHundred, anotherAccount]) {
    beforeEach(async function () {
        this.registry = await Registry.new({ from: owner })
        this.token = await CompliantTokenMock.new(oneHundred, 100*10**18, { from: owner })
        await this.token.setRegistry(this.registry.address, { from: owner })
        this.globalPause = await GlobalPause.new({ from: owner })
        await this.token.setGlobalPause(this.globalPause.address, { from: owner })
    })

    compliantTokenTests([owner, oneHundred, anotherAccount])
})
