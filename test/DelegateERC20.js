const CanDelegate = artifacts.require('CanDelegateMock')
const DelegateERC20 = artifacts.require('DelegateERC20Mock')
import standardTokenTests from './token/StandardToken';
import basicTokenTests from './token/BasicToken';

contract('DelegateERC20', function ([_, owner, oneHundred, anotherAccount]) {
    beforeEach(async function() {
        this.totalSupply = 100 * 10 ** 18
        this.original = await CanDelegate.new(oneHundred, this.totalSupply * 2, {from:owner})
        this.delegate = await DelegateERC20.new(oneHundred, this.totalSupply, {from:owner})
        await this.original.delegateToNewContract(this.delegate.address, {from:owner})
        this.token = this.original
    })

    describe('--DelegateERC20 Tests--', function() {
        describe('totalSupply', async function () {
            assert.equal(this.totalSupply, await this.delegate.delegateTotalSupply())
            assert.equal(this.totalSupply, await this.delegate.totalSupply())
            assert.equal(this.totalSupply, await this.original.totalSupply())
        })
        describe('Delegate', function() {
            this.token = this.delegate
            describe('transfers and allowances', function () {
                basicTokenTests([owner, oneHundred, anotherAccount], true)
                standardTokenTests([owner, oneHundred, anotherAccount])
            })
        })
        describe('Original', function() {
            this.token = this.original
            describe('transfers and allowances', function () {
                basicTokenTests([owner, oneHundred, anotherAccount], true)
                standardTokenTests([owner, oneHundred, anotherAccount])
            })
        })
    })

})
