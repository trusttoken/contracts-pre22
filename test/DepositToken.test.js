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
    const DEPOSIT_ADDRESS = '0x00000' + anotherAccount.slice(2,37)

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
            const depositAddressOne = anotherAccount.slice(0,37) + '00000';
            const depositAddressTwo = anotherAccount.slice(0,37) + '20000';
            const depositAddressThree = anotherAccount.slice(0,37) + '40000';
            const depositAddressFour = anotherAccount.slice(0,37) + '00500';
            await this.token.transfer(depositAddressOne, 10*10**18,{from: oneHundred})
            await this.token.transfer(depositAddressTwo, 10*10**18, {from: oneHundred})
            await this.token.transfer(depositAddressThree, 10*10**18, {from: oneHundred})
            await this.token.transfer(depositAddressFour, 10*10**18, {from: oneHundred})
            await assertBalance(this.token,anotherAccount, 40*10**18)
        })

        it('emits the right events', async function(){
            const depositAddressOne = anotherAccount.slice(0,37) + '00000';
            const {logs} = await this.token.transfer(depositAddressOne, 10*10**18,{from: oneHundred})
            assert.equal(logs[0].args.from,oneHundred)
            assert.equal(logs[0].args.to,depositAddressOne)
            assert.equal(logs[1].args.from,depositAddressOne)
            assert.equal(logs[1].args.to,anotherAccount)

        })

        it('can remove deposit address', async function(){
            await this.registry.setAttribute(DEPOSIT_ADDRESS, "isDepositAddress", 0, notes, { from: owner })
            const depositAddressOne = anotherAccount.slice(0,37) + '00000';
            const depositAddressTwo = anotherAccount.slice(0,37) + '20000';
            const depositAddressThree = anotherAccount.slice(0,37) + '40000';
            const depositAddressFour = anotherAccount.slice(0,37) + '00500';
            await this.token.transfer(depositAddressOne, 10*10**18, {from: oneHundred})
            await this.token.transfer(depositAddressTwo, 10*10**18, {from: oneHundred})
            await this.token.transfer(depositAddressThree, 10*10**18, {from: oneHundred})
            await this.token.transfer(depositAddressFour, 10*10**18, {from: oneHundred})
            await assertBalance(this.token,anotherAccount, 0)
        })
    })
})