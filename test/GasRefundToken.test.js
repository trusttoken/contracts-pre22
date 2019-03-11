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

            await this.registry.setAttribute(oneHundred, bytes32("hasPassedKYC/AML"), 1, notes, { from: owner })
            await this.token.mint(oneHundred, BN(100*10**18), { from: owner })
            await this.registry.setAttribute(oneHundred, bytes32("hasPassedKYC/AML"), 0, notes, { from: owner })
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
            assert.equal(await this.token.remainingGasRefundPool(), 9);
            const noRefundTx = await this.token.transfer(oneHundred, BN(10*10**18), { from: anotherAccount, gasPrice: 1000 });
            assert.equal(await this.token.remainingGasRefundPool(), 9);
            const withRefundTx = await this.token.transfer(oneHundred, BN(10*10**18), { from: anotherAccount, gasPrice: 1001 });
            assert.equal(await this.token.remainingGasRefundPool(), 6);
            assert.isBelow(withRefundTx.receipt.gasUsed, noRefundTx.receipt.gasUsed, "Less gas used with refund");
            assert.isAbove(noRefundTx.receipt.gasUsed - withRefundTx.receipt.gasUsed, 23245, "Effective refund has regressed");
        })


        it('transfer to anotherAccount with gas refund', async function(){
            await this.token.setMinimumGasPriceForFutureRefunds(BN(1e3), { from: oneHundred });
            await this.token.sponsorGas({from: anotherAccount})
            await this.token.sponsorGas({from: anotherAccount})
            for (let i = 0; i < 18; i++) {
              assert((await this.token.gasRefundPool.call(i)).eq(BN(1e3)));
            }
            assert((await this.token.remainingGasRefundPool.call()).eq(BN(18)))
            assert((await this.token.remainingSponsoredTransactions.call()).eq(BN(6)));
            //truffle has no gas refund so this receipt of gas used is not accurate
            const receipt = await this.token.transfer(anotherAccount, FIFTY, {from: oneHundred, gasPrice: 1001, gasLimit: 150000})
            assert((await this.token.remainingGasRefundPool.call()).eq(BN(15)))
            assert((await this.token.remainingSponsoredTransactions.call()).eq(BN(5)));
            await assertBalance(this.token,anotherAccount, FIFTY)
            await this.token.approve(oneHundred, FIFTY, { from: anotherAccount });
            await this.token.transferFrom(anotherAccount, oneHundred, FIFTY, { from: oneHundred, gasPrice: 1001, gasLimit: 200000 });
            assert((await this.token.remainingGasRefundPool.call()).eq(BN(12)));
            assert((await this.token.remainingSponsoredTransactions.call()).eq(BN(4)));
        })
    })
})
