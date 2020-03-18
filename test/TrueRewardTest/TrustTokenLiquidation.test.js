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
const AssuredFinancialOppurtunityMock = artifacts.require("AssuredFinancialOpportunityMock")
const FractionalExponents = artifacts.require("FractionalExponents")

const timeMachine = require('ganache-time-traveler')

contract('AssuredFinancialOppurtunity', function(accounts) {
    const [_, owner, issuer, oneHundred, approvedBeneficiary,
     holder, holder2, sender, receipient, kycAccount] = accounts
    //const kycAccount = '0x835c247d2f6524009d38dc52d95a929f62888df6'
    const CAN_BURN = bytes32("canBurn")
    const BLACKLISTED = bytes32("isBlacklisted")
    const HUNDRED = BN(100).mul(BN(10**18))
    describe('TrueReward setup', function(){
        beforeEach(async function() {
            /*
            var send = await web3.eth.sendTransaction({
                from: ,
                to: kycAccount,
                value: weiSpend
            });
            */
            // Liquidation Setup
            this.uniswapFactory = await UniswapFactory.new();
            this.uniswapTemplate = await UniswapExchange.new();
            this.uniswapFactory.initializeFactory(this.uniswapTemplate.address)
            this.registry = await Registry.new({ from: owner });
            this.token = await TrueUSD.new({ from: issuer });
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
            this.pool = await StakedToken.new(this.stakeToken.address, this.token.address, this.registry.address, this.liquidator.address, {from: owner})
            await this.token.setRegistry(this.registry.address, {from: issuer})
            await this.token.mint(oneHundred, ONE_HUNDRED_ETHER, {from:issuer});
            await this.stakeToken.mint(oneHundred, ONE_HUNDRED_BITCOIN, {from:issuer});
    
            //await this.registry.subscribe(PASSED_KYCAML, this.pool.address, {from: owner})
            await this.registry.setAttributeValue(kycAccount, PASSED_KYCAML, 1, {from: owner})
            await this.registry.subscribe(IS_REGISTERED_CONTRACT, this.stakeToken.address, {from:owner})
            await this.registry.subscribe(IS_REGISTERED_CONTRACT, this.token.address, {from:owner})
            await this.registry.setAttributeValue(this.pool.address, IS_REGISTERED_CONTRACT, 1, {from:owner})
            console.log(this.pool.address)
            // More setup for liquidator
            await this.liquidator.setPool(this.pool.address, {from:owner})
            await this.registry.subscribe(AIRSWAP_VALIDATOR, this.liquidator.address, {from: owner})
            await this.registry.subscribe(APPROVED_BENEFICIARY, this.liquidator.address, {from: owner})
            await this.registry.setAttributeValue(this.airswap.address, AIRSWAP_VALIDATOR, hashDomain(this.airswap.address), {from: owner})
            await this.registry.setAttributeValue(approvedBeneficiary, APPROVED_BENEFICIARY, 1, {from: owner})
            await this.token.approve(this.airswap.address, ONE_HUNDRED_ETHER, {from: oneHundred})
            await this.stakeToken.approve(this.liquidator.address, ONE_HUNDRED_ETHER, { from: this.pool.address })

            // TrueRewards Setup With Mock
            this.token = await TrueUSDMock.new(holder, HUNDRED, { from: owner })
            this.financialOpportunity = await FinancialOpportunityMock.new({ from: owner })
            await this.token.setAaveInterfaceAddress(this.financialOpportunity.address, {from: owner})

            // Aave Opportunity Setup
            //this.registry = await Registry.new({ from: owner })
            //this.token = await TrueUSDMock.new(holder, to18Decimals(300), { from: owner })
            //await this.token.setRegistry(this.registry.address, { from: owner })
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

            // setup assured opportunity
            this.exponentContract = await FractionalExponents.new({ from: owner });
            this.assuredFinancialOppurtunity = await AssuredFinancialOppurtunity.new({ from: owner })
            await this.assuredFinancialOppurtunity.configure(this.financialOpportunity.address,
                this.pool.address, this.liquidator.address, this.exponentContract.address)
        })

        it('assured opportunity', async function() {
            // enable true reward
            await this.token.enableTrueReward({from: oneHundred});
            assert.equal(true, true);
        })
    })
})

/*
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
            await this.token.disableTrueReward({from: holder});
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
            const loanBackedTokenBalance = await this.token.accountTotalLoanBackedBalance.call(receipient);
            const totalAaveSupply = await this.token.totalAaveSupply.call();
            console.log('loanBackedTokenBalance',Number(loanBackedTokenBalance))
            console.log('totalAaveSupply',Number(totalAaveSupply))
            const totalSupply = await this.token.totalSupply.call();
            console.log('totalSupply',Number(totalSupply))
            const interfaceSharesTokenBalance = await this.sharesToken.balanceOf.call(this.financialOpportunity.address);
            console.log('interfaceSharesTokenBalance',Number(interfaceSharesTokenBalance))
        })

        describe('Truereward - aave with interest', function(){
            it ('sender truereward enabled receipient not enabled', async function(){
                
            })

            it ('sender truereward enabled receipient enabled', async function(){
                
            })
            it ('sender truereward not enabled receipient enabled', async function(){
                
            })

        })
    })
})

contract('AaveAssuredFinancialOpportunity', function ([_, owner, holder, holder2, address1, address2, address3]) {

  beforeEach(async function () {
    this.registry = await Registry.new({ from: owner })
    this.token = await CompliantTokenMock.new(holder, to18Decimals(200), { from: owner })
    await this.token.setRegistry(this.registry.address, { from: owner })
    
    this.lendingPoolCore = await LendingPoolCoreMock.new({ from: owner })
    this.sharesToken = await ATokenMock.new(this.token.address, this.lendingPoolCore.address, { from: owner })
    this.lendingPool = await LendingPoolMock.new(this.lendingPoolCore.address, this.sharesToken.address, { from: owner })
    
    await this.token.transfer(this.sharesToken.address, to18Decimals(100), { from: holder })

    this.financialOpportunityImpl = await AaveFinancialOpportunity.new({ from: owner })
    this.financialOpportunityProxy = await OwnedUpgradeabilityProxy.new({ from: owner })
    this.financialOpportunity = await AaveFinancialOpportunity.at(this.financialOpportunityProxy.address)
    await this.financialOpportunityProxy.upgradeTo(this.financialOpportunityImpl.address, { from: owner })
    await this.financialOpportunity.configure(this.sharesToken.address, this.lendingPool.address, this.token.address, { from: owner })
  })

  describe('configure', function () {
    it('configured to proper addresses', async function () {
      const sharesTokenAddress = await this.financialOpportunity.sharesToken()
      const lendingPoolAddress = await this.financialOpportunity.lendingPool()
      const tokenAddress = await this.financialOpportunity.token()
      assert.equal(sharesTokenAddress, this.sharesToken.address)
      assert.equal(lendingPoolAddress, this.lendingPool.address)
      assert.equal(tokenAddress, this.token.address)
    })
  
    it('can reconfigure', async function () {
      await this.financialOpportunity.configure(address1, address2, address3, { from: owner })
  
      const sharesTokenAddress = await this.financialOpportunity.sharesToken()
      const lendingPoolAddress = await this.financialOpportunity.lendingPool()
      const tokenAddress = await this.financialOpportunity.token()
      assert.equal(sharesTokenAddress, address1)
      assert.equal(lendingPoolAddress, address2)
      assert.equal(tokenAddress, address3)
    })

    it('non-owner cannot reconfigure', async function () {
      await assertRevert(this.financialOpportunity.configure(address1, address2, address3, { from: holder }))
    })
  })

  describe('deposit', async function() {
    it('with exchange rate = 1', async function () {
      await this.token.approve(this.financialOpportunity.address, to18Decimals(10), { from: holder })
      await this.financialOpportunity.deposit(holder, to18Decimals(10))

      await assert((await this.financialOpportunity.getBalance()).eq(to18Decimals(10)))
      await assertBalance(this.token, holder, to18Decimals(90))
    })

    it('with exchange rate = 1.5', async function () {
      await this.lendingPoolCore.setReserveNormalizedIncome(to27Decimals(1.5), { from: owner })

      await this.token.approve(this.financialOpportunity.address, to18Decimals(15), { from: holder })
      await this.financialOpportunity.deposit(holder, to18Decimals(15))
  
      await assert((await this.financialOpportunity.getBalance()).eq(to18Decimals(15)))
      await assertBalance(this.token, holder, to18Decimals(85))
    })
  })

  describe('withdraw', async function() {
    beforeEach(async function() {
      await this.token.approve(this.financialOpportunity.address, to18Decimals(10), { from: holder })
      await this.financialOpportunity.deposit(holder, to18Decimals(10))
    })

    it('withdraw', async function () {
      await this.financialOpportunity.withdrawTo(address1, to18Decimals(5), { from: owner })
  
      await assert((await this.financialOpportunity.getBalance()).eq(to18Decimals(5)))
      await assertBalance(this.token, address1, to18Decimals(5))
      await assertBalance(this.token, holder, to18Decimals(90))
    })

    it('withdrawAll', async function () {
      await this.financialOpportunity.withdrawAll(address1, { from: owner })
  
      await assert((await this.financialOpportunity.getBalance()).eq(to18Decimals(0)))
      await assertBalance(this.token, address1, to18Decimals(10))
    })

    describe('with exchange rate = 1.5', async function() {
      beforeEach(async function () {
        await this.lendingPoolCore.setReserveNormalizedIncome(to27Decimals(1.5), { from: owner })
      })
  
      it('can withdraw 50%', async function () {
        await this.financialOpportunity.withdrawTo(address1, to18Decimals(7.5), { from: owner })
    
        await assert((await this.financialOpportunity.getBalance()).eq(to18Decimals(7.5)))
        await assertBalance(this.token, address1, to18Decimals(7.5))
      }) 

      it('can withdraw 100%', async function () {
        await this.financialOpportunity.withdrawTo(address1, to18Decimals(15), { from: owner })
    
        await assert((await this.financialOpportunity.getBalance()).eq(to18Decimals(0)))
        await assertBalance(this.token, address1, to18Decimals(15))
      }) 

      it('withdrawAll', async function () {
        await this.financialOpportunity.withdrawAll(address1, { from: owner })
    
        await assert((await this.financialOpportunity.getBalance()).eq(to18Decimals(0)))
        await assertBalance(this.token, address1, to18Decimals(15))
      })
    })
  })

  it('perTokenValue is always equal to exchange rate', async function () {
    const perTokenValue = await this.financialOpportunity.perTokenValue()
    assert(perTokenValue.eq(to18Decimals(1)))

    await this.lendingPoolCore.setReserveNormalizedIncome(to27Decimals(1.5))

    const perTokenValue2 = await this.financialOpportunity.perTokenValue()
    assert(perTokenValue2.eq(to18Decimals(1.5)))
  })
})
*/
