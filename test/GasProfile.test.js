const RegistryMock = artifacts.require("RegistryMock")
const Registry = artifacts.require('Registry')
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
            this.registryMockImpl = await RegistryMock.new({ from: owner })

            await this.tokenProxy.upgradeTo(this.tokenMockImpl.address, {from:owner});
            this.tokenMock = await TrueUSDMock.at(this.tokenProxy.address);
            await this.tokenMock.initialize({from: owner});
            this.token = await TrueUSD.at(this.tokenProxy.address);

            await this.tokenProxy.upgradeTo(this.tokenImpl.address, {from: owner});
            await this.registryProxy.upgradeTo(this.registryMockImpl.address, {from: owner});
            this.registryMock = await RegistryMock.at(this.registryProxy.address);
            await this.registryMock.initialize({ from: owner });
            await this.registryProxy.upgradeTo(this.registryImpl.address, { from: owner });
            this.registry = await Registry.at(this.registryProxy.address);

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

        describe('when using burn addresses', function() {
            const BURN_ADDRESS = '0x0000000000000000000000000000000000011111';
            beforeEach(async function() {
                await this.registry.setAttributeValue(BURN_ADDRESS, bytes32("canBurn"), 1, {from: owner})
                await this.token.setBurnBounds(BN(1), BN(1000).mul(BN(10**18)), {from: owner});
            })
            describe('without refund', function() {
                it('transfer', async function(){
                    const reduceToNewNoRefund = await this.token.transfer(anotherAccount, DOLLAR, { from: oneHundred });
                    const reduceToExistingNoRefund = await this.token.transfer(anotherAccount, DOLLAR, { from: oneHundred });
                    const emptyToExistingNoRefund = await this.token.transfer(anotherAccount, BN(98*10**18), { from: oneHundred });
                    const emptyToNewNoRefund = await this.token.transfer(oneHundred, BN(100*10**18), { from: anotherAccount });
                    const expectations = {
                      reduceToNewNoRefund: { expected: 105909, actual: reduceToNewNoRefund.receipt.gasUsed },
                      reduceToExistingNoRefund: { expected: 90909, actual: reduceToExistingNoRefund.receipt.gasUsed },
                      emptyToExistingNoRefund: { expected: 75973, actual: emptyToExistingNoRefund.receipt.gasUsed },
                      emptyToNewNoRefund: { expected: 90973, actual: emptyToNewNoRefund.receipt.gasUsed },
                    };
                    showRegressions(expectations);
                })

                it('transferFrom', async function() {
                    const approve50 = await this.token.approve(anotherAccount, BN(50).mul(DOLLAR), { from: oneHundred });
                    const reduceApprovalReducingToNew = await this.token.transferFrom(oneHundred, anotherAccount, DOLLAR, { from: anotherAccount, gasPrice: 1 });
                    const reduceApprovalReducingToExisting = await this.token.transferFrom(oneHundred, anotherAccount, DOLLAR, { from: anotherAccount, gasPrice: 1 });
                    const emptyApprovalReducingToExisting = await this.token.transferFrom(oneHundred, anotherAccount, BN(48).mul(DOLLAR), { from: anotherAccount, gasPrice: 1});
                    const approve50b = await this.token.approve(oneHundred, BN(50).mul(DOLLAR), { from: anotherAccount });
                    const emptyApprovalEmptyingToExisting = await this.token.transferFrom(anotherAccount, oneHundred, BN(50).mul(DOLLAR), { from: oneHundred, gasPrice: 1});
                    const approve1 = await this.token.approve(anotherAccount, DOLLAR, { from: oneHundred, gasPrice: 1});
                    const emptyApprovalReducingToNew = await this.token.transferFrom(oneHundred, anotherAccount, DOLLAR, { from: anotherAccount, gasPrice: 1});
                    const approve20 = await this.token.approve(oneHundred, BN(20).mul(DOLLAR), { from: anotherAccount, gasPrice: 1 });
                    const reduceApprovalEmptyingToExisting = await this.token.transferFrom(anotherAccount, oneHundred, DOLLAR, { from: oneHundred, gasPrice: 1 });
                    const approve100 = await this.token.approve(anotherAccount, BN(100).mul(DOLLAR), { from: oneHundred, gasPrice: 1 });
                    const emptyApprovalEmptyingToNew = await this.token.transferFrom(oneHundred, anotherAccount, BN(100).mul(DOLLAR), { from: anotherAccount, gasPrice: 1});
                    const approve101 = await this.token.approve(oneHundred, BN(101).mul(DOLLAR), { from: anotherAccount, gasPrice: 1 });
                    const reduceApprovalEmptyingToNew = await this.token.transferFrom(anotherAccount, oneHundred, BN(100).mul(DOLLAR), { from: oneHundred, gasPrice: 1} );
                    
                    const expectations = {
                        reduceApprovalReducingToNew : { actual: reduceApprovalReducingToNew.receipt.gasUsed, expected: 118024 },
                        reduceApprovalReducingToExisting : { actual: reduceApprovalReducingToExisting.receipt.gasUsed, expected: 103024 },
                        reduceApprovalEmptyingToNew : { actual: reduceApprovalEmptyingToNew.receipt.gasUsed, expected: 103088 },
                        reduceApprovalEmptyingToExisting : { actual: reduceApprovalEmptyingToExisting.receipt.gasUsed, expected: 88024 },
                        emptyApprovalReducingToNew : { actual: emptyApprovalReducingToNew.receipt.gasUsed, expected: 103024 },
                        emptyApprovalReducingToExisting : { actual: emptyApprovalReducingToExisting.receipt.gasUsed, expected: 88088 },
                        emptyApprovalEmptyingToNew : { actual: emptyApprovalEmptyingToNew.receipt.gasUsed, expected: 88088 },
                        emptyApprovalEmptyingToExisting : { actual: emptyApprovalEmptyingToExisting.receipt.gasUsed, expected: 73088 },
                        approve50: { actual: approve50.receipt.gasUsed, expected: 64256 },
                    };
                    showRegressions(expectations);
                })

                it('burn', async function() {
                    const reduceToBurn = await this.token.transfer(BURN_ADDRESS, DOLLAR, { from: oneHundred, gasPrice: 1 });
                    const emptyToBurn = await this.token.transfer(BURN_ADDRESS, BN(99*10**18), { from: oneHundred, gasPrice: 1});
                    const expectations = {
                        reduceToBurn: { actual: reduceToBurn.receipt.gasUsed, expected: 137370 },
                        emptyToBurn: { actual: emptyToBurn.receipt.gasUsed, expected: 107434 },
                    }
                    showRegressions(expectations);
                })
                it('burn with change', async function() {
                    const burnMicroDollar = await this.token.transfer(BURN_ADDRESS, BN(10**16).add(BN(10 ** 12)), { from: oneHundred, gasPrice: 1 });
                    const reduceToBurnWithChange = await this.token.transfer(BURN_ADDRESS, BN(98*10**18), { from: oneHundred, gasPrice: 1});
                    const emptyToBurnWithChange = await this.token.transfer(BURN_ADDRESS, BN(100*10**18).sub(BN(98*10**18)).sub(BN(10**16).add(BN(10**12))), { from: oneHundred, gasPrice: 1 });
                    const expectations = {
                        burnMicroDollar: { actual: burnMicroDollar.receipt.gasUsed, expected: 152370 },
                        reduceToBurnWithChange: { actual: reduceToBurnWithChange.receipt.gasUsed, expected: 137434 },
                        emptyToBurnWithChange: { actual: emptyToBurnWithChange.receipt.gasUsed, expected: 122434 },
                    }
                    showRegressions(expectations);
                })
            })
            describe('with refund', function() {
                beforeEach(async function() {
                  await this.token.setMinimumGasPriceForFutureRefunds(1, { from: oneHundred });
                  await this.token.sponsorGas({ from: oneHundred });
                  await this.token.sponsorGas({ from: owner });
                  await this.token.sponsorGas({ from: anotherAccount });
                })
                it('transfer', async function() {
                    const reduceToNewWithRefund = await this.token.transfer(anotherAccount, DOLLAR, { from: oneHundred, gasPrice: 2 });
                    const reduceToExistingWithRefund = await this.token.transfer(anotherAccount, DOLLAR, { from: oneHundred, gasPrice: 2 });
                    const emptyToExistingWithRefund = await this.token.transfer(anotherAccount, BN(98*10**18), { from: oneHundred, gasPrice: 2 });
                    const emptyToNewWithRefund = await this.token.transfer(oneHundred, BN(100*10**18), { from: anotherAccount, gasPrice: 2 });
                    const expectations = {
                      reduceToNewWithRefund: { actual: reduceToNewWithRefund.receipt.gasUsed, expected: 83165 },
                      reduceToExistingWithRefund: { actual: reduceToExistingWithRefund.receipt.gasUsed, expected: 68165 },
                      emptyToExistingWithRefund: { actual: emptyToExistingWithRefund.receipt.gasUsed, expected: 56615 },
                      emptyToNewWithRefund: { actual: emptyToNewWithRefund.receipt.gasUsed, expected: 68229 },
                    };
                    showRegressions(expectations);
                })
                it('transferFrom', async function() {
                    const approve50WithRefund = await this.token.approve(anotherAccount, BN(50).mul(DOLLAR), { from: oneHundred });
                    const reduceApprovalReducingToNewWithRefund = await this.token.transferFrom(oneHundred, anotherAccount, DOLLAR, { from: anotherAccount, gasPrice: 2 });
                    const reduceApprovalReducingToExistingWithRefund = await this.token.transferFrom(oneHundred, anotherAccount, DOLLAR, { from: anotherAccount, gasPrice: 2 });
                    const emptyApprovalReducingToExistingWithRefund = await this.token.transferFrom(oneHundred, anotherAccount, BN(48).mul(DOLLAR), { from: anotherAccount, gasPrice: 2});
                    const approve50bWithRefund = await this.token.approve(oneHundred, BN(50).mul(DOLLAR), { from: anotherAccount });
                    const emptyApprovalEmptyingToExistingWithRefund = await this.token.transferFrom(anotherAccount, oneHundred, BN(50).mul(DOLLAR), { from: oneHundred, gasPrice: 2});
                    const approve1WithRefund = await this.token.approve(anotherAccount, DOLLAR, { from: oneHundred, gasPrice: 2});
                    const emptyApprovalReducingToNewWithRefund = await this.token.transferFrom(oneHundred, anotherAccount, DOLLAR, { from: anotherAccount, gasPrice: 2});
                    const approve20WithRefund = await this.token.approve(oneHundred, BN(20).mul(DOLLAR), { from: anotherAccount, gasPrice: 2 });
                    const reduceApprovalEmptyingToExistingWithRefund = await this.token.transferFrom(anotherAccount, oneHundred, DOLLAR, { from: oneHundred, gasPrice: 2 });
                    const approve100WithRefund = await this.token.approve(anotherAccount, BN(100).mul(DOLLAR), { from: oneHundred, gasPrice: 2 });
                    const emptyApprovalEmptyingToNewWithRefund = await this.token.transferFrom(oneHundred, anotherAccount, BN(100).mul(DOLLAR), { from: anotherAccount, gasPrice: 2});
                    const approve101WithRefund = await this.token.approve(oneHundred, BN(101).mul(DOLLAR), { from: anotherAccount, gasPrice: 2 });
                    const reduceApprovalEmptyingToNewWithRefund = await this.token.transferFrom(anotherAccount, oneHundred, BN(100).mul(DOLLAR), { from: oneHundred, gasPrice: 2} );
                    
                    const expectations = {
                        reduceApprovalReducingToNewWithRefund : { actual: reduceApprovalReducingToNewWithRefund.receipt.gasUsed, expected: 95280 },
                        reduceApprovalReducingToExistingWithRefund : { actual: reduceApprovalReducingToExistingWithRefund.receipt.gasUsed, expected: 80280 },
                        reduceApprovalEmptyingToNewWithRefund : { actual: reduceApprovalEmptyingToNewWithRefund.receipt.gasUsed, expected: 80344 },
                        reduceApprovalEmptyingToExistingWithRefund : { actual: reduceApprovalEmptyingToExistingWithRefund.receipt.gasUsed, expected: 65280 },
                        emptyApprovalReducingToNewWithRefund : { actual: emptyApprovalReducingToNewWithRefund.receipt.gasUsed, expected: 80280 },
                        emptyApprovalReducingToExistingWithRefund : { actual: emptyApprovalReducingToExistingWithRefund.receipt.gasUsed, expected: 65344 },
                        emptyApprovalEmptyingToNewWithRefund : { actual: emptyApprovalEmptyingToNewWithRefund.receipt.gasUsed, expected: 70172 },
                        emptyApprovalEmptyingToExistingWithRefund : { actual: emptyApprovalEmptyingToExistingWithRefund.receipt.gasUsed, expected: 62672 },
                        approve50WithRefund: { actual: approve50WithRefund.receipt.gasUsed, expected: 64256 },
                    };
                    showRegressions(expectations);
                })

                it('burn', async function() {
                    const reduceToBurnWithRefund = await this.token.transfer(BURN_ADDRESS, DOLLAR, { from: oneHundred, gasPrice: 2 });
                    const emptyToBurnWithRefund = await this.token.transfer(BURN_ADDRESS, BN(99*10**18), { from: oneHundred, gasPrice: 2});
                    const expectations = {
                        reduceToBurnWithRefund: { actual: reduceToBurnWithRefund.receipt.gasUsed, expected: 114626 },
                        emptyToBurnWithRefund: { actual: emptyToBurnWithRefund.receipt.gasUsed, expected: 87345 },
                    }
                    showRegressions(expectations);
                })
                it('burn with change', async function() {
                    const burnMicroDollarWithRefund = await this.token.transfer(BURN_ADDRESS, BN(10**16).add(BN(10 ** 12)), { from: oneHundred, gasPrice: 2 });
                    const reduceToBurnWithChangeWithRefund = await this.token.transfer(BURN_ADDRESS, BN(98*10**18), { from: oneHundred, gasPrice: 2});
                    const emptyToBurnWithChangeWithRefund = await this.token.transfer(BURN_ADDRESS, BN(100*10**18).sub(BN(98*10**18)).sub(BN(10**16).add(BN(10**12))), { from: oneHundred, gasPrice: 2 });
                    const expectations = {
                        burnMicroDollarWithRefund: { actual: burnMicroDollarWithRefund.receipt.gasUsed, expected: 129626 },
                        reduceToBurnWithChangeWithRefund: { actual: reduceToBurnWithChangeWithRefund.receipt.gasUsed, expected: 114690 },
                        emptyToBurnWithChangeWithRefund: { actual: emptyToBurnWithChangeWithRefund.receipt.gasUsed, expected: 99690 },
                    }
                    showRegressions(expectations);
                })
            })
        })
    })
})
