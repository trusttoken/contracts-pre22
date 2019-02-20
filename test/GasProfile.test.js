const Registry = artifacts.require("Registry")
const TrueUSDMock = artifacts.require("TrueUSDMock")
const TrueUSD = artifacts.require("TrueUSD")
const BalanceSheet = artifacts.require("BalanceSheet")
const AllowanceSheet = artifacts.require("AllowanceSheet")
const OwnedUpgradeabilityProxy = artifacts.require("OwnedUpgradeabilityProxy")

const bytes32 = require('./helpers/bytes32.js');
const BN = web3.utils.toBN;

function showRegressions(expectations) {
  for (let trial in expectations) {
    showRegression(trial, expectations[trial].actual, expectations[trial].expected);
  }
}

function showRegression(type, actual, expected) {
  if (actual < expected) {
    console.log("\x1b[32m", type, "improvement:", expected, '->', actual, "\x1b[0m");
  } else if (actual > expected) {
    console.log("\x1b[31m", type, "regression:", expected, '->', actual, "\x1b[0m");
  }
}

contract('GasProfile', function ([_, owner, oneHundred, anotherAccount]) {

    describe('--Gas Refund Token--', function () {
        const DOLLAR = BN(1*10**18);
        beforeEach(async function () {
            this.balances = await BalanceSheet.new({ from: owner })
            this.allowances = await AllowanceSheet.new({ from: owner })
            this.tokenProxy = await OwnedUpgradeabilityProxy.new({from: owner});
            this.tokenMockImpl = await TrueUSDMock.new(owner, 0);
            this.tokenImpl = await TrueUSD.new()
            this.registryProxy = await OwnedUpgradeabilityProxy.new({from: owner});
            this.registryImpl = await Registry.new({ from: owner })

            await this.tokenProxy.upgradeTo(this.tokenMockImpl.address, {from:owner});
            this.tokenMock = await TrueUSDMock.at(this.tokenProxy.address);
            await this.tokenMock.initialize({from: owner});

            await this.tokenProxy.upgradeTo(this.tokenImpl.address, {from: owner});
            await this.registryProxy.upgradeTo(this.registryImpl.address, {from: owner});
            this.token = await TrueUSD.at(this.tokenProxy.address);
            this.registry = await Registry.at(this.registryProxy.address);
            await this.registry.initialize({ from: owner });

            await this.token.setRegistry(this.registry.address, { from: owner })
            await this.balances.transferOwnership(this.token.address, { from: owner })
            await this.allowances.transferOwnership(this.token.address, { from: owner })
            await this.token.setBalanceSheet(this.balances.address, { from: owner })
            await this.token.setAllowanceSheet(this.allowances.address, { from: owner })

            await this.registry.setAttributeValue(oneHundred, bytes32("hasPassedKYC/AML"), 1, { from: owner })
            await this.token.mint(oneHundred, BN(100*10**18), { from: owner })
            await this.registry.setAttributeValue(oneHundred, bytes32("hasPassedKYC/AML"), 0, { from: owner })
            await this.registry.setAttributeValue(oneHundred, bytes32("canSetFutureRefundMinGasPrice"), 1, { from: owner });
        })

        it('does not regress in cost without refund', async function(){
            const reduceToNewNoRefund = await this.token.transfer(anotherAccount, DOLLAR, { from: oneHundred });
            const reduceToExistingNoRefund = await this.token.transfer(anotherAccount, DOLLAR, { from: oneHundred });
            const emptyToExistingNoRefund = await this.token.transfer(anotherAccount, BN(98*10**18), { from: oneHundred });
            const emptyToNewNoRefund = await this.token.transfer(oneHundred, BN(100*10**18), { from: anotherAccount });
            const expectations = {
              reduceToNewNoRefund: { expected: 106151, actual: reduceToNewNoRefund.receipt.gasUsed },
              reduceToExistingNoRefund: { expected: 91151, actual: reduceToExistingNoRefund.receipt.gasUsed },
              emptyToExistingNoRefund: { expected: 76215, actual: emptyToExistingNoRefund.receipt.gasUsed },
              emptyToNewNoRefund: { expected: 91215, actual: emptyToNewNoRefund.receipt.gasUsed },
            };
            showRegressions(expectations);
        })

        it('does not regress in cost with refund', async function() {
            await this.token.setMinimumGasPriceForFutureRefunds(1, { from: oneHundred });
            await this.token.sponsorGas({ from: oneHundred });
            await this.token.sponsorGas({ from: owner });
            const reduceToNewWithRefund = await this.token.transfer(anotherAccount, DOLLAR, { from: oneHundred, gasPrice: 2 });
            const reduceToExistingWithRefund = await this.token.transfer(anotherAccount, DOLLAR, { from: oneHundred, gasPrice: 2 });
            const emptyToExistingWithRefund = await this.token.transfer(anotherAccount, BN(98*10**18), { from: oneHundred, gasPrice: 2 });
            const emptyToNewWithRefund = await this.token.transfer(oneHundred, BN(100*10**18), { from: anotherAccount, gasPrice: 2 });
            const expectations = {
              reduceToNewWithRefund: { actual: reduceToNewWithRefund.receipt.gasUsed, expected: 83407 },
              reduceToExistingWithRefund: { actual: reduceToExistingWithRefund.receipt.gasUsed, expected: 68407 },
              emptyToExistingWithRefund: { actual: emptyToExistingWithRefund.receipt.gasUsed, expected: 56736 },
              emptyToNewWithRefund: { actual: emptyToNewWithRefund.receipt.gasUsed, expected: 68471 },
            };
            showRegressions(expectations);
        })
    })
})
