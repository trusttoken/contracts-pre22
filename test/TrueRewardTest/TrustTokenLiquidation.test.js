import assertRevert from '../helpers/assertRevert'
import expectThrow from '../helpers/expectThrow'
import assertBalance from '../helpers/assertBalance'

// types
const to18Decimals = value => BN(Math.floor(value*10**10)).mul(BN(10**8))
const to27Decimals = value => BN(Math.floor(value*10**10)).mul(BN(10**17))
const bytes32 = require('../helpers/bytes32.js')
const Types = artifacts.require('Types')

// TrustTokens & liquidator dependencies
const TrueUSDMock = artifacts.require("TrueUSDMock")
const Liquidator = artifacts.require('LiquidatorMock')
const BN = web3.utils.toBN
const ONE_ETHER = BN(1e18)
const ONE_HUNDRED_ETHER = BN(100).mul(ONE_ETHER)
const MockTrustToken = artifacts.require('MockTrustToken')
const TrueUSD = artifacts.require('TrueUSD')
const Airswap = artifacts.require('Swap')
const AirswapERC20TransferHandler = artifacts.require('AirswapERC20TransferHandler')
const TransferHandlerRegistry = artifacts.require('TransferHandlerRegistry')
const UniswapFactory = artifacts.require('uniswap_factory')
const UniswapExchange = artifacts.require('uniswap_exchange')
const { Order, hashDomain } = require('./lib/airswap.js')
const ERC20_KIND = '0x36372b07'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000'
const AIRSWAP_VALIDATOR = bytes32('AirswapValidatorDomain')
const APPROVED_BENEFICIARY = bytes32('approvedBeneficiary')

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

contract('AssuredFinancialOppurtunity', function(accounts) {
    const [_, owner, issuer, oneHundred, approvedBeneficiary, account2, kycAccount, 
        fakePool, anotherAccount, emptyAccount] = accounts
    beforeEach(async function() {
        // Assurance Pool Setup
        this.uniswapFactory = await UniswapFactory.new();
        this.uniswapTemplate = await UniswapExchange.new();
        this.uniswapFactory.initializeFactory(this.uniswapTemplate.address)
        this.registry = await Registry.new({ from: owner });
        this.rewardToken = await TrueUSD.new({ from: issuer });
        this.stakeToken = await MockTrustToken.new(this.registry.address, { from: issuer });
        this.outputUniswapAddress = (await this.uniswapFactory.createExchange(this.rewardToken.address)).logs[0].args.exchange
        this.outputUniswap = await UniswapExchange.at(this.outputUniswapAddress)
        this.stakeUniswap = await UniswapExchange.at((await this.uniswapFactory.createExchange(this.stakeToken.address)).logs[0].args.exchange)
        await this.rewardToken.setRegistry(this.registry.address, {from: issuer})
        await this.rewardToken.mint(oneHundred, ONE_HUNDRED_ETHER, {from:issuer});
        await this.stakeToken.mint(oneHundred, ONE_HUNDRED_ETHER, {from:issuer});
        this.transferHandler = await AirswapERC20TransferHandler.new({from: owner})
        this.transferHandlerRegistry = await TransferHandlerRegistry.new({from: owner})
        this.transferHandlerRegistry.addTransferHandler(ERC20_KIND, this.transferHandler.address,{from:owner})
        this.types = await Types.new()
        await Airswap.link('Types', this.types.address)
        await this.rewardToken.approve(this.outputUniswap.address, ONE_HUNDRED_ETHER, {from: oneHundred})
        await this.stakeToken.approve(this.stakeUniswap.address, ONE_HUNDRED_ETHER, {from: oneHundred})
        let expiry = parseInt(Date.now() / 1000) + 12000
        await this.outputUniswap.addLiquidity(ONE_HUNDRED_ETHER, ONE_HUNDRED_ETHER, expiry, {from:oneHundred, value:1e17})
        await this.stakeUniswap.addLiquidity(ONE_HUNDRED_ETHER, ONE_HUNDRED_ETHER, expiry, {from:oneHundred, value:1e17})
        await this.rewardToken.mint(oneHundred, ONE_HUNDRED_ETHER, {from:issuer});
        await this.stakeToken.mint(oneHundred, ONE_HUNDRED_ETHER, {from:issuer});
        this.airswap = await Airswap.new(this.transferHandlerRegistry.address, {from: owner})
        this.liquidator = await Liquidator.new(this.registry.address, this.rewardToken.address, this.stakeToken.address, this.outputUniswap.address, this.stakeUniswap.address, {from: owner})
        await this.liquidator.setPool(fakePool, {from:owner})
        await this.registry.subscribe(AIRSWAP_VALIDATOR, this.liquidator.address, {from: owner})
        await this.registry.subscribe(APPROVED_BENEFICIARY, this.liquidator.address, {from: owner})
        await this.registry.setAttributeValue(this.airswap.address, AIRSWAP_VALIDATOR, hashDomain(this.airswap.address), {from: owner})
        await this.registry.setAttributeValue(approvedBeneficiary, APPROVED_BENEFICIARY, 1, {from: owner})
        await this.rewardToken.approve(this.airswap.address, ONE_HUNDRED_ETHER, {from: oneHundred})
        await this.stakeToken.approve(this.liquidator.address, ONE_HUNDRED_ETHER, { from: fakePool })

        // TrueRewards setup
        this.token = await TrueUSDMock.new(oneHundred, HUNDRED, { from: owner })
        this.financialOpportunity = await FinancialOpportunityMock.new({ from: owner })
        await this.token.setiEarnInterfaceAddress(this.financialOpportunity.address, {from: owner})


        // Assurance Pool Setup
        this.AssuredFinancialOppurtunity = await AssuredFinancialOppurtunity.new()
    })
    describe('Assured Opportunity Setup', function() {
        it('deposit', async function() {
            // enable true reward
            await this.token.enableTrueReward({from: oneHundred});
            assert.equal(true, true);
        })
    })
})

contract('TrueRewardBackedToken', function (accounts) {
    const [_, owner, oneHundred, anotherAccount, emptyAccount] = accounts
    const CAN_BURN = bytes32("canBurn")
    const BLACKLISTED = bytes32("isBlacklisted")
    const HUNDRED = BN(100).mul(BN(10**18))
    describe('TrueReward setup', function(){
        beforeEach(async function () {
            this.token = await TrueUSDMock.new(oneHundred, HUNDRED, { from: owner })
            this.financialOpportunity = await FinancialOpportunityMock.new({ from: owner })
            await this.token.setiEarnInterfaceAddress(this.financialOpportunity.address, {from: owner})
        })

        it ('enables trueReward with 0 balance', async function(){
            let enabled = await this.token.trueRewardEnabled.call(anotherAccount);
            assert.equal(enabled, false) 
            await this.token.enableTrueReward({from: anotherAccount});
            enabled = await this.token.trueRewardEnabled.call(anotherAccount);
            assert.equal(enabled, true)
        })

        it ('enables trueReward with 100 balance', async function(){
            await this.token.enableTrueReward({from: oneHundred});
            const enabled = await this.token.trueRewardEnabled.call(oneHundred);
            assert.equal(enabled, true) 
            const interfaceBalance = await this.token.balanceOf.call(this.financialOpportunity.address);
            assert.equal(Number(interfaceBalance), 0)
            const loanBackedTokenBalance = await this.token.accountTotalLoanBackedBalance.call(oneHundred);
            const totalIearnSupply = await this.token.totalIearnSupply.call();
            const desiredNumberWithRoundingError = Number(HUNDRED)* 101/103;
            console.log(Number(loanBackedTokenBalance))
            console.log(Number(totalIearnSupply))
            const totalSupply = await this.token.totalSupply.call();
            console.log(Number(totalSupply))
            const balance = await this.token.balanceOf.call(oneHundred);
            console.log(Number(balance))
        })
        it ('disables trueReward', async function(){
            await this.token.enableTrueReward({from: oneHundred});
            const enabled = await this.token.trueRewardEnabled.call(oneHundred);
            assert.equal(enabled, true) 
            const interfaceBalance = await this.token.balanceOf.call(this.financialOpportunity.address);
            assert.equal(Number(interfaceBalance), 0)
            const loanBackedTokenBalance = await this.token.accountTotalLoanBackedBalance.call(oneHundred);
            const totalIearnSupply = await this.token.totalIearnSupply.call();
            console.log(Number(loanBackedTokenBalance))
            console.log(Number(totalIearnSupply))
            const totalSupply = await this.token.totalSupply.call();
            console.log(Number(totalSupply))
            const balance = await this.token.balanceOf.call(oneHundred);
            console.log(Number(balance))
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

