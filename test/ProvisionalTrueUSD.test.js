import assertRevert from './helpers/assertRevert'
import assertBalance from './helpers/assertBalance'
import basicTokenTests from './BasicToken';

const Proxy = artifacts.require("OwnedUpgradeabilityProxy")
const PreMigrationTrueUSDMock = artifacts.require("PreMigrationTrueUSDMock")
const Registry = artifacts.require("RegistryMock")
const TrueUSDMock = artifacts.require("TrueUSDMock")
const ProvisionalRegistry = artifacts.require("ProvisionalRegistryMock")
const ProvisionalTrueUSD = artifacts.require("ProvisionalTrueUSD")

const BN = web3.utils.toBN;
const bytes32 = require('./helpers/bytes32.js');

contract('ProvisionalTrueUSD', function (accounts) {
    const [_, owner, oneHundred, anotherAccount, blacklisted] = accounts
    const DOLLAR = BN(10 ** 18)
    const BLACKLISTED = bytes32("isBlacklisted")
    const CAN_BURN = bytes32("canBurn")
    const BURN_ADDRESS = web3.utils.toChecksumAddress('0x0000000000000000000000000000000000011111')
	const SET_FUTURE_GAS_PRICE = bytes32("canSetFutureRefundMinGasPrice")

    beforeEach(async function() {
        this.registryProxy = await Proxy.new({ from: owner })
        this.provisionalRegistryImpl = await ProvisionalRegistry.new(owner, 0)
        this.registryImpl = await Registry.new();
        await this.registryProxy.upgradeTo(this.registryImpl.address, { from: owner })
        this.registry = await Registry.at(this.registryProxy.address);
        await this.registry.initialize({ from: owner });
        await this.registryProxy.upgradeTo(this.provisionalRegistryImpl.address, { from: owner })
        this.provisionalRegistry = await ProvisionalRegistry.at(this.registryProxy.address)

        await this.provisionalRegistry.setAttributeValue(blacklisted, BLACKLISTED, BN(1), { from: owner })
        await this.provisionalRegistry.setAttributeValue(anotherAccount, SET_FUTURE_GAS_PRICE, BN(1), { from: owner })

        this.tokenProxy = await Proxy.new({ from: owner })
        this.preMigrationTrueUSDImpl = await PreMigrationTrueUSDMock.new(oneHundred, 0)
        await this.tokenProxy.upgradeTo(this.preMigrationTrueUSDImpl.address, { from: owner })
        this.preMigrationToken = await PreMigrationTrueUSDMock.at(this.tokenProxy.address)
        await this.preMigrationToken.initialize({ from: owner })
        await this.preMigrationToken.setRegistry(this.provisionalRegistry.address, { from: owner })
        await this.preMigrationToken.mint(oneHundred, BN(100).mul(DOLLAR), { from: owner })
        await this.preMigrationToken.approve(anotherAccount, BN(50).mul(DOLLAR), { from: oneHundred });
        await this.preMigrationToken.setBurnBounds(BN(1), BN(100).mul(DOLLAR), { from: owner })
        await this.preMigrationToken.setMinimumGasPriceForFutureRefunds(1000, { from: anotherAccount })
        await this.preMigrationToken.sponsorGas()
        this.token = this.preMigrationToken;
    })

    describe('before upgrade', function() {
        it('heeds prior attributes', async function() {
            await assertRevert(this.preMigrationToken.transfer(blacklisted, BN(50).mul(DOLLAR), { from: oneHundred }))
        })
        it('has correct balance', async function() {
            await assertBalance(this.preMigrationToken, oneHundred, BN(100).mul(DOLLAR))
        })
        it('has correct allowance', async function() {
            let allowance = await this.preMigrationToken.allowance.call(oneHundred, anotherAccount);
            assert(BN(50).mul(DOLLAR).eq(allowance), 'pre-migration allowance is incorrect');
        })
        basicTokenTests([owner, oneHundred, anotherAccount])
    })

    describe('during upgrade', function() {
        beforeEach(async function() {
            this.provisionalTokenImpl = await ProvisionalTrueUSD.new();
            await this.tokenProxy.upgradeTo(this.provisionalTokenImpl.address, { from: owner })
            this.provisionalToken = await ProvisionalTrueUSD.at(this.tokenProxy.address);
            this.token = this.provisionalToken;
        })
        it('heeds prior attributes', async function() {
            await assertRevert(this.provisionalToken.transfer(blacklisted, BN(50).mul(DOLLAR), { from: oneHundred }))
        })
        it('has correct balance', async function() {
            await assertBalance(this.preMigrationToken, oneHundred, BN(100).mul(DOLLAR))
        })
        it('has correct allowance', async function() {
            let allowance = await this.preMigrationToken.allowance.call(oneHundred, anotherAccount);
            assert(BN(50).mul(DOLLAR).eq(allowance), 'pre-migration allowance is incorrect');
        })
        basicTokenTests([owner, oneHundred, anotherAccount])

        describe('balance and allowance migration', function() {
            it('is not pre-migrated', async function() {
                const preMigratedBalance = await this.provisionalToken.migratedBalanceOf(oneHundred)
                assert(BN(0).eq(preMigratedBalance), 'balance migrated already')
                const preMigratedAllowance = await this.provisionalToken.migratedAllowance.call(oneHundred, anotherAccount)
                assert(BN(0).eq(preMigratedAllowance), 'allowance migrated already')
            })
            it('migrates balances manually', async function() {
                await this.provisionalToken.migrateBalances([oneHundred])
                const migratedBalance = await this.provisionalToken.migratedBalanceOf.call(oneHundred)
                assert(BN(100).mul(DOLLAR).eq(migratedBalance), 'balance not migrated')
            })
            it('migrates balances manually with refund', async function() {
                await this.provisionalToken.migrateBalances([oneHundred], {from: oneHundred, gasPrice: 1001})
                const migratedBalance = await this.provisionalToken.migratedBalanceOf.call(oneHundred)
                assert(BN(100).mul(DOLLAR).eq(migratedBalance), 'balance not migrated')
            })
            it('transfers migrate balances', async function() {
                await this.provisionalToken.transfer(anotherAccount, BN(40).mul(DOLLAR), { from: oneHundred })
                const migratedBalanceFrom = await this.provisionalToken.migratedBalanceOf.call(oneHundred)
                assert(BN(60).mul(DOLLAR).eq(migratedBalanceFrom), 'from balance not migrated')
                const migratedBalanceTo = await this.provisionalToken.migratedBalanceOf.call(anotherAccount)
                assert(BN(40).mul(DOLLAR).eq(migratedBalanceTo), 'to balance not migratred')
            })
            it('migrates allowances manually', async function() {
                await this.provisionalToken.migrateAllowances([oneHundred], [anotherAccount])
                const migratedAllowance = await this.provisionalToken.migratedAllowance.call(oneHundred, anotherAccount)
                assert(BN(50).mul(DOLLAR).eq(migratedAllowance), 'allowance not migrated')
            })
            it('transferFrom migrates balances and allowance', async function() {
                await this.provisionalToken.transferFrom(oneHundred, anotherAccount, BN(40).mul(DOLLAR), { from: anotherAccount })
                const migratedAllowance = await this.provisionalToken.migratedAllowance.call(oneHundred, anotherAccount)
                assert(BN(10).mul(DOLLAR).eq(migratedAllowance), 'allowance not migrated')
                const migratedBalanceFrom = await this.provisionalToken.migratedBalanceOf.call(oneHundred)
                assert(BN(60).mul(DOLLAR).eq(migratedBalanceFrom), 'from balance not migrated')
                const migratedBalanceTo = await this.provisionalToken.migratedBalanceOf.call(anotherAccount)
                assert(BN(40).mul(DOLLAR).eq(migratedBalanceTo) ,'to balance not migrated')
            })
            it('transferFrom migrates balances and allowance', async function() {
                await this.provisionalToken.transferFrom(oneHundred, anotherAccount, BN(40).mul(DOLLAR), { from: anotherAccount })
                const migratedAllowance = await this.provisionalToken.migratedAllowance.call(oneHundred, anotherAccount)
                assert(BN(10).mul(DOLLAR).eq(migratedAllowance))
                const migratedBalanceFrom = await this.provisionalToken.migratedBalanceOf.call(oneHundred)
                assert(BN(60).mul(DOLLAR).eq(migratedBalanceFrom))
                const migratedBalanceTo = await this.provisionalToken.migratedBalanceOf.call(anotherAccount)
                assert(BN(40).mul(DOLLAR).eq(migratedBalanceTo))
            })
            describe('burns', function() {
                beforeEach(async function() {
                    await this.provisionalRegistry.setAttributeValue(BURN_ADDRESS, CAN_BURN, BN(1), { from: owner });
                    await this.provisionalRegistry.setAttributeValue(oneHundred, CAN_BURN, BN(1), { from: owner });
                })
                it('transferFrom burns migrates balances and allowance', async function() {
                    await this.provisionalToken.transferFrom(oneHundred, BURN_ADDRESS, BN(40).mul(DOLLAR), { from: anotherAccount })
                    const migratedAllowance = await this.provisionalToken.migratedAllowance.call(oneHundred, anotherAccount)
                    assert(BN(10).mul(DOLLAR).eq(migratedAllowance))
                    const migratedBalanceFrom = await this.provisionalToken.migratedBalanceOf.call(oneHundred)
                    assert(BN(60).mul(DOLLAR).eq(migratedBalanceFrom))
                    const supply = await this.provisionalToken.totalSupply.call()
                    assert(BN(60).mul(DOLLAR).eq(supply), 'supply change after transferFrom burn')
                })
                it('transfer burns migrates balances', async function() {
                    await this.provisionalToken.transfer(BURN_ADDRESS, BN(40).mul(DOLLAR), { from: oneHundred })
                    const balanceFrom = await this.provisionalToken.balanceOf.call(oneHundred)
                    assert(BN(60).mul(DOLLAR).eq(balanceFrom))
                    const migratedBalanceFrom = await this.provisionalToken.migratedBalanceOf.call(oneHundred)
                    assert(BN(60).mul(DOLLAR).eq(migratedBalanceFrom), 'balance should migrate in transfer')
                    const supply = await this.provisionalToken.totalSupply.call()
                    assert(BN(60).mul(DOLLAR).eq(supply), 'supply change after transferFrom burn')
                })
                it('burns migrates balances', async function() {
                    await this.provisionalToken.burn(BN(40).mul(DOLLAR), { from: oneHundred })
                    const balanceFrom = await this.provisionalToken.balanceOf.call(oneHundred)
                    assert(BN(60).mul(DOLLAR).eq(balanceFrom))
                    const migratedBalanceFrom = await this.provisionalToken.migratedBalanceOf.call(oneHundred)
                    assert(BN(60).mul(DOLLAR).eq(migratedBalanceFrom), 'balance should migrate in transfer')
                    const supply = await this.provisionalToken.totalSupply.call()
                    assert(BN(60).mul(DOLLAR).eq(supply), 'supply change after transferFrom burn')
                })
            })
            describe('mints', function() {
                it('mints migrate balances', async function() {
                    await this.provisionalToken.mint(oneHundred, BN(100).mul(DOLLAR), { from: owner })
                    const migratedBalanceFrom = await this.provisionalToken.migratedBalanceOf.call(oneHundred)
                    assert(BN(200).mul(DOLLAR).eq(migratedBalanceFrom), "mint balance not migrated")
                })
            })
        })
        describe('registry migration', function() {
            beforeEach(async function() {
                await this.provisionalRegistry.subscribe(BLACKLISTED, this.provisionalToken.address, { from: owner })
            })
            it('reads unsynced registry during migration', async function() {
                await assertRevert(this.provisionalToken.transfer(blacklisted, DOLLAR, { from: oneHundred }))
            })
            it('syncs registry values', async function() {
                await this.provisionalRegistry.syncAttribute(BLACKLISTED, 0, [blacklisted])
                await this.registryProxy.upgradeTo(this.registryImpl.address, { from: owner })
                await assertRevert(this.provisionalToken.transfer(blacklisted, DOLLAR, { from: oneHundred }))
            })
            it('new writes sync', async function() {
                await this.provisionalRegistry.setAttributeValue(oneHundred, BLACKLISTED, BN(1), { from: owner })
                await this.registryProxy.upgradeTo(this.registryImpl.address, { from: owner })
                await assertRevert(this.provisionalToken.transfer(owner, DOLLAR, { from: oneHundred }))
            })
        })
        describe('after token upgrade', function() {
            beforeEach(async function() {
                await this.provisionalToken.migrateBalances([oneHundred])
                await this.provisionalToken.migrateAllowances([oneHundred], [anotherAccount])
                this.tusdImpl = await TrueUSDMock.new(owner, 0)
                await this.tokenProxy.upgradeTo(this.tusdImpl.address, { from: owner })
                this.token = await TrueUSDMock.at(this.tokenProxy.address)
            })
            it('has the correct balance', async function() {
                await assertBalance(this.token, oneHundred, BN(100).mul(DOLLAR))
            })
            it('has the correct allowance', async function() {
                const allowance = await this.token.allowance(oneHundred, anotherAccount)
                assert(allowance.eq(BN(50).mul(DOLLAR)), 'allowance is ' + allowance)
            })
        })
    })
})
