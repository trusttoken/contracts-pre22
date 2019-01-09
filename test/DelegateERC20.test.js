const CanDelegate = artifacts.require('CanDelegateMock')
const TrueUSD = artifacts.require('TrueUSDMock')
import standardTokenTests from './token/StandardToken';
const Registry = artifacts.require("Registry")

contract('DelegateERC20', function ([_, owner, oneHundred, anotherAccount]) {
    beforeEach(async function() {
        this.totalSupply = 100 * 10 ** 18
        this.original = await CanDelegate.new(oneHundred, this.totalSupply, {from:owner})
        this.BalanceSheetAddress = await this.original.balances.call()
        this.AllowanceSheetAddress = await this.original.allowances.call()
        this.delegate = await TrueUSD.new(owner, this.totalSupply, { from: owner })
        this.registry = await Registry.new({ from: owner })

        await this.original.transferChild(this.BalanceSheetAddress,this.delegate.address, { from: owner })

        await this.original.transferChild(this.AllowanceSheetAddress, this.delegate.address, { from: owner })

        await this.delegate.setBalanceSheet(this.BalanceSheetAddress, { from: owner })

        await this.delegate.setAllowanceSheet(this.AllowanceSheetAddress, { from: owner })
        await this.delegate.setRegistry(this.registry.address, { from: owner })
        await this.original.delegateToNewContract(this.delegate.address, {from:owner})
    })

    describe('--DelegateERC20 Tests--', function() {
        it('shares totalSupply', async function () {
            assert.equal(this.totalSupply, Number(await this.delegate.delegateTotalSupply.call()))
            assert.equal(this.totalSupply, Number(await this.delegate.totalSupply.call()))
            assert.equal(this.totalSupply, Number(await this.original.totalSupply.call()))
        })

        describe('Delegate', function(){
            beforeEach(async function() {
                this.token = this.delegate
            })
            standardTokenTests([owner, oneHundred, anotherAccount])    
        })
    })
})
