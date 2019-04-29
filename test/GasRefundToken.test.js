import assertRevert from './helpers/assertRevert'
import expectThrow from './helpers/expectThrow'
import assertBalance from './helpers/assertBalance'

const Registry = artifacts.require("RegistryMock")
const TrueUSD = artifacts.require("TrueUSDMock")

const bytes32 = require('./helpers/bytes32.js')
const BN = web3.utils.toBN;

contract('GasRefundToken', function (accounts) {
    const [_, owner, oneHundred, anotherAccount] = accounts
    const notes = bytes32("some notes")
    const FIFTY = BN(50*10**18);
    const SET_FUTURE_GAS_PRICE = bytes32("canSetFutureRefundMinGasPrice")

    describe('--Gas Refund Token--', function () {
        beforeEach(async function () {
            this.registry = await Registry.new({ from: owner })
            this.token = await TrueUSD.new(owner, 0, { from: owner })
            await this.token.setRegistry(this.registry.address, { from: owner })

            await this.token.mint(oneHundred, BN(100*10**18), { from: owner })
            await this.registry.setAttributeValue(oneHundred, SET_FUTURE_GAS_PRICE, 1, { from: owner });
        })

        it('blocks others from setting the minimum refund gas price', async function() {
            await assertRevert(this.token.setMinimumGasPriceForFutureRefunds(BN(1)), { from: anotherAccount });
        })

        it('transfer to anotherAccount without gas refund', async function() {
            const receipt = await this.token.transfer(anotherAccount, FIFTY, {from: oneHundred})
            await assertBalance(this.token,anotherAccount, FIFTY)
            await this.token.setMinimumGasPriceForFutureRefunds(1e3, { from: oneHundred });
            await this.token.sponsorGas();
            assert.equal(await this.token.remainingGasRefundPool(), 9, "pool should have 9");
            const noRefundTx = await this.token.transfer(oneHundred, BN(10*10**18), { from: anotherAccount, gasPrice: 1000 });
            assert.equal(await this.token.remainingGasRefundPool(), 9, "pool should still have 9");
            const withRefundTx = await this.token.transfer(oneHundred, BN(10*10**18), { from: anotherAccount, gasPrice: 1001 });
            assert.equal(await this.token.remainingGasRefundPool(), 7, "pool should now have 7");
            assert.isBelow(withRefundTx.receipt.gasUsed, noRefundTx.receipt.gasUsed, "Less gas used with refund");
        })


        it('transfer to anotherAccount with gas refund', async function(){
            await this.token.transfer(anotherAccount, BN(1), {from: oneHundred, gasPrice: 1001, gasLimit: 150000})
            await this.token.setMinimumGasPriceForFutureRefunds(BN(1e3), { from: oneHundred });
            await this.token.sponsorGas({from: anotherAccount})
            await this.token.sponsorGas({from: anotherAccount})
            for (let i = 0; i < 18; i++) {
              assert((await this.token.gasRefundPool.call(i)).eq(BN(1e3)));
            }
            assert((await this.token.remainingGasRefundPool.call()).eq(BN(18)))
            const receipt = await this.token.transfer(anotherAccount, FIFTY.sub(BN(1)), {from: oneHundred, gasPrice: 1001, gasLimit: 150000})
            const remainingPool1 = await this.token.remainingGasRefundPool.call()
            assert(remainingPool1.eq(BN(16)), "pool should have 16, instead " + remainingPool1)
            await assertBalance(this.token,anotherAccount, FIFTY, "should have received $50")
            await this.token.approve(oneHundred, FIFTY, { from: anotherAccount });
            await this.token.transferFrom(anotherAccount, oneHundred, FIFTY, { from: oneHundred, gasPrice: 1001, gasLimit: 200000 });
            const remainingPool2 = await this.token.remainingGasRefundPool.call()
            assert(remainingPool2.eq(BN(16)), "pool should have 16, instead " + remainingPool2);
        })

        it('sponsorGas2', async function() {
            const reduceToNewNoRefund = await this.token.transfer(anotherAccount, BN(20*10**18), { from: oneHundred })
            const poolSizeBefore = await web3.eth.getStorageAt(this.token.address, '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
            assert.equal(poolSizeBefore, '0x0')
            await this.token.sponsorGas2()
            const poolSizeAfter = await web3.eth.getStorageAt(this.token.address, '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
            assert.equal(poolSizeAfter, '0x03')
            const firstContract = await web3.eth.getStorageAt(this.token.address, '0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe')
            assert(firstContract != '0x0', 'null first contract')
            const secondContract = await web3.eth.getStorageAt(this.token.address, '0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffd')
            assert(secondContract != '0x0', 'null second contract')
            const thirdContract = await web3.eth.getStorageAt(this.token.address, '0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffc')
            assert(thirdContract != '0x0', 'null third contract')
            assert(firstContract != secondContract, 'first and second contracts are the same')
            assert(secondContract != thirdContract, 'second and third contracts are the same')
            assert(firstContract != thirdContract, 'first and third contracts are the same')
            for (let contract of [firstContract, secondContract, thirdContract]) {
                const sheepCode = await web3.eth.getCode(contract)
                assert.equal(sheepCode.length, 56, 'sheep wrong size');
                const Sheep = await TrueUSD.at(contract)
                // verify that calling the sheep improperly causes revert or assert
                await assertRevert(Sheep.totalSupply(), {from: anotherAccount})
            }
            const reduceToNewWithRefund = await this.token.transfer(owner, BN(20*10**18), { from: oneHundred })
            const poolSizeUsed = await web3.eth.getStorageAt(this.token.address, '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
            assert.equal(poolSizeUsed, '0x02')
            assert.isBelow(reduceToNewWithRefund.receipt.gasUsed, reduceToNewNoRefund.receipt.gasUsed)
            const selfdestructCode = await web3.eth.getCode(thirdContract)
            assert.equal(selfdestructCode,'0x', 'contract did not self destruct');
        })
    })
})
