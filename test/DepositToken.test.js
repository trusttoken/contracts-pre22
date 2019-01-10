import assertRevert from './helpers/assertRevert'
import expectThrow from './helpers/expectThrow'
import assertBalance from './helpers/assertBalance'

const Registry = artifacts.require("Registry")
const TrueUSD = artifacts.require("TrueUSDMock")
const BalanceSheet = artifacts.require("BalanceSheet")
const AllowanceSheet = artifacts.require("AllowanceSheet")
const ForceEther = artifacts.require("ForceEther")
const DepositAddressRegistrar = artifacts.require("DepositAddressRegistrar")

contract('DepositToken', function (accounts) {
    const [_, owner, oneHundred, anotherAccount, thirdAddress] = accounts
    const notes = "some notes"
    const DEPOSIT_ADDRESS = '0x00000' + anotherAccount.slice(2,37)

    describe('--Deposit Token--', function () {
        beforeEach(async function () {
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

        it('emits the right events for mint', async function() {
            const ZERO = '0x0000000000000000000000000000000000000000';
            const depositAddressOne = anotherAccount.slice(0,37) + '00000';
            await this.registry.setAttribute(depositAddressOne, "hasPassedKYC/AML", 1, notes, { from: owner});
            const {logs} = await this.token.mint(depositAddressOne, 10*10**18,{from: owner})
            assert.equal(logs[0].args.to,depositAddressOne);
            assert.equal(logs[0].args.value, 10*10**18);
            assert.equal(logs[1].args.from,ZERO)
            assert.equal(logs[1].args.to,depositAddressOne)
            assert.equal(logs[2].args.from,depositAddressOne)
            assert.equal(logs[2].args.to,anotherAccount)
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
        
        it('deposit tokens work with minting', async function(){
            const depositAddressOne = anotherAccount.slice(0,37) + '00000';
            const depositAddressTwo = anotherAccount.slice(0,37) + '20000';
            await this.registry.setAttribute(depositAddressOne, "hasPassedKYC/AML", 1, notes, { from: owner })
            await this.registry.setAttribute(depositAddressTwo, "hasPassedKYC/AML", 1, notes, { from: owner })
            const {logs} = await this.token.mint(depositAddressOne, 10*10**18, {from: owner})
            await this.token.mint(depositAddressTwo, 10*10**18, {from: owner})
            await assertBalance(this.token,anotherAccount, 20*10**18)
        })


        describe('deposit token works with deposit registrar', function(){
            beforeEach(async function () {
                this.registrar = await DepositAddressRegistrar.new(this.registry.address, {from: owner})
                const canWriteToDepositAddress = await this.registry.writeAttributeFor.call("isDepositAddress")
                await this.registry.setAttributeValue(this.registrar.address, canWriteToDepositAddress, 1, { from: owner })
            })

            it('Registrar can register deposit address', async function(){
                await this.registrar.registerDepositAddress({from: thirdAddress})
                const depositAddressOne = thirdAddress.slice(0,37) + '00000';
                const depositAddressTwo = thirdAddress.slice(0,37) + '20000';
                const depositAddressThree = thirdAddress.slice(0,37) + '40000';
                const depositAddressFour = thirdAddress.slice(0,37) + '00500';
                await this.token.transfer(depositAddressOne, 10*10**18,{from: oneHundred})
                await this.token.transfer(depositAddressTwo, 10*10**18, {from: oneHundred})
                await this.token.transfer(depositAddressThree, 10*10**18, {from: oneHundred})
                await this.token.transfer(depositAddressFour, 10*10**18, {from: oneHundred})
                await assertBalance(this.token,thirdAddress, 40*10**18)    
            })

            it('Registrar can register deposit address through fallback function', async function(){
                await this.registrar.sendTransaction({from: thirdAddress, gas: 600000, value: 10})
                const depositAddressOne = thirdAddress.slice(0,37) + '00000';
                const depositAddressTwo = thirdAddress.slice(0,37) + '20000';
                const depositAddressThree = thirdAddress.slice(0,37) + '40000';
                const depositAddressFour = thirdAddress.slice(0,37) + '00500';
                await this.token.transfer(depositAddressOne, 10*10**18,{from: oneHundred})
                await this.token.transfer(depositAddressTwo, 10*10**18, {from: oneHundred})
                await this.token.transfer(depositAddressThree, 10*10**18, {from: oneHundred})
                await this.token.transfer(depositAddressFour, 10*10**18, {from: oneHundred})
                await assertBalance(this.token,thirdAddress, 40*10**18)    
            })

            it('cannot register for deposit address twice', async function(){
                await this.registrar.sendTransaction({from: thirdAddress, gas: 600000})
                await assertRevert(this.registrar.sendTransaction({from: thirdAddress, gas: 600000}))
            })

            it('cannot register for deposit address twice', async function(){
                await this.registrar.registerDepositAddress({from: thirdAddress})
                await assertRevert(this.registrar.registerDepositAddress({from: thirdAddress}))
            })
        })
    })
})
