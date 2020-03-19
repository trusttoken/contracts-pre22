import assertRevert from '../helpers/assertRevert'
import expectThrow from '../helpers/expectThrow'
import { isTopic } from 'web3-utils';
const BN = web3.utils.toBN;
const bytes32 = require('../helpers/bytes32.js')
const TrueUSDMock = artifacts.require("TrueUSDMock")
const FinancialOpportunityMock = artifacts.require("FinancialOpportunityMock")
const Registry = artifacts.require('RegistryMock')
const CompliantTokenMock = artifacts.require('CompliantTokenMock')
const ATokenMock = artifacts.require('ATokenMock')
const LendingPoolMock = artifacts.require('LendingPoolMock')
const LendingPoolCoreMock = artifacts.require('LendingPoolCoreMock')
const AaveFinancialOpportunity = artifacts.require('AaveFinancialOpportunity')
const OwnedUpgradeabilityProxy = artifacts.require('OwnedUpgradeabilityProxy')

const to18Decimals = value => BN(Math.floor(value*10**10)).mul(BN(10**8))
const to27Decimals = value => BN(Math.floor(value*10**10)).mul(BN(10**17))


contract('TrueRewardBackedToken', function (accounts) {
    const [_, owner, holder, holder2, sender, receipient] = accounts
    describe('TrueReward with float admin', function(){
        beforeEach(async function () {
            this.registry = await Registry.new({ from: owner })
            this.token = await TrueUSDMock.new(holder, to18Decimals(500), { from: owner })
            await this.token.setRegistry(this.registry.address, { from: owner })
            
            this.lendingPoolCore = await LendingPoolCoreMock.new({ from: owner })
            this.sharesToken = await ATokenMock.new(this.token.address, this.lendingPoolCore.address, { from: owner })
            this.lendingPool = await LendingPoolMock.new(this.lendingPoolCore.address, this.sharesToken.address, { from: owner })

            await this.token.transfer(this.sharesToken.address, to18Decimals(100), { from: holder })

            this.financialOpportunityImpl = await AaveFinancialOpportunity.new({ from: owner })
            this.financialOpportunityProxy = await OwnedUpgradeabilityProxy.new({ from: owner })
            this.financialOpportunity = await AaveFinancialOpportunity.at(this.financialOpportunityProxy.address)
            await this.financialOpportunityProxy.upgradeTo(this.financialOpportunityImpl.address, { from: owner })
            await this.financialOpportunity.configure(this.sharesToken.address, this.lendingPool.address, this.token.address, this.token.address, { from: owner })
            await this.token.setAaveInterfaceAddress(this.financialOpportunity.address, {from: owner})
            this.reserve = await this.token.RESERVE.call();
        })

        it('convert TUSD reserve into aave float reserve', async function() {
            await this.token.transfer(this.reserve, to18Decimals(200), { from: holder })
            let reserveZTUSDBalance = await this.token.zTUSDReserveBalance.call()
            assert.equal(reserveZTUSDBalance, 0)
            await this.token.convertToZTUSDReserve(to18Decimals(100), {from: owner})
            reserveZTUSDBalance = await this.token.zTUSDReserveBalance.call()
            assert.equal(Number(reserveZTUSDBalance), to18Decimals(100))
            const reserveTUSDBalance = await this.token.balanceOf.call(this.reserve)
            assert.equal(Number(reserveTUSDBalance), to18Decimals(100))
        })

        it('convert aave float reserve back to TUSD', async function() {
            await this.token.transfer(this.reserve, to18Decimals(200), { from: holder })
            await this.token.convertToZTUSDReserve(to18Decimals(100), {from: owner})
            await this.token.convertToTrueCurrencyReserve(to18Decimals(50), {from: owner})
            const reserveZTUSDBalance = await this.token.zTUSDReserveBalance.call()
            assert.equal(Number(reserveZTUSDBalance), to18Decimals(50))
            const reserveTUSDBalance = await this.token.balanceOf.call(this.reserve)
            assert.equal(Number(reserveTUSDBalance), to18Decimals(150))
        })
    })
    describe('TrueReward with float transfers', function(){
        beforeEach(async function () {
            this.registry = await Registry.new({ from: owner })
            this.token = await TrueUSDMock.new(holder, to18Decimals(500), { from: owner })
            await this.token.setRegistry(this.registry.address, { from: owner })
            
            this.lendingPoolCore = await LendingPoolCoreMock.new({ from: owner })
            this.sharesToken = await ATokenMock.new(this.token.address, this.lendingPoolCore.address, { from: owner })
            this.lendingPool = await LendingPoolMock.new(this.lendingPoolCore.address, this.sharesToken.address, { from: owner })
            
            await this.token.transfer(this.sharesToken.address, to18Decimals(100), { from: holder })
            await this.token.transfer(holder2, to18Decimals(100), { from: holder })
        
            this.financialOpportunityImpl = await AaveFinancialOpportunity.new({ from: owner })
            this.financialOpportunityProxy = await OwnedUpgradeabilityProxy.new({ from: owner })
            this.financialOpportunity = await AaveFinancialOpportunity.at(this.financialOpportunityProxy.address)
            await this.financialOpportunityProxy.upgradeTo(this.financialOpportunityImpl.address, { from: owner })
            await this.financialOpportunity.configure(this.sharesToken.address, this.lendingPool.address, this.token.address, this.token.address, { from: owner })
            await this.token.setAaveInterfaceAddress(this.financialOpportunity.address, {from: owner})
            this.reserve = await this.token.RESERVE.call();
            await this.token.transfer(this.reserve, to18Decimals(200), { from: holder })
            await this.token.convertToZTUSDReserve(to18Decimals(100), {from: owner})
        })
        it('transfer without trueReward', async function(){
            await this.token.transfer(sender, to18Decimals(100), { from: holder })
            const {logs} = await this.token.transfer(receipient, to18Decimals(50), {from: sender})
            const senderBalance = await this.token.balanceOf.call(sender);
            const receipientBalance = await this.token.balanceOf.call(receipient);
            const TUSDReserveBalance = await this.token.balanceOf.call(this.reserve);
            const zTUSDReserveBalance = await this.token.zTUSDReserveBalance.call();
            console.log('senderBalance',Number(senderBalance))
            console.log('receipientBalance',Number(receipientBalance))
            console.log('TUSDReserveBalance',Number(TUSDReserveBalance))
            console.log('zTUSDReserveBalance',Number(zTUSDReserveBalance))
        })

        it('sender truereward enabled receipient not enabled', async function(){
            await this.token.transfer(sender, to18Decimals(100), { from: holder })
            await this.token.enableTrueReward({from: sender})
            const {logs} = await this.token.transfer(receipient, to18Decimals(50), {from: sender})
            const senderBalance = await this.token.balanceOf.call(sender);
            const receipientBalance = await this.token.balanceOf.call(receipient);
            const TUSDReserveBalance = await this.token.balanceOf.call(this.reserve);
            const zTUSDReserveBalance = await this.token.zTUSDReserveBalance.call();
            console.log('senderBalance',Number(senderBalance))
            console.log('receipientBalance',Number(receipientBalance))
            console.log('TUSDReserveBalance',Number(TUSDReserveBalance))
            console.log('zTUSDReserveBalance',Number(zTUSDReserveBalance))
        })

        it('sender truereward not enabled receipient enabled', async function(){
            await this.token.transfer(sender, to18Decimals(100), { from: holder })
            await this.token.enableTrueReward({from: receipient})
            const {logs} = await this.token.transfer(receipient, to18Decimals(50), {from: sender})
            const senderBalance = await this.token.balanceOf.call(sender);
            const receipientBalance = await this.token.balanceOf.call(receipient);
            const TUSDReserveBalance = await this.token.balanceOf.call(this.reserve);
            const zTUSDReserveBalance = await this.token.zTUSDReserveBalance.call();
            console.log('senderBalance',Number(senderBalance))
            console.log('receipientBalance',Number(receipientBalance))
            console.log('TUSDReserveBalance',Number(TUSDReserveBalance))
            console.log('zTUSDReserveBalance',Number(zTUSDReserveBalance))
        })

        it('sender truereward enabled receipient enabled', async function(){
            await this.token.transfer(sender, to18Decimals(100), { from: holder })
            await this.token.enableTrueReward({from: sender})
            await this.token.enableTrueReward({from: receipient})
            const {logs} = await this.token.transfer(receipient, to18Decimals(50), {from: sender})
            const senderBalance = await this.token.balanceOf.call(sender);
            const receipientBalance = await this.token.balanceOf.call(receipient);
            const TUSDReserveBalance = await this.token.balanceOf.call(this.reserve);
            const zTUSDReserveBalance = await this.token.zTUSDReserveBalance.call();
            console.log('senderBalance',Number(senderBalance))
            console.log('receipientBalance',Number(receipientBalance))
            console.log('TUSDReserveBalance',Number(TUSDReserveBalance))
            console.log('zTUSDReserveBalance',Number(zTUSDReserveBalance))
        })
    })
})
