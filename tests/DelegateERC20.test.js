const CanDelegate = artifacts.require('CanDelegateMock')
const TrueUSD = artifacts.require('TrueUSDMock')
import standardTokenTests from './StandardToken';
import basicTokenTests from './BasicToken';
import compliantTokenTests from './CompliantToken';
import depositTokenTests from './DepositToken'
import redeemTokenTests from './RedeemToken';
const Registry = artifacts.require("RegistryMock")

const BN = web3.utils.toBN;
const bytes32 = require('./helpers/bytes32.js')
const IS_DEPOSIT_ADDRESS = bytes32("isDepositAddress")

contract('DelegateERC20', function ([_, owner, oneHundred, anotherAccount, thirdAddress]) {
    beforeEach(async function() {
        this.totalSupply = BN(100 * 10 ** 18)
        this.original = await CanDelegate.new(oneHundred, this.totalSupply, {from:owner})
        this.delegate = await TrueUSD.new(oneHundred, this.totalSupply, { from: owner })
        this.mintableToken = this.delegate;
        this.registry = await Registry.new({ from: owner })
        await this.delegate.setRegistry(this.registry.address, { from: owner })
        await this.registry.subscribe(bytes32("isBlacklisted"), this.delegate.address, { from: owner });
        await this.registry.subscribe(bytes32("canBurn"), this.delegate.address, { from: owner });
        await this.registry.subscribe(IS_DEPOSIT_ADDRESS, this.delegate.address, { from: owner })
        await this.original.delegateToNewContract(this.delegate.address, {from:owner})
        await this.delegate.setDelegateFrom(this.original.address);
        await this.delegate.setBurnBounds(BN(5*10**18), BN(1000).mul(BN(10**18)), { from: owner }) 
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
            basicTokenTests([owner, oneHundred, anotherAccount])
            standardTokenTests([owner, oneHundred, anotherAccount])
            compliantTokenTests([owner, oneHundred, anotherAccount])
            redeemTokenTests([owner, oneHundred, anotherAccount])
            depositTokenTests([owner, oneHundred, anotherAccount, thirdAddress])
        })
        describe('Original', function() {
            beforeEach(async function() {
                this.token = this.original;
            })
            basicTokenTests([owner, oneHundred, anotherAccount])
            standardTokenTests([owner, oneHundred, anotherAccount])
            compliantTokenTests([owner, oneHundred, anotherAccount])
            redeemTokenTests([owner, oneHundred, anotherAccount])
            depositTokenTests([owner, oneHundred, anotherAccount, thirdAddress])
        })
    })
})
