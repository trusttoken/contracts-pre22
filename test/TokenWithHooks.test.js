import assertRevert from './helpers/assertRevert'
import assertBalance from './helpers/assertBalance'

const Registry = artifacts.require("Registry")
const TrueUSD = artifacts.require("TrueUSDMock")
const BalanceSheet = artifacts.require("BalanceSheet")
const AllowanceSheet = artifacts.require("AllowanceSheet")
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
            this.token = await TrueUSD.new(owner, 0, { from: owner })
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
            const { logs } = await this.token.transfer(this.registeredReceiver.address, 50*10**18, { from: oneHundred })
            const newState = await this.registeredReceiver.state.call()
            assert.equal(newState, 50*10**18)
        })

        it('transferFrom to a registered receiver contracts', async function(){
            await this.token.approve(anotherAccount, 50*10**18, { from: oneHundred });
            const { logs } = await this.token.transferFrom(oneHundred, this.registeredReceiver.address, 50*10**18, { from: anotherAccount })
            const newState = await this.registeredReceiver.state.call()
            assert.equal(newState, 50*10**18)
        })

        it('transfers to a unregistered receiver contracts', async function(){
            await this.token.transfer(this.unregisteredReceiver.address, 50*10**18, {from: oneHundred})
            const newState = await this.registeredReceiver.state.call()
            assert.equal(newState, 0)
        })

        it('transferFrom to a unregistered receiver contracts', async function(){
            await this.token.approve(anotherAccount, 50*10**18, { from: oneHundred });
            await this.token.transferFrom(oneHundred, this.unregisteredReceiver.address, 50*10**18, {from: anotherAccount})
            const newState = await this.registeredReceiver.state.call()
            assert.equal(newState, 0)
        })

        it('transfers to a registered receiver contracts that fails', async function(){
            await assertRevert(this.token.transfer(this.registeredReceiver.address, 5*10**18, {from: oneHundred}))
        })

        it('token with hooks transfer works with deposit address', async function(){
            this.depositAddressReceiver = await TrueCoinReceiverMock.new({from: owner})
            const DEPOSIT_ADDRESS = '0x00000' + this.depositAddressReceiver.address.slice(2,37)
            await this.registry.setAttribute(DEPOSIT_ADDRESS, "isDepositAddress", this.depositAddressReceiver.address, web3.fromUtf8(notes), { from: owner })
            await this.registry.setAttribute(this.depositAddressReceiver.address, "isRegisteredContract", 1, notes, { from: owner })
            const depositAddressOne = this.depositAddressReceiver.address.slice(0,37) + '20000';
            const {logs} = await this.token.transfer(depositAddressOne, 50*10**18, {from: oneHundred})
            const newSender = await this.depositAddressReceiver.sender.call()
            assert.equal(newSender,depositAddressOne)
        })

        it('token with hooks transferFrom works with deposit address', async function(){
            this.depositAddressReceiver = await TrueCoinReceiverMock.new({from: owner})
            const DEPOSIT_ADDRESS = '0x00000' + this.depositAddressReceiver.address.slice(2,37)
            await this.registry.setAttribute(DEPOSIT_ADDRESS, "isDepositAddress", this.depositAddressReceiver.address, web3.fromUtf8(notes), { from: owner })
            await this.registry.setAttribute(this.depositAddressReceiver.address, "isRegisteredContract", 1, notes, { from: owner })
            const depositAddressOne = this.depositAddressReceiver.address.slice(0,37) + '20000';
            await this.token.approve(anotherAccount, 50*10**18, { from: oneHundred });
            const {logs} = await this.token.transferFrom(oneHundred, depositAddressOne, 50*10**18, {from: anotherAccount})
            const newSender = await this.depositAddressReceiver.sender.call()
            assert.equal(newSender,depositAddressOne)
        })

        it('fallback works for newly minted tokens', async function() {
            this.receiver = await TrueCoinReceiverMock.new({from: owner})
            await this.registry.setAttribute(this.receiver.address, "isRegisteredContract", 1, notes, { from: owner })
            await this.registry.setAttribute(this.receiver.address, "hasPassedKYC/AML", 1, notes, { from: owner })
            await this.token.mint(this.receiver.address, 50*10**18, { from:owner });
            const newSender = await this.receiver.sender.call()
            assert.equal(newSender, '0x0000000000000000000000000000000000000000')
        })

        it('deposit address fallback works for newly minted tokens', async function() {
            this.depositAddressReceiver = await TrueCoinReceiverMock.new({from: owner})
            const DEPOSIT_ADDRESS = '0x00000' + this.depositAddressReceiver.address.slice(2,37)
            await this.registry.setAttribute(DEPOSIT_ADDRESS, "isDepositAddress", this.depositAddressReceiver.address, web3.fromUtf8(notes), { from: owner })
            await this.registry.setAttribute(this.depositAddressReceiver.address, "isRegisteredContract", 1, notes, { from: owner })
            const depositAddressOne = this.depositAddressReceiver.address.slice(0,37) + '20000';
            await this.registry.setAttribute(depositAddressOne, "hasPassedKYC/AML", 1, notes, { from: owner })
            await this.token.mint(depositAddressOne, 50*10**18, { from:owner });
            const newSender = await this.depositAddressReceiver.sender()
            assert.equal(newSender, depositAddressOne)
        })

    })
})
