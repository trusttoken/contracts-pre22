import assertRevert from './helpers/assertRevert'
import expectThrow from './helpers/expectThrow'
import assertBalance from './helpers/assertBalance'

const Registry = artifacts.require("RegistryMock")
const TrueUSD = artifacts.require("TrueUSDMock")
const BalanceSheet = artifacts.require("BalanceSheet")
const AllowanceSheet = artifacts.require("AllowanceSheet")

const bytes32 = require('./helpers/bytes32.js')
const BN = web3.utils.toBN;

contract('GasRefundToken', function (accounts) {
    const [_, owner, oneHundred, anotherAccount] = accounts
    const notes = bytes32("some notes")
    const FIFTY = BN(50*10**18);

    describe('--Gas Refund Token--', function () {
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

            await this.token.mint(oneHundred, BN(100*10**18), { from: owner })
            await this.registry.setAttributeValue(oneHundred, bytes32("canSetFutureRefundMinGasPrice"), 1, { from: owner });
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
            await this.token.setMinimumGasPriceForFutureRefunds(BN(1e3), { from: oneHundred });
            await this.token.sponsorGas({from: anotherAccount})
            await this.token.sponsorGas({from: anotherAccount})
            for (let i = 0; i < 18; i++) {
              assert((await this.token.gasRefundPool.call(i)).eq(BN(1e3)));
            }
            assert((await this.token.remainingGasRefundPool.call()).eq(BN(18)))
            const receipt = await this.token.transfer(anotherAccount, FIFTY, {from: oneHundred, gasPrice: 1001, gasLimit: 150000})
            const remainingPool1 = await this.token.remainingGasRefundPool.call()
            assert(remainingPool1.eq(BN(15)), "pool should have 15, instead " + remainingPool1)
            await assertBalance(this.token,anotherAccount, FIFTY, "should have received $50")
            await this.token.approve(oneHundred, FIFTY, { from: anotherAccount });
            await this.token.transferFrom(anotherAccount, oneHundred, FIFTY, { from: oneHundred, gasPrice: 1001, gasLimit: 200000 });
            const remainingPool2 = await this.token.remainingGasRefundPool.call()
            assert(remainingPool2.eq(BN(15)), "pool should have 15, instead " + remainingPool2);
        })
    })
})
