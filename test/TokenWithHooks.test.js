import assertRevert from './helpers/assertRevert'
import assertBalance from './helpers/assertBalance'

const Registry = artifacts.require("Registry")
const TrueUSD = artifacts.require("TrueUSD")
const BalanceSheet = artifacts.require("BalanceSheet")
const AllowanceSheet = artifacts.require("AllowanceSheet")
const GlobalPause = artifacts.require("GlobalPause")
const TrueCoinReceiverMock = artifacts.require("TrueCoinReceiverMock")

contract('TokenWithHooks', function (accounts) {
    const [_, owner, oneHundred, anotherAccount] = accounts
    const notes = "notes"

    describe('--TokenWithHooks--', function () {
        beforeEach(async function () {
            this.registeredReceiver = await TrueCoinReceiverMock.new({from: owner})
            this.unregisteredReceiver = await TrueCoinReceiverMock.new({from: owner})
            this.registry = await Registry.new({ from: owner })
            this.balances = await BalanceSheet.new({ from: owner })
            this.allowances = await AllowanceSheet.new({ from: owner })
            this.token = await TrueUSD.new({ from: owner })
            await this.token.initialize(0, { from: owner })
            this.globalPause = await GlobalPause.new({ from: owner })
            await this.token.setGlobalPause(this.globalPause.address, { from: owner })   
            await this.token.setRegistry(this.registry.address, { from: owner })
            await this.balances.transferOwnership(this.token.address, { from: owner })
            await this.allowances.transferOwnership(this.token.address, { from: owner })
            await this.token.setBalanceSheet(this.balances.address, { from: owner })
            await this.token.setAllowanceSheet(this.allowances.address, { from: owner })
            await this.registry.setAttribute(oneHundred, "hasPassedKYC/AML", 1, notes, { from: owner })
            await this.token.mint(oneHundred, 100*10**18, { from: owner })
            await this.registry.setAttribute(oneHundred, "hasPassedKYC/AML", 0, notes, { from: owner })
            await this.registry.setAttribute(this.registeredReceiver.address, "isRegisteredContract", 1, notes, { from: owner })
        })

        it('transfer to anotherAccount', async function(){
            await this.token.transfer(anotherAccount, 50*10**18, {from: oneHundred})
            await assertBalance(this.token,anotherAccount, 50*10**18)
        })

        it('transfers to a registered receiver contracts', async function(){
            const {logs}=await this.token.transfer(this.registeredReceiver.address, 50*10**18, {from: oneHundred})
            const newState = await this.registeredReceiver.state()
            assertBalance.equal(newState, 50*10**18)
            console.log(logs)
        })

        it('transfers to a unregistered receiver contracts', async function(){
            await this.token.transfer(this.unregisteredReceiver.address, 50*10**18, {from: oneHundred})
            const newState = await this.registeredReceiver.state()
            assertBalance.equal(newState, 0)
        })

        it('transfers to a registered receiver contracts that fails', async function(){
            await assertRevert(this.token.transfer(this.registeredReceiver.address, 5*10**18, {from: oneHundred}))
        })
    })
})