import assertRevert from '../helpers/assertRevert'
import expectThrow from '../helpers/expectThrow'
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
    const [_, owner, holder, holder2, sender, receipient, address3] = accounts
    const CAN_BURN = bytes32("canBurn")
    const BLACKLISTED = bytes32("isBlacklisted")
    const HUNDRED = BN(100).mul(BN(10**18))
    describe('TrueReward setup', function(){
        beforeEach(async function () {
            this.token = await TrueUSDMock.new(holder, HUNDRED, { from: owner })
            this.financialOpportunity = await FinancialOpportunityMock.new({ from: owner })
            await this.token.setAaveInterfaceAddress(this.financialOpportunity.address, {from: owner})
        })

        it ('enables trueReward with 0 balance', async function(){
            let enabled = await this.token.trueRewardEnabled.call(holder2);
            assert.equal(enabled, false) 
            await this.token.enableTrueReward({from: holder2});
            enabled = await this.token.trueRewardEnabled.call(holder2);
            assert.equal(enabled, true) 
        })

        it ('enables trueReward with 100 balance', async function(){
            await this.token.enableTrueReward({from: holder});
            const enabled = await this.token.trueRewardEnabled.call(holder);
            assert.equal(enabled, true) 
            const loanBackedTokenBalance = await this.token.accountTotalLoanBackedBalance.call(holder);
            const totalAaveSupply = await this.token.totalAaveSupply.call();
            assert.equal(Number(loanBackedTokenBalance), 98058252427184470000) // 100*101/103
            assert.equal(Number(totalAaveSupply), 98058252427184470000)
            const totalSupply = await this.token.totalSupply.call();
            assert.equal(Number(totalSupply), 198466689448144200000) // 100 + 100*101/103
            const balance = await this.token.balanceOf.call(holder);
            assert.equal(Number(balance), 98466689448144200000) // 100*101/103 * perTokenValue
        })
        it ('disables trueReward', async function(){
            await this.token.enableTrueReward({from: holder});
            let enabled = await this.token.trueRewardEnabled.call(holder);
            assert.equal(enabled, true) 
            await this.token.disableTrueReward({from: holder});
            enabled = await this.token.trueRewardEnabled.call(holder);
            assert.equal(enabled, false) 
            const loanBackedTokenBalance = await this.token.accountTotalLoanBackedBalance.call(holder);
            const totalAaveSupply = await this.token.totalAaveSupply.call();
            assert.equal(Number(loanBackedTokenBalance), 0)
            assert.equal(Number(totalAaveSupply), 0)
            const totalSupply = await this.token.totalSupply.call();
            assert.equal(Number(totalSupply), 100000000000000000000)
            const balance = await this.token.balanceOf.call(holder);
            assert.equal(Number(balance), 100000000000000000000)
        })

    })
    describe('TrueReward with Aave', function(){
        beforeEach(async function () {
            this.registry = await Registry.new({ from: owner })
            this.token = await TrueUSDMock.new(holder, to18Decimals(300), { from: owner })
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
            await this.financialOpportunity.configure(this.sharesToken.address, this.lendingPool.address, this.token.address, { from: owner })
            await this.token.setAaveInterfaceAddress(this.financialOpportunity.address, {from: owner})
        })

        it ('enables truereward', async function(){
            let interfaceSharesTokenBalance = await this.sharesToken.balanceOf.call(this.financialOpportunity.address);
            assert.equal(Number(interfaceSharesTokenBalance), 0)
            const {logs} = await this.token.enableTrueReward({from: holder})
            // console.log(logs);
            const perTokenValue = await this.financialOpportunity.perTokenValue.call()
            assert.equal(Number(perTokenValue), 1000000000000000000)
            interfaceSharesTokenBalance = await this.sharesToken.balanceOf.call(this.financialOpportunity.address);
            assert.equal(Number(interfaceSharesTokenBalance), to18Decimals(100))
            const interfaceBalance= await this.token.balanceOf.call(this.financialOpportunity.address);
            assert.equal(Number(interfaceBalance), 0)
            const loanBackedTokenBalance = await this.token.accountTotalLoanBackedBalance.call(holder);
            const totalAaveSupply = await this.token.totalAaveSupply.call();
            assert.equal(Number(loanBackedTokenBalance), to18Decimals(100))
            assert.equal(Number(totalAaveSupply), to18Decimals(100))
            const totalSupply = await this.token.totalSupply.call();
            assert.equal(Number(totalSupply), to18Decimals(400))
            const balance = await this.token.balanceOf.call(holder);
            assert.equal(Number(balance), to18Decimals(100))
        })

        it ('balance increases after perTokenValue increases', async function(){
            let balance = await this.token.balanceOf.call(holder);
            assert.equal(Number(balance),to18Decimals(100))
            await this.lendingPoolCore.setReserveNormalizedIncome(to27Decimals(1.5), { from: owner })
            await this.token.enableTrueReward({from: holder})
            balance = await this.token.balanceOf.call(holder);
            assert.equal(Number(balance),to18Decimals(100))
            await this.lendingPoolCore.setReserveNormalizedIncome(to27Decimals(1.6), { from: owner })
            balance = await this.token.balanceOf.call(holder);
            console.log('final balance', Number(balance));
        })

        it ('transfer between accounts without truereward', async function(){

        })

        it ('sender truereward enabled receipient not enabled perTokenValue = 1', async function(){
            await this.token.transfer(sender, to18Decimals(100), { from: holder })
            await this.token.enableTrueReward({from: sender})
            const {logs} = await this.token.transfer(receipient, to18Decimals(50), {from: sender})
            // console.log(logs)
            const senderBalance = await this.token.balanceOf.call(sender);
            const receipientBalance = await this.token.balanceOf.call(receipient);
            assert.equal(Number(senderBalance), to18Decimals(50))
            assert.equal(Number(receipientBalance), to18Decimals(50))
            const loanBackedTokenBalance = await this.token.accountTotalLoanBackedBalance.call(sender);
            const totalAaveSupply = await this.token.totalAaveSupply.call();
            console.log('loanBackedTokenBalance',Number(loanBackedTokenBalance))
            console.log('totalAaveSupply',Number(totalAaveSupply))
            const totalSupply = await this.token.totalSupply.call();
            console.log('totalSupply',Number(totalSupply))
            const interfaceSharesTokenBalance = await this.sharesToken.balanceOf.call(this.financialOpportunity.address);
            console.log('interfaceSharesTokenBalance',Number(interfaceSharesTokenBalance))

        })
    
        it ('sender truereward enabled receipient enabled perTokenValue = 1', async function(){
            await this.token.transfer(sender, to18Decimals(100), { from: holder })
            await this.token.enableTrueReward({from: sender})
            await this.token.enableTrueReward({from: receipient})
            const {logs} = await this.token.transfer(receipient, to18Decimals(50), {from: sender})
            // console.log(logs)
            const senderBalance = await this.token.balanceOf.call(sender);
            const receipientBalance = await this.token.balanceOf.call(receipient);
            console.log('senderBalance',Number(senderBalance))
            console.log('receipientBalance', Number(receipientBalance))
            const loanBackedTokenBalance = await this.token.accountTotalLoanBackedBalance.call(sender);
            const totalAaveSupply = await this.token.totalAaveSupply.call();
            console.log('loanBackedTokenBalance',Number(loanBackedTokenBalance))
            console.log('totalAaveSupply',Number(totalAaveSupply))
            const totalSupply = await this.token.totalSupply.call();
            console.log('totalSupply',Number(totalSupply))
            const interfaceSharesTokenBalance = await this.sharesToken.balanceOf.call(this.financialOpportunity.address);
            console.log('interfaceSharesTokenBalance',Number(interfaceSharesTokenBalance))

        })
    
        it ('sender truereward not enabled receipient enabled perTokenValue = 1', async function(){
            await this.token.transfer(sender, to18Decimals(100), { from: holder })
            await this.token.enableTrueReward({from: receipient})
            const {logs} = await this.token.transfer(receipient, to18Decimals(50), {from: sender})
            // console.log(logs)
            const senderBalance = await this.token.balanceOf.call(sender);
            const receipientBalance = await this.token.balanceOf.call(receipient);
            console.log('senderBalance',Number(senderBalance))
            console.log('receipientBalance', Number(receipientBalance))
            const loanBackedTokenBalance = await this.token.accountTotalLoanBackedBalance.call(sender);
            const totalAaveSupply = await this.token.totalAaveSupply.call();
            console.log('loanBackedTokenBalance',Number(loanBackedTokenBalance))
            console.log('totalAaveSupply',Number(totalAaveSupply))
            const totalSupply = await this.token.totalSupply.call();
            console.log('totalSupply',Number(totalSupply))
            const interfaceSharesTokenBalance = await this.sharesToken.balanceOf.call(this.financialOpportunity.address);
            console.log('interfaceSharesTokenBalance',Number(interfaceSharesTokenBalance))
        })

    })

})
