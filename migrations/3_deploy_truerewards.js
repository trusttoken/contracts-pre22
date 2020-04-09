var TrueUSD = artifacts.require("TrueUSD");
var AaveFinancialOpportuity = artifacts.require("AaveFinancialOpportuity")
var AssuredFinancialOpportuity = artifacts.require("AssuredFinancialOpportuity")
var AaveFinancialOpportuity = artifacts.require("AaveFinancialOpportuity")

module.exports = async (deployer, network, accounts) => {
    var defaultAccount;
    if (network == "live") {
        defaultAccount = accounts[0]
    } else {
        defaultAccount = accounts[1]
    }

    await deployer.deploy(TrueUSD)
    await deployer.deploy(AaveFinancialOpportuity)
    await deployer.deploy(AssuredFinancialOpportunity)
}