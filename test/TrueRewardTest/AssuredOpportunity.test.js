import assertRevert from '../helpers/assertRevert'
import expectThrow from '../helpers/expectThrow'
import assertBalance from '../helpers/assertBalance'

// types and values
const to18Decimals = value => BN(Math.floor(value*10**10)).mul(BN(10**8))
const to27Decimals = value => BN(Math.floor(value*10**10)).mul(BN(10**17))
const bytes32 = require('../helpers/bytes32.js')
const Types = artifacts.require('Types')
const BN = web3.utils.toBN
const ONE_ETHER = BN(1e18)
const ONE_HUNDRED_ETHER = BN(100).mul(ONE_ETHER)
const ONE_BITCOIN = BN(1e8)
const ONE_HUNDRED_BITCOIN = BN(100).mul(ONE_BITCOIN)
const DEFAULT_RATIO = BN(1000);
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000'

// Liquidator Dependencies
const TrueUSDMock = artifacts.require("TrueUSDMock")
const Liquidator = artifacts.require('LiquidatorMock')
const MockTrustToken = artifacts.require('MockTrustToken')
const TrueUSD = artifacts.require('TrueUSD')
const Airswap = artifacts.require('Swap')
const AirswapERC20TransferHandler = artifacts.require('AirswapERC20TransferHandler')
const TransferHandlerRegistry = artifacts.require('TransferHandlerRegistry')
const UniswapFactory = artifacts.require('uniswap_factory')
const UniswapExchange = artifacts.require('uniswap_exchange')
const { Order, hashDomain } = require('./lib/airswap.js')
const ERC20_KIND = '0x36372b07'
const AIRSWAP_VALIDATOR = bytes32('AirswapValidatorDomain')
const APPROVED_BENEFICIARY = bytes32('approvedBeneficiary')

// staking dependencies
const StakedToken = artifacts.require('MockStakedToken')
const IS_DEPOSIT_ADDRESS = bytes32('isDepositAddress')
const IS_REGISTERED_CONTRACT = bytes32('isRegisteredContract')
const PASSED_KYCAML = bytes32('hasPassedKYC/AML')

// opportunities dependencies
const Registry = artifacts.require('RegistryMock')
const CompliantTokenMock = artifacts.require('CompliantTokenMock')
const ATokenMock = artifacts.require('ATokenMock')
const LendingPoolMock = artifacts.require('LendingPoolMock')
const LendingPoolCoreMock = artifacts.require('LendingPoolCoreMock')
const AaveFinancialOpportunity = artifacts.require('AaveFinancialOpportunity')
const OwnedUpgradeabilityProxy = artifacts.require('OwnedUpgradeabilityProxy')
const FinancialOpportunityMock = artifacts.require("FinancialOpportunityMock")

// assured financial opportunities dependencies
const AssuredFinancialOpportunity = artifacts.require("AssuredFinancialOpportunity")
const FractionalExponents = artifacts.require("FractionalExponents")

contract('AssuredFinancialOpportunity', function(accounts) {
    const [_, owner, issuer, oneHundred, approvedBeneficiary,
     holder, holder2, sender, receipient, kycAccount] = accounts
    //const kycAccount = '0x835c247d2f6524009d38dc52d95a929f62888df6'
    const CAN_BURN = bytes32("canBurn")
    const BLACKLISTED = bytes32("isBlacklisted")
    describe('TrueReward setup', function(){
        beforeEach(async function() {
            // Liquidation Setup
            this.uniswapFactory = await UniswapFactory.new();
            this.uniswapTemplate = await UniswapExchange.new();
            this.uniswapFactory.initializeFactory(this.uniswapTemplate.address)
            this.registry = await Registry.new({ from: owner });
            this.token = await TrueUSDMock.new(holder, to18Decimals(400), { from: issuer })
            this.stakeToken = await MockTrustToken.new(this.registry.address, { from: issuer });
            this.outputUniswapAddress = (await this.uniswapFactory.createExchange(this.token.address)).logs[0].args.exchange
            this.outputUniswap = await UniswapExchange.at(this.outputUniswapAddress)
            this.stakeUniswap = await UniswapExchange.at((await this.uniswapFactory.createExchange(this.stakeToken.address)).logs[0].args.exchange)
            await this.token.setRegistry(this.registry.address, {from: issuer})
            await this.token.mint(oneHundred, ONE_HUNDRED_ETHER, {from:issuer});
            await this.stakeToken.mint(oneHundred, ONE_HUNDRED_ETHER, {from:issuer});
            this.transferHandler = await AirswapERC20TransferHandler.new({from: owner})
            this.transferHandlerRegistry = await TransferHandlerRegistry.new({from: owner})
            this.transferHandlerRegistry.addTransferHandler(ERC20_KIND, this.transferHandler.address,{from:owner})
            this.types = await Types.new()
            await Airswap.link('Types', this.types.address)
            await this.token.approve(this.outputUniswap.address, ONE_HUNDRED_ETHER, {from: oneHundred})
            await this.stakeToken.approve(this.stakeUniswap.address, ONE_HUNDRED_ETHER, {from: oneHundred})
            let expiry = parseInt(Date.now() / 1000) + 12000
            await this.outputUniswap.addLiquidity(ONE_HUNDRED_ETHER, ONE_HUNDRED_ETHER, expiry, {from:oneHundred, value:1e17})
            await this.stakeUniswap.addLiquidity(ONE_HUNDRED_ETHER, ONE_HUNDRED_ETHER, expiry, {from:oneHundred, value:1e17})
            await this.token.mint(oneHundred, ONE_HUNDRED_ETHER, {from:issuer});
            await this.stakeToken.mint(oneHundred, ONE_HUNDRED_ETHER, {from:issuer});
            this.airswap = await Airswap.new(this.transferHandlerRegistry.address, {from: owner})
            this.liquidator = await Liquidator.new(this.registry.address, this.token.address, this.stakeToken.address, this.outputUniswap.address, this.stakeUniswap.address, {from: owner})

            // Setup Staking Pool
            this.pool = await StakedToken.new(this.stakeToken.address, this.token.address, 
                this.registry.address, this.liquidator.address, {from: owner})
            await this.token.setRegistry(this.registry.address, {from: issuer})
            await this.token.mint(oneHundred, ONE_HUNDRED_ETHER, {from:issuer});
            await this.stakeToken.mint(oneHundred, ONE_HUNDRED_BITCOIN, {from:issuer});
    
            //await this.registry.subscribe(PASSED_KYCAML, this.pool.address, {from: owner})
            await this.registry.setAttributeValue(kycAccount, PASSED_KYCAML, 1, {from: owner})
            await this.registry.subscribe(IS_REGISTERED_CONTRACT, this.stakeToken.address, {from:owner})
            await this.registry.subscribe(IS_REGISTERED_CONTRACT, this.token.address, {from:owner})
            await this.registry.setAttributeValue(this.pool.address, IS_REGISTERED_CONTRACT, 1, {from:owner})

            // More setup for liquidator
            await this.liquidator.setPool(this.pool.address, {from:owner})
            await this.registry.subscribe(AIRSWAP_VALIDATOR, this.liquidator.address, {from: owner})
            await this.registry.subscribe(APPROVED_BENEFICIARY, this.liquidator.address, {from: owner})
            await this.registry.setAttributeValue(this.airswap.address, AIRSWAP_VALIDATOR, hashDomain(this.airswap.address), {from: owner})
            await this.registry.setAttributeValue(approvedBeneficiary, APPROVED_BENEFICIARY, 1, {from: owner})
            await this.token.approve(this.airswap.address, ONE_HUNDRED_ETHER, {from: oneHundred})

            this.lendingPoolCore = await LendingPoolCoreMock.new({ from: owner })
            this.sharesToken = await ATokenMock.new(this.token.address, this.lendingPoolCore.address, { from: owner })
            this.lendingPool = await LendingPoolMock.new(this.lendingPoolCore.address, this.sharesToken.address, { from: owner })

            await this.token.transfer(this.sharesToken.address, to18Decimals(100), { from: holder })

            this.financialOpportunityImpl = await AaveFinancialOpportunity.new({ from: owner })
            this.financialOpportunityProxy = await OwnedUpgradeabilityProxy.new({ from: owner })
            this.financialOpportunity = await AaveFinancialOpportunity.at(this.financialOpportunityProxy.address)
            await this.financialOpportunityProxy.upgradeTo(this.financialOpportunityImpl.address, { from: owner })

            // setup assured opportunity
            this.exponentContract = await FractionalExponents.new({ from: owner });
            this.assuredFinancialOpportunity = await AssuredFinancialOpportunity.new({ from: owner })
            await this.assuredFinancialOpportunity.configure(this.financialOpportunity.address,
                this.pool.address, this.liquidator.address, this.exponentContract.address, 
                this.token.address, {from: owner})
            await this.token.setAaveInterfaceAddress(this.assuredFinancialOpportunity.address, {from: owner})
            await this.financialOpportunity.configure(
                this.sharesToken.address, this.lendingPool.address, this.token.address, this.assuredFinancialOpportunity.address, { from: owner }
            )
            await this.liquidator.transferOwnership(this.assuredFinancialOpportunity.address, {from: owner})
            await this.assuredFinancialOpportunity.claimLiquidatorOwnership({from: owner})
        })

        it('test perTokenValue exponentiaion 1', async function() {
            await this.lendingPoolCore.setReserveNormalizedIncome(to27Decimals(1.0), { from: owner })
            const finOpPerTokenValue = await this.financialOpportunity.perTokenValue.call()
            const perTokenValue = await this.assuredFinancialOpportunity.perTokenValue.call()
            console.log(Number(finOpPerTokenValue));
            console.log(Number(perTokenValue)/ 10 ** 18);
            console.log(Math.pow(Number(finOpPerTokenValue)/ 10 ** 18,0.7))

            await assert.equal(Number(perTokenValue)/ 10 ** 18, Math.pow(Number(finOpPerTokenValue)/ 10 ** 18,0.7))
        })

        it.skip('test perTokenValue exponentiaion 1.5', async function() {
            await this.lendingPoolCore.setReserveNormalizedIncome(to27Decimals(1.5), { from: owner })
            const finOpPerTokenValue = await this.financialOpportunity.perTokenValue.call()
            const perTokenValue = await this.assuredFinancialOpportunity.perTokenValue.call()
            console.log(Number(finOpPerTokenValue));
            console.log(Number(perTokenValue)/ 10 ** 18);
            console.log(Math.pow(Number(finOpPerTokenValue)/ 10 ** 18,0.7))
            await assert.equal(Number(perTokenValue)/ 10 ** 18, Math.pow(Number(finOpPerTokenValue)/ 10 ** 18,0.7))
        })

        it('test assurance perTokenValue with 100% award', async function() {
            await this.lendingPoolCore.setReserveNormalizedIncome(to27Decimals(1.5), { from: owner })
            const finOpPerTokenValue = await this.financialOpportunity.perTokenValue.call()
            const perTokenValue = await this.assuredFinancialOpportunity.perTokenValue.call()
            await assert.equal(Number(perTokenValue)/ 10 ** 18, Number(finOpPerTokenValue) / 10 ** 18)
        })

        it('enables truereward', async function() {
            await this.token.transfer(holder2, to18Decimals(100), { from: holder })
            let interfaceSharesTokenBalance = await this.sharesToken.balanceOf.call(this.assuredFinancialOpportunity.address);
            assert.equal(Number(interfaceSharesTokenBalance), 0)
            const {logs} = await this.token.enableTrueReward({from: holder2})
            const enabled = await this.token.trueRewardEnabled.call(holder2);
            assert.equal(enabled, true) 
            const loanBackedTokenBalance = await this.token.accountTotalLoanBackedBalance.call(holder2);
            const totalAaveSupply = await this.token.totalAaveSupply.call();
            const totalSupply = await this.token.totalSupply.call();
            const balance = await this.token.balanceOf.call(holder2);
            assert.equal(Number(loanBackedTokenBalance), to18Decimals(100))
            assert.equal(Number(totalAaveSupply), to18Decimals(100))
            assert.equal(Number(totalSupply), to18Decimals(800))
            assert.equal(Number(balance), to18Decimals(100))
        })

        it('disables truereward', async function() {
            await this.token.transfer(holder2, to18Decimals(100), { from: holder })
            await this.token.enableTrueReward({from: holder2});
            let enabled = await this.token.trueRewardEnabled.call(holder2);
            assert.equal(enabled, true) 
            await this.token.disableTrueReward({from: holder2});
            enabled = await this.token.trueRewardEnabled.call(holder2);
            assert.equal(enabled, false)
        })

        it.skip('calculate interest correctly', async function() {
            let totalSupply = await this.token.totalSupply.call();
            assert.equal(Number(totalSupply), to18Decimals(700))
            await this.lendingPoolCore.setReserveNormalizedIncome(to27Decimals(1.5), { from: owner })
            await this.token.transfer(holder2, to18Decimals(100), { from: holder })
            await this.token.enableTrueReward({from: holder2})
            let loanBackedTokenBalance = await this.token.accountTotalLoanBackedBalance.call(holder2);
            let totalAaveSupply = await this.token.totalAaveSupply.call();
            totalSupply = await this.token.totalSupply.call();
            let balance = await this.token.balanceOf.call(holder2);
            assert.equal(Number(loanBackedTokenBalance), 75289795697123700000)
            assert.equal(Number(totalAaveSupply), 75289795697123700000)
            assert.equal(Number(totalSupply), to18Decimals(800))
            assert.equal(Number(balance), to18Decimals(100))
            await this.lendingPoolCore.setReserveNormalizedIncome(to27Decimals(1.6), { from: owner })
            totalSupply = await this.token.totalSupply.call();
            balance = await this.token.balanceOf.call(holder2);
            assert.equal(Number(totalSupply), 804621298639582300000)
            assert.equal(Number(balance), 104621298639582200000)
        })

        // it('reward', async function() {

        // })
        // it('stake', async function() {

        // })
        // it('liquidate', async function() {

        // })
    })
})