var TrueUSD = artifacts.require("TrueUSD");
var AaveFinancialOpportunity = artifacts.require("AaveFinancialOpportunity")
var AssuredFinancialOpportunity = artifacts.require("AssuredFinancialOpportunity")
var TokenController = artifacts.require("TokenController")
var Liquidator = artifacts.require("Liquidator")
var StakingAsset = artifacts.require("StakingAsset")
var FractionalExponents = artifacts.require("FractionalExponents")
var OwnedUpgradeabilityProxy = artifacts.require("OwnedUpgradeabilityProxy")
var UpgradeHelper = artifacts.require("UpgradeHelper")

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
    trueUSDContract = await TrueUSD.deployed()
    console.log("TrueUSD address: ", TrueUSD.address)

    // Deploy TokenController
    await deployer.deploy(TokenController)
    tokenControllerContract = await TokenController.deployed()
    console.log("TokenController address: ", TokenController.address)

    // Deploy Aave Financial Opportunity
    await deployer.deploy(AaveFinancialOpportunity)
    AaveFinancialOpportunityContract = await AaveFinancialOpportunity.deployed()
    console.log("AaveFinancialOpportunity address: ", AaveFinancialOpportunity.address)

    // Deploy Assured Financial Opportunity
    await deployer.deploy(AssuredFinancialOpportunity)
    assuredFinancialOpportunityContract = await AssuredFinancialOpportunity.deployed()
    console.log("AssuredFinancialOpportunity address: ", AssuredFinancialOpportunity.address)

    // Deploy Financial Opportunity Proxy
    OwnedUpgradeabilityProxy
    await deployer.deploy(OwnedUpgradeabilityProxy)
    OwnedUpgradeabilityProxyContract = await OwnedUpgradeabilityProxy.deployed()
    console.log("OwnedUpgradeabilityProxy address: ", OwnedUpgradeabilityProxy.address)

    // Deploy Exponents Contract
    await deployer.deploy(FractionalExponents)
    FractionalExponentsContract = await FractionalExponents.deployed()
    console.log("FractionalExponents address: ", FractionalExponents.address)

    // Deploy StakingAsset (Staking Pool)
    // todo feewet

    // Call Upgrade Helper
    await deployer.deploy(FractionalExponents)
    FractionalExponentsContract = await FractionalExponents.deployed()
    console.log("FractionalExponents address: ", FractionalExponents.address)
    
}