const Registry = artifacts.require("Registry")
const TrueUSDMock = artifacts.require("TrueUSDMock")
const TrueUSD = artifacts.require("TrueUSD")
const BalanceSheet = artifacts.require("BalanceSheet")
const AllowanceSheet = artifacts.require("AllowanceSheet")
const OwnedUpgradeabilityProxy = artifacts.require("OwnedUpgradeabilityProxy")

contract('GasRefundToken', function ([_, owner, oneHundred, anotherAccount]) {

    describe('--Gas Refund Token--', function () {
        const DOLLAR = 1*10**18;
        beforeEach(async function () {
            this.balances = await BalanceSheet.new({ from: owner })
            this.allowances = await AllowanceSheet.new({ from: owner })
            this.tokenProxy = await OwnedUpgradeabilityProxy.new({from: owner});
            this.tokenImpl = await TrueUSD.new(owner, 0, { from: owner })
            this.registryProxy = await OwnedUpgradeabilityProxy.new({from: owner});
            this.registryImpl = await Registry.new({ from: owner })

            this.tokenProxy.upgradeTo(this.tokenImpl.address, {from: owner});
            this.registryProxy.upgradeTo(this.registryProxy.address, {from: owner});
            this.token = await TrueUSD.at(this.tokenProxy.address);
            this.registry = await Registry.at(this.registryProxy.address);

            await this.token.setRegistry(this.registry.address, { from: owner })
            await this.balances.transferOwnership(this.token.address, { from: owner })
            await this.allowances.transferOwnership(this.token.address, { from: owner })
            await this.token.setBalanceSheet(this.balances.address, { from: owner })
            await this.token.setAllowanceSheet(this.allowances.address, { from: owner })

            await this.registry.setAttributeValue(oneHundred, "hasPassedKYC/AML", 1, { from: owner })
            await this.token.mint(oneHundred, 100*10**18, { from: owner })
            await this.registry.setAttributeValue(oneHundred, "hasPassedKYC/AML", 0, { from: owner })
            await this.registry.setAttributeValue(oneHundred, "canSetFutureRefundMinGasPrice", 1, { from: owner });
        })

        it('does not regress in cost without refund', async function(){
            const reduceToNewNoRefund = await this.token.transfer(anotherAccount, DOLLAR, { from: owner });
            assert.equal(reduceToNewNoRefund.receipt.gasUsed, 65000);
            const reduceToExistingNoRefund = await this.token.transfer(anotherAccount, DOLLAR, { from: owner });
            assert.equal(reduceToNewNoRefund.receipt.gasUsed, 50000);
            const emptyToExistingNoRefund = await this.token.transfer(anotherAccount, await this.token.balanceOf(owner), { from: owner });
            assert.equal(emptyToExistingNoRefund.receipt.gasUsed, 35000);
            const emptyToNewNoRefund = await this.token.transfer(owner, await this.token.balanceOf(anotherAccount), { from: anotherAccount });
            assert.equal(emptyToExistingNoRefund.receipt.gasUsed, 50000);
        })

        it('does not regress in cost with refund', async function() {
            await this.token.setMinimumGasPriceForFutureRefunds(1, { from: oneHundred });
            await this.token.sponsorGas({ from: oneHundred });
            await this.token.sponsorGas({ from: owner });
            const reduceToNewNoRefund = await this.token.transfer(anotherAccount, DOLLAR, { from: owner, gasPrice: 2 });
            assert.equal(reduceToNewNoRefund.receipt.gasUsed, 32500);
            const reduceToExistingNoRefund = await this.token.transfer(anotherAccount, DOLLAR, { from: owner, gasPrice: 2 });
            assert.equal(reduceToNewNoRefund.receipt.gasUsed, 30000);
            const emptyToExistingNoRefund = await this.token.transfer(anotherAccount, await this.token.balanceOf(owner), { from: owner, gasPrice: 2 });
            assert.equal(emptyToExistingNoRefund.receipt.gasUsed, 30000);
            const emptyToNewNoRefund = await this.token.transfer(owner, await this.token.balanceOf(anotherAccount), { from: anotherAccount, gasPrice: 2 });
            assert.equal(emptyToExistingNoRefund.receipt.gasUsed, 30000);
        })
    })

