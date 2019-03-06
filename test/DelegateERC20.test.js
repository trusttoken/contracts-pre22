const CanDelegate = artifacts.require('CanDelegateMock')
const TrueUSD = artifacts.require('TrueUSDMock')
import standardTokenTests from './token/StandardToken';
const Registry = artifacts.require("RegistryMock")

const BN = web3.utils.toBN;

contract('DelegateERC20', function ([_, owner, oneHundred, anotherAccount]) {
    beforeEach(async function() {
        this.totalSupply = BN(100 * 10 ** 18)
        this.original = await CanDelegate.new(oneHundred, this.totalSupply, {from:owner})
        this.BalanceSheetAddress = await this.original.balances.call()
        this.AllowanceSheetAddress = await this.original.allowances.call()
        this.delegate = await TrueUSD.new(oneHundred, this.totalSupply, { from: owner })
        this.registry = await Registry.new({ from: owner })

        await this.original.transferChild(this.BalanceSheetAddress, this.delegate.address, { from: owner })

        await this.original.transferChild(this.AllowanceSheetAddress, this.delegate.address, { from: owner })

        await this.delegate.setBalanceSheet(this.BalanceSheetAddress, { from: owner })

        await this.delegate.setAllowanceSheet(this.AllowanceSheetAddress, { from: owner })
        await this.delegate.setRegistry(this.registry.address, { from: owner })
        await this.original.delegateToNewContract(this.delegate.address, {from:owner})
    })

    describe('--DelegateERC20 Tests--', function() {
        it('shares totalSupply', async function () {
            assert(this.totalSupply.eq(await this.delegate.delegateTotalSupply.call()))
            assert(this.totalSupply.eq(await this.delegate.totalSupply.call()))
            assert(this.totalSupply.eq(await this.original.totalSupply.call()))
        })
        it('shares initial balance', async function() {
            assert(this.totalSupply.eq(await this.delegate.balanceOf(oneHundred)), 'delegate balance mismatch');
        })
        it('shares initial balance with original', async function() {
            assert(this.totalSupply.eq(await this.original.balanceOf(oneHundred)), 'original balance mismatch');
        })
        describe('Delegate', function(){
            beforeEach(async function() {
                this.token = this.delegate
            })
            standardTokenTests([owner, oneHundred, anotherAccount])    
        })
    })
})
