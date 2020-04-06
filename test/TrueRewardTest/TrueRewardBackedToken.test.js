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
    const [_, owner, holder, holder2, sender, receipient] = accounts
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
            assert.equal(loanBackedTokenBalance, 98058252427184470000) // 100*101/103
            assert.equal(totalAaveSupply, 98058252427184470000)
            const totalSupply = await this.token.totalSupply.call();
            assert.equal(totalSupply, 198466689448144200000) // 100 + 100*101/103
            const balance = await this.token.balanceOf.call(holder);
            assert.equal(balance, 98466689448144200000) // 100*101/103 * perTokenValue
        })
        it ('disables trueReward', async function(){
            await this.token.enableTrueReward({from: holder});
            let enabled = await this.token.trueRewardEnabled.call(holder);
            assert.equal(enabled, true) 
            const {logs} = await this.token.disableTrueReward({from: holder});
            enabled = await this.token.trueRewardEnabled.call(holder);
            assert.equal(enabled, false) 
            const loanBackedTokenBalance = await this.token.accountTotalLoanBackedBalance.call(holder);
            const totalAaveSupply = await this.token.totalAaveSupply.call();
            assert.equal(loanBackedTokenBalance, 0)
            assert.equal(totalAaveSupply, 0)
            const totalSupply = await this.token.totalSupply.call();
            assert.equal(totalSupply, 100000000000000000000)
            const balance = await this.token.balanceOf.call(holder);
            assert.equal(balance, 100000000000000000000)
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
            await this.financialOpportunity.configure(this.sharesToken.address, this.lendingPool.address, this.token.address, this.token.address, { from: owner })
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
            assert.equal(interfaceBalance, 0)
            const loanBackedTokenBalance = await this.token.accountTotalLoanBackedBalance.call(holder);
            const totalAaveSupply = await this.token.totalAaveSupply.call();
            assert.equal(Number(loanBackedTokenBalance), to18Decimals(100))
            assert.equal(Number(totalAaveSupply), to18Decimals(100))
            const totalSupply = await this.token.totalSupply.call();
            assert.equal(Number(totalSupply), to18Decimals(400))
            const balance = await this.token.balanceOf.call(holder);
            assert.equal(Number(balance), to18Decimals(100))
        })

        it ('two accounts enable truereward', async function(){
            await this.token.enableTrueReward({from: holder})
            await this.token.enableTrueReward({from: holder2})
            const interfaceSharesTokenBalance = await this.sharesToken.balanceOf.call(this.financialOpportunity.address);
            assert.equal(Number(interfaceSharesTokenBalance), to18Decimals(200))
            const totalAaveSupply = await this.token.totalAaveSupply.call();
            assert.equal(Number(totalAaveSupply), to18Decimals(200))
            const totalSupply = await this.token.totalSupply.call();
            assert.equal(Number(totalSupply), to18Decimals(500))
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
            assert.equal(Number(balance),106666666666666670000)
        })

        it ('transfer between accounts without truereward', async function(){

        })

        it ('sender truereward enabled receipient not enabled perTokenValue = 1', async function(){
            await this.token.transfer(sender, to18Decimals(100), { from: holder })
            await this.token.enableTrueReward({from: sender})
            const {logs} = await this.token.transfer(receipient, to18Decimals(50), {from: sender})
            // console.log(logs)
            // logs should be 
            const senderBalance = await this.token.balanceOf.call(sender);
            const receipientBalance = await this.token.balanceOf.call(receipient);
            const loanBackedTokenBalance = await this.token.accountTotalLoanBackedBalance.call(sender);
            const totalAaveSupply = await this.token.totalAaveSupply.call();
            const totalSupply = await this.token.totalSupply.call();
            const interfaceSharesTokenBalance = await this.sharesToken.balanceOf.call(this.financialOpportunity.address);
            assert.equal(Number(senderBalance),to18Decimals(50))
            assert.equal(Number(receipientBalance),to18Decimals(50))
            assert.equal(Number(loanBackedTokenBalance),to18Decimals(50))
            assert.equal(Number(totalAaveSupply),to18Decimals(50))
            assert.equal(Number(totalSupply),to18Decimals(350))
            assert.equal(Number(interfaceSharesTokenBalance),to18Decimals(50))
        })
    
        it ('sender truereward enabled receipient enabled perTokenValue = 1', async function(){
            await this.token.transfer(sender, to18Decimals(100), { from: holder })
            await this.token.enableTrueReward({from: sender})
            await this.token.enableTrueReward({from: receipient})
            const {logs} = await this.token.transfer(receipient, to18Decimals(50), {from: sender})
            // console.log(logs)
            const senderBalance = await this.token.balanceOf.call(sender);
            const receipientBalance = await this.token.balanceOf.call(receipient);
            const loanBackedTokenBalance = await this.token.accountTotalLoanBackedBalance.call(sender);
            const totalAaveSupply = await this.token.totalAaveSupply.call();
            const totalSupply = await this.token.totalSupply.call();
            const interfaceSharesTokenBalance = await this.sharesToken.balanceOf.call(this.financialOpportunity.address);
            assert.equal(Number(senderBalance),to18Decimals(50))
            assert.equal(Number(receipientBalance),to18Decimals(50))
            assert.equal(Number(loanBackedTokenBalance),to18Decimals(50))
            assert.equal(Number(totalAaveSupply),to18Decimals(100))
            assert.equal(Number(totalSupply),to18Decimals(400))
            assert.equal(Number(interfaceSharesTokenBalance),to18Decimals(100))
        })
    
        it ('sender truereward not enabled receipient enabled perTokenValue = 1', async function(){
            await this.token.transfer(sender, to18Decimals(100), { from: holder })
            await this.token.enableTrueReward({from: receipient})
            const {logs} = await this.token.transfer(receipient, to18Decimals(50), {from: sender})
            // console.log(logs)
            const senderBalance = await this.token.balanceOf.call(sender);
            const receipientBalance = await this.token.balanceOf.call(receipient);
            const loanBackedTokenBalance = await this.token.accountTotalLoanBackedBalance.call(receipient);
            const totalAaveSupply = await this.token.totalAaveSupply.call();
            const totalSupply = await this.token.totalSupply.call();
            const interfaceSharesTokenBalance = await this.sharesToken.balanceOf.call(this.financialOpportunity.address);
            assert.equal(Number(senderBalance),to18Decimals(50))
            assert.equal(Number(receipientBalance),to18Decimals(50))
            assert.equal(Number(loanBackedTokenBalance),to18Decimals(50))
            assert.equal(Number(totalAaveSupply),to18Decimals(50))
            assert.equal(Number(totalSupply),to18Decimals(350))
            assert.equal(Number(interfaceSharesTokenBalance),to18Decimals(50))

        })

        describe('Truereward - pertokenvalue != 1 ', function(){
            it ('sender truereward enabled receipient not enabled', async function(){
                await this.lendingPoolCore.setReserveNormalizedIncome(to27Decimals(1.5), { from: owner })
                await this.token.transfer(sender, to18Decimals(100), { from: holder })
                await this.token.enableTrueReward({from: sender})
                const {logs} = await this.token.transfer(receipient, to18Decimals(50), {from: sender})
                // console.log(logs)
                const senderBalance = await this.token.balanceOf.call(sender);
                const receipientBalance = await this.token.balanceOf.call(receipient);
                const loanBackedTokenBalance = await this.token.accountTotalLoanBackedBalance.call(sender);
                const totalAaveSupply = await this.token.totalAaveSupply.call();
                const totalSupply = await this.token.totalSupply.call();
                const interfaceSharesTokenBalance = await this.sharesToken.balanceOf.call(this.financialOpportunity.address);
                assert.equal(Number(senderBalance),to18Decimals(50))
                assert.equal(Number(receipientBalance),to18Decimals(50))
                assert.equal(Number(loanBackedTokenBalance),33333333333333330000) // 50 / 1.5 
                assert.equal(Number(totalAaveSupply),33333333333333330000)
                assert.equal(Number(totalSupply),to18Decimals(350))
                assert.equal(Number(interfaceSharesTokenBalance),to18Decimals(50))    
            })

            it ('sender truereward enabled receipient enabled', async function(){
                await this.lendingPoolCore.setReserveNormalizedIncome(to27Decimals(1.5), { from: owner })
                await this.token.transfer(sender, to18Decimals(100), { from: holder })
                await this.token.enableTrueReward({from: sender})
                await this.token.enableTrueReward({from: receipient})
                const {logs} = await this.token.transfer(receipient, to18Decimals(50), {from: sender})
                const senderBalance = await this.token.balanceOf.call(sender);
                const receipientBalance = await this.token.balanceOf.call(receipient);
                const senderLoanBackedTokenBalance = await this.token.accountTotalLoanBackedBalance.call(sender);
                const receipientLoanBackedTokenBalance = await this.token.accountTotalLoanBackedBalance.call(receipient);
                const totalAaveSupply = await this.token.totalAaveSupply.call();
                const totalSupply = await this.token.totalSupply.call();
                const interfaceSharesTokenBalance = await this.sharesToken.balanceOf.call(this.financialOpportunity.address);
                assert.equal(Number(senderBalance),to18Decimals(50))
                assert.equal(Number(receipientBalance),to18Decimals(50))
                assert.equal(Number(senderLoanBackedTokenBalance),33333333333333330000)
                assert.equal(Number(receipientLoanBackedTokenBalance),33333333333333330000)
                assert.equal(Number(totalAaveSupply),66666666666666660000)
                assert.equal(Number(totalSupply),to18Decimals(400))
                assert.equal(Number(interfaceSharesTokenBalance),to18Decimals(100))    
            })

            it ('sender truereward not enabled receipient enabled', async function(){
                await this.lendingPoolCore.setReserveNormalizedIncome(to27Decimals(1.5), { from: owner })
                await this.token.transfer(sender, to18Decimals(100), { from: holder })
                await this.token.enableTrueReward({from: receipient})
                const {logs} = await this.token.transfer(receipient, to18Decimals(50), {from: sender})
                // console.log(logs)
                const senderBalance = await this.token.balanceOf.call(sender);
                const receipientBalance = await this.token.balanceOf.call(receipient);
                const senderLoanBackedTokenBalance = await this.token.accountTotalLoanBackedBalance.call(sender);
                const receipientLoanBackedTokenBalance = await this.token.accountTotalLoanBackedBalance.call(receipient);
                const totalAaveSupply = await this.token.totalAaveSupply.call();
                const totalSupply = await this.token.totalSupply.call();
                const interfaceSharesTokenBalance = await this.sharesToken.balanceOf.call(this.financialOpportunity.address);
                assert.equal(Number(senderBalance),to18Decimals(50))
                assert.equal(Number(receipientBalance),to18Decimals(50))
                assert.equal(Number(senderLoanBackedTokenBalance),0)
                assert.equal(Number(receipientLoanBackedTokenBalance),33333333333333330000)
                assert.equal(Number(totalAaveSupply),33333333333333330000)
                assert.equal(Number(totalSupply),to18Decimals(350))
                assert.equal(Number(interfaceSharesTokenBalance),to18Decimals(50))
        
            })

        })
        describe('Truereward - aave with interest ', function(){
            it ('sender truereward enabled receipient not enabled', async function(){
                await this.lendingPoolCore.setReserveNormalizedIncome(to27Decimals(1.5), { from: owner })
                await this.token.transfer(sender, to18Decimals(100), { from: holder })
                await this.token.enableTrueReward({from: sender})
                await this.lendingPoolCore.setReserveNormalizedIncome(to27Decimals(1.6), { from: owner })
                const {logs} = await this.token.transfer(receipient, to18Decimals(50), {from: sender})
                const senderBalance = await this.token.balanceOf.call(sender);
                const receipientBalance = await this.token.balanceOf.call(receipient);
                const senderLoanBackedTokenBalance = await this.token.accountTotalLoanBackedBalance.call(sender);
                const receipientLoanBackedTokenBalance = await this.token.accountTotalLoanBackedBalance.call(receipient);
                const totalAaveSupply = await this.token.totalAaveSupply.call();
                const totalSupply = await this.token.totalSupply.call();
                const interfaceSharesTokenBalance = await this.sharesToken.balanceOf.call(this.financialOpportunity.address);
                assert.equal(Number(senderBalance),56666666666666660000) // (100/1.5)*1.6 - 50
                assert.equal(Number(receipientBalance),to18Decimals(50))
                assert.equal(Number(senderLoanBackedTokenBalance),35416666666666670000) // 56666666666666660000/1.6
                assert.equal(Number(receipientLoanBackedTokenBalance),0)
                assert.equal(Number(totalAaveSupply),35416666666666670000)
                assert.equal(Number(totalSupply),356666666666666700000)
                assert.equal(Number(interfaceSharesTokenBalance),56666666666666660000)
            })

            it ('sender truereward enabled receipient enabled', async function(){
                await this.lendingPoolCore.setReserveNormalizedIncome(to27Decimals(1.5), { from: owner })
                await this.token.transfer(sender, to18Decimals(100), { from: holder })
                await this.token.enableTrueReward({from: sender})
                await this.token.enableTrueReward({from: receipient})
                await this.lendingPoolCore.setReserveNormalizedIncome(to27Decimals(1.6), { from: owner })
                const {logs} = await this.token.transfer(receipient, to18Decimals(50), {from: sender})
                const senderBalance = await this.token.balanceOf.call(sender);
                const receipientBalance = await this.token.balanceOf.call(receipient);
                const senderLoanBackedTokenBalance = await this.token.accountTotalLoanBackedBalance.call(sender);
                const receipientLoanBackedTokenBalance = await this.token.accountTotalLoanBackedBalance.call(receipient);
                const totalAaveSupply = await this.token.totalAaveSupply.call();
                const totalSupply = await this.token.totalSupply.call();
                const interfaceSharesTokenBalance = await this.sharesToken.balanceOf.call(this.financialOpportunity.address);
                assert.equal(Number(senderBalance),56666666666666660000)
                assert.equal(Number(receipientBalance),50000000000000000000)
                assert.equal(Number(senderLoanBackedTokenBalance),35416666666666670000)
                assert.equal(Number(receipientLoanBackedTokenBalance),31250000000000000000)
                assert.equal(Number(totalAaveSupply),66666666666666660000)
                assert.equal(Number(totalSupply),406666666666666700000)
                assert.equal(Number(interfaceSharesTokenBalance),106666666666666670000)    
            })

            it ('sender truereward not enabled receipient enabled', async function(){
                await this.lendingPoolCore.setReserveNormalizedIncome(to27Decimals(1.5), { from: owner })
                await this.token.transfer(sender, to18Decimals(100), { from: holder })
                await this.token.enableTrueReward({from: receipient})
                await this.lendingPoolCore.setReserveNormalizedIncome(to27Decimals(1.6), { from: owner })
                const {logs} = await this.token.transfer(receipient, to18Decimals(50), {from: sender})
                const senderBalance = await this.token.balanceOf.call(sender);
                const receipientBalance = await this.token.balanceOf.call(receipient);
                const senderLoanBackedTokenBalance = await this.token.accountTotalLoanBackedBalance.call(sender);
                const receipientLoanBackedTokenBalance = await this.token.accountTotalLoanBackedBalance.call(receipient);
                const totalAaveSupply = await this.token.totalAaveSupply.call();
                const totalSupply = await this.token.totalSupply.call();
                const interfaceSharesTokenBalance = await this.sharesToken.balanceOf.call(this.financialOpportunity.address);
                assert.equal(Number(senderBalance),to18Decimals(50))
                assert.equal(Number(receipientBalance),to18Decimals(50))
                assert.equal(Number(senderLoanBackedTokenBalance),0)
                assert.equal(Number(receipientLoanBackedTokenBalance),to18Decimals(31.25)) // 31.25*1.6
                assert.equal(Number(totalAaveSupply),to18Decimals(31.25))
                assert.equal(Number(totalSupply),to18Decimals(350))
                assert.equal(Number(interfaceSharesTokenBalance),to18Decimals(50))
        
            })

        })
    })
})
