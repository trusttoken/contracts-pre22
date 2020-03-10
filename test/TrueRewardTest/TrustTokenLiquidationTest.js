import assertRevert from '../helpers/assertRevert'
import expectThrow from '../helpers/expectThrow'
const BN = web3.utils.toBN;
const bytes32 = require('../helpers/bytes32.js')
const TrueUSDMock = artifacts.require("TrueUSDMock")
const FinancialOpportunityMock = artifacts.require("FinancialOpportunityMock")


contract('AssuredFinancialOppurtunity', function(accounts) {
    const [_, owner, issuer, oneHundred, approvedBeneficiary, account2, kycAccount, fakePool] = accounts
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
        this.AssuredFinancialOppurtunity = await AssuredFinancialOppurtunity.new() // todo feewet
    })
    describe('Liquidate Oppurtunity Default', function() {

    }
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
