var TrueUSD = artifacts.require("TrueUSD");
var AaveFinancialOpportuity = artifacts.require("AaveFinancialOpportuity")
var AssuredFinancialOpportuity = artifacts.require("AssuredFinancialOpportuity")
var TokenController = artifacts.require("TokenController")
var Liquidator = artifacts.require("Liquidator")
var StakingAsset = artifacts.require("StakingAsset")
var FractionalExponents = artifacts.require("FractionalExponents")
var AssuranceProxy = artifacts.require("AssuranceProxy")

module.exports = async (deployer, network, accounts) => {
    var defaultAccount;
    if (network == "live") {
        defaultAccount = accounts[0]
    } else {
        defaultAccount = accounts[1]
    }

    /* 
     * TrueUSD & TrueRewards deployment process
     * 1. Deploy TrueUSD and TokenController
     * 2. Deploy Assured & Aave Financial Opportunity
     * 3. Deploy StakingAsset (Staking Pool) & Liquidator
     * 4. Call UpgradeHelper contract with addresses
    */

    // Deploy TrueUSD
    await deployer.deploy(TrueUSD)
    trueUSDContract = TrueUSD.deployed()
    console.log("TrueUSD address: " TrueUSD.address)

    // Deploy TokenController
    await TokenController.deploy(TokenController)
    tokenControllerContract = TokenController.deployed()
    console.log("TokenController address: " TokenController.address)

    // Deploy Aave Financial Opportunity
    await deployer.deploy(AaveFinancialOpportuity)
    aaveFinancialOpportuityContract = AaveFinancialOpportuity.deployed()
    console.log("AaveFinancialOpportuity address: " AaveFinancialOpportuity.address)

    // Deploy Assured Financial Opportunity
    await deployer.deploy(AssuredFinancialOpportunity)
    assuredFinancialOpportunityContract = AssuredFinancialOpportunity.deployed()
    console.log("AssuredFinancialOpportunity address: " AssuredFinancialOpportunity.address)
    
    // Deploy StakingAsset (Staking Pool)
    
}