import assertRevert from './helpers/assertRevert'
import expectThrow from './helpers/expectThrow'
import assertBalance from './helpers/assertBalance'

const Registry = artifacts.require("Registry")
const TrueUSD = artifacts.require("TrueUSD")
const BalanceSheet = artifacts.require("BalanceSheet")
const AllowanceSheet = artifacts.require("AllowanceSheet")
const ForceEther = artifacts.require("ForceEther")
const GlobalPause = artifacts.require("GlobalPause")

contract('DepositToken', function (accounts) {
    const [_, owner, oneHundred, anotherAccount] = accounts
    const notes = "some notes"
    const DEPOSIT_ADDRESS = '0x000000' + anotherAccount.slice(2,36)

    describe('--Deposit Token--', function () {
        beforeEach(async function () {
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
            await this.registry.setAttribute(DEPOSIT_ADDRESS, "isDepositAddress", anotherAccount, web3.fromUtf8(notes), { from: owner })
        })

        it('transfer to anotherAccount', async function(){
            await this.token.transfer(anotherAccount, 50*10**18, {from: oneHundred})
            await assertBalance(this.token,anotherAccount, 50*10**18)
        })


        it('transfers a deposit address of another account forwards tokens to anotherAccount', async function(){
            const depositAddressOne = anotherAccount.slice(0,36) + '000000';
            const depositAddressTwo = anotherAccount.slice(0,36) + '200000';
            const depositAddressThree = anotherAccount.slice(0,36) + '400000';
            const depositAddressFour = anotherAccount.slice(0,36) + '005000';
            await this.token.transfer(depositAddressOne, 10*10**18,{from: oneHundred})
            await this.token.transfer(depositAddressTwo, 10*10**18, {from: oneHundred})
            await this.token.transfer(depositAddressThree, 10*10**18, {from: oneHundred})
            await this.token.transfer(depositAddressFour, 10*10**18, {from: oneHundred})
            await assertBalance(this.token,anotherAccount, 40*10**18)
        })

        it('can remove deposit address', async function(){
            await this.registry.setAttribute(DEPOSIT_ADDRESS, "isDepositAddress", 0, notes, { from: owner })
            const depositAddressOne = anotherAccount.slice(0,36) + '000000';
            const depositAddressTwo = anotherAccount.slice(0,36) + '200000';
            const depositAddressThree = anotherAccount.slice(0,36) + '400000';
            const depositAddressFour = anotherAccount.slice(0,36) + '005000';
            await this.token.transfer(depositAddressOne, 10*10**18, {from: oneHundred})
            await this.token.transfer(depositAddressTwo, 10*10**18, {from: oneHundred})
            await this.token.transfer(depositAddressThree, 10*10**18, {from: oneHundred})
            await this.token.transfer(depositAddressFour, 10*10**18, {from: oneHundred})
            await assertBalance(this.token,anotherAccount, 0)
        })
    })
})