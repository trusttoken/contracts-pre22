import assertRevert from './helpers/assertRevert'
import expectThrow from './helpers/expectThrow'
import assertBalance from './helpers/assertBalance'

const Registry = artifacts.require("RegistryMock")
const TrueUSD = artifacts.require("TrueUSDMock")
const ForceEther = artifacts.require("ForceEther")
const DepositAddressRegistrar = artifacts.require("DepositAddressRegistrar")

const writeAttributeFor = require('./helpers/writeAttributeFor.js')
const bytes32 = require('./helpers/bytes32.js')
const BN = web3.utils.toBN;


function depositTokenTests([owner, oneHundred, anotherAccount, thirdAddress]) {
    const notes = bytes32("some notes")
    const IS_DEPOSIT_ADDRESS = bytes32("isDepositAddress")
    const DEPOSIT_ADDRESS = web3.utils.toChecksumAddress('0x00000' + anotherAccount.slice(2,37))

    describe('--Deposit Token--', function () {
        beforeEach(async function () {
            await this.registry.setAttribute(DEPOSIT_ADDRESS, IS_DEPOSIT_ADDRESS, anotherAccount, notes, { from: owner })
        })

        it('transfer to anotherAccount', async function(){
            await this.token.transfer(anotherAccount, BN(50*10**18), {from: oneHundred})
            await assertBalance(this.token,anotherAccount, BN(50*10**18))
        })


        it('transfers a deposit address of another account forwards tokens to anotherAccount', async function(){
            const depositAddressOne = web3.utils.toChecksumAddress(anotherAccount.slice(0,37) + '00000');
            const depositAddressTwo = web3.utils.toChecksumAddress(anotherAccount.slice(0,37) + '20000');
            const depositAddressThree = web3.utils.toChecksumAddress(anotherAccount.slice(0,37) + '40000');
            const depositAddressFour = web3.utils.toChecksumAddress(anotherAccount.slice(0,37) + '00500');
            await this.token.transfer(depositAddressOne, BN(10*10**18),{from: oneHundred})
            await this.token.transfer(depositAddressTwo, BN(10*10**18), {from: oneHundred})
            await this.token.transfer(depositAddressThree, BN(10*10**18), {from: oneHundred})
            await this.token.transfer(depositAddressFour, BN(10*10**18), {from: oneHundred})
            await assertBalance(this.token,anotherAccount, BN(40*10**18))
        })

        it('emits the right events', async function(){
            const depositAddressOne = web3.utils.toChecksumAddress(anotherAccount.slice(0,37) + '00000');
            const {logs} = await this.token.transfer(depositAddressOne, BN(10*10**18),{from: oneHundred})
            assert.equal(logs[0].args.from,oneHundred)
            assert.equal(logs[0].args.to,depositAddressOne)
            assert.equal(logs[1].args.from,depositAddressOne)
            assert.equal(logs[1].args.to,anotherAccount)
        })

        it('emits the right events for mint', async function() {
            const ZERO = '0x0000000000000000000000000000000000000000';
            const depositAddressOne = web3.utils.toChecksumAddress(anotherAccount.slice(0,37) + '00000');
            const {logs} = await this.mintableToken.mint(depositAddressOne, BN(10*10**18),{from: owner})
            assert.equal(logs[0].args.to,depositAddressOne);
            assert(logs[0].args.value.eq(BN(10*10**18)));
            assert.equal(logs[1].args.from,ZERO)
            assert.equal(logs[1].args.to,depositAddressOne)
            assert.equal(logs[2].args.from,depositAddressOne)
            assert.equal(logs[2].args.to,anotherAccount)
        })

        it('can remove deposit address', async function(){
            await this.registry.setAttribute(DEPOSIT_ADDRESS, IS_DEPOSIT_ADDRESS, 0, notes, { from: owner })
            const depositAddressOne = web3.utils.toChecksumAddress(anotherAccount.slice(0,37) + '00000');
            const depositAddressTwo = web3.utils.toChecksumAddress(anotherAccount.slice(0,37) + '20000');
            const depositAddressThree = web3.utils.toChecksumAddress(anotherAccount.slice(0,37) + '40000');
            const depositAddressFour = web3.utils.toChecksumAddress(anotherAccount.slice(0,37) + '00500');
            await this.token.transfer(depositAddressOne, BN(10*10**18), {from: oneHundred})
            await this.token.transfer(depositAddressTwo, BN(10*10**18), {from: oneHundred})
            await this.token.transfer(depositAddressThree, BN(10*10**18), {from: oneHundred})
            await this.token.transfer(depositAddressFour, BN(10*10**18), {from: oneHundred})
            await assertBalance(this.token,anotherAccount, 0)
        })
        
        it('deposit tokens work with minting', async function(){
            const depositAddressOne = web3.utils.toChecksumAddress(anotherAccount.slice(0,37) + '00000');
            const depositAddressTwo = web3.utils.toChecksumAddress(anotherAccount.slice(0,37) + '20000');
            const {logs} = await this.mintableToken.mint(depositAddressOne, BN(10*10**18), {from: owner})
            await this.mintableToken.mint(depositAddressTwo, BN(10*10**18), {from: owner})
            await assertBalance(this.token,anotherAccount, BN(20*10**18))
        })


        describe('deposit token works with deposit registrar', function(){
            beforeEach(async function () {
                this.registrar = await DepositAddressRegistrar.new(this.registry.address, {from: owner})
                const canWriteToDepositAddress = writeAttributeFor(IS_DEPOSIT_ADDRESS)
                await this.registry.setAttributeValue(this.registrar.address, canWriteToDepositAddress, 1, { from: owner })
            })

            it('Registrar can register deposit address', async function(){
                await this.registrar.registerDepositAddress({from: thirdAddress})
                const depositAddressOne = web3.utils.toChecksumAddress(thirdAddress.slice(0,37) + '00000');
                const depositAddressTwo = web3.utils.toChecksumAddress(thirdAddress.slice(0,37) + '20000');
                const depositAddressThree = web3.utils.toChecksumAddress(thirdAddress.slice(0,37) + '40000');
                const depositAddressFour = web3.utils.toChecksumAddress(thirdAddress.slice(0,37) + '00500');
                await this.token.transfer(depositAddressOne, BN(10*10**18),{from: oneHundred})
                await this.token.transfer(depositAddressTwo, BN(10*10**18), {from: oneHundred})
                await this.token.transfer(depositAddressThree, BN(10*10**18), {from: oneHundred})
                await this.token.transfer(depositAddressFour, BN(10*10**18), {from: oneHundred})
                await assertBalance(this.token,thirdAddress, BN(40*10**18))
            })

            it('Registrar can register deposit address through fallback function', async function(){
                await this.registrar.sendTransaction({from: thirdAddress, gas: 900000, value: 10})
                const depositAddressOne = web3.utils.toChecksumAddress(thirdAddress.slice(0,37) + '00000');
                const depositAddressTwo = web3.utils.toChecksumAddress(thirdAddress.slice(0,37) + '20000');
                const depositAddressThree = web3.utils.toChecksumAddress(thirdAddress.slice(0,37) + '40000');
                const depositAddressFour = web3.utils.toChecksumAddress(thirdAddress.slice(0,37) + '00500');
                await this.token.transfer(depositAddressOne, BN(10*10**18),{from: oneHundred})
                await this.token.transfer(depositAddressTwo, BN(10*10**18), {from: oneHundred})
                await this.token.transfer(depositAddressThree, BN(10*10**18), {from: oneHundred})
                await this.token.transfer(depositAddressFour, BN(10*10**18), {from: oneHundred})
                await assertBalance(this.token,thirdAddress, 40*10**18)
            })

            it('cannot register for deposit address twice', async function(){
                await this.registrar.sendTransaction({from: thirdAddress, gas: 900000})
                await assertRevert(this.registrar.sendTransaction({from: thirdAddress, gas: 900000}))
            })

            it('cannot register for deposit address twice', async function(){
                await this.registrar.registerDepositAddress({from: thirdAddress})
                await assertRevert(this.registrar.registerDepositAddress({from: thirdAddress}))
            })
        })
    })
}

export default depositTokenTests
