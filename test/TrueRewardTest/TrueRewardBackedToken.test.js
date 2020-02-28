import assertRevert from '../helpers/assertRevert'
import expectThrow from '../helpers/expectThrow'
const BN = web3.utils.toBN;
const bytes32 = require('../helpers/bytes32.js')
const TrueUSDMock = artifacts.require("TrueUSDMock")
const FinancialOpportunityMock = artifacts.require("FinancialOpportunityMock")


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
            console.log(enabled)
            const interfaceBalance = await this.token.balanceOf.call(this.financialOpportunity.address);
            console.log(interfaceBalance)
            const loanBackedTokenBalance = await this.token.accountTotalLoanBackedBalance.call(oneHundred);
            const totalIearnSupply = await this.token.totalIearnSupply.call();
            console.log(loanBackedTokenBalance)
            console.log(totalIearnSupply)
        })
    })
})
