const CanDelegate = artifacts.require('CanDelegateMock')
const TrueUSD = artifacts.require('TrueUSD')
import standardTokenTests from './token/StandardToken';
const Registry = artifacts.require("Registry")

contract('DelegateERC20', function ([_, owner, oneHundred, anotherAccount]) {
    beforeEach(async function() {
        this.totalSupply = 100 * 10 ** 18
        this.original = await CanDelegate.new(oneHundred, this.totalSupply, {from:owner})
        this.BalanceSheetAddress = await this.original.balances()
        this.AllowanceSheetAddress = await this.original.allowances()
        this.delegate = await TrueUSD.new({ from: owner })
        this.registry = await Registry.new({ from: owner })

        await this.delegate.initialize({ from: owner })
        await this.delegate.setTotalSupply(this.totalSupply, { from: owner })
        await this.original.transferChild(this.BalanceSheetAddress,this.delegate.address, { from: owner })

        await this.original.transferChild(this.AllowanceSheetAddress, this.delegate.address, { from: owner })

        await this.delegate.setBalanceSheet(this.BalanceSheetAddress, { from: owner })

        await this.delegate.setAllowanceSheet(this.AllowanceSheetAddress, { from: owner })
        await this.delegate.setRegistry(this.registry.address, { from: owner })
        await this.original.delegateToNewContract(this.delegate.address, {from:owner})
    })

    describe('--DelegateERC20 Tests--', function() {
        it('shares totalSupply', async function () {
            assert.equal(this.totalSupply, Number(await this.delegate.delegateTotalSupply()))
            assert.equal(this.totalSupply, Number(await this.delegate.totalSupply()))
            assert.equal(this.totalSupply, Number(await this.original.totalSupply()))
        })

        describe('Delegate', function(){
            beforeEach(async function() {
                this.token = this.delegate
            })
            standardTokenTests([owner, oneHundred, anotherAccount])    
        })
    })
})
