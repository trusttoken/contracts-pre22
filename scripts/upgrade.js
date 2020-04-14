
/**
 * Waffle Deploy Script
 *
 * We use waffle to deploy our contracts.
 * Use the config object to set paramaters for deployment
 *
 */

// this might be unsafe. We want to use ethereum accounts

(async () => {
    const config = {
        rpc: process.argv[3] || 'http://localhost:7545',
        accountPrivateKey: process.argv[2],
        network: 5777
    }

    const ethers = require('ethers')
    const { setupDeployer, validatePrivateKey } = require('./utils')
    
    validatePrivateKey(config.accountPrivateKey)

    const provider = new ethers.providers.JsonRpcProvider(config.rpc)
    const wallet = new ethers.Wallet(config.accountPrivateKey, provider)

    const deploy = setupDeployer(ethers, wallet)

    // Deploy all contracts
    const trueUSDContract = await deploy('TrueUSD')
    console.log("TrueUSD: ", trueUSDContract.address)
    const tokenControllerContract = await deploy('TokenController')
    console.log("TokenController: ", tokenControllerContract.address)
    const aaveFinancialOpportunityContract = await deploy('AaveFinancialOpportunity')
    console.log("AaveFinancialOpportunity: ", aaveFinancialOpportunityContract.address)
    const assuredFinancialOpportunityContract = await deploy('AssuredFinancialOpportunity')
    console.log("AssuredFinancialOpportunity: ", assuredFinancialOpportunityContract.address)
    const ownedUpgradeabilityProxyContract = await deploy('OwnedUpgradeabilityProxy')
    console.log("OwnedUpgradeabilityProxy: ", ownedUpgradeabilityProxyContract.address)
    const fractionalExponentsContract = await deploy('FractionalExponents')
    console.log("FractionalExponents: ", fractionalExponentsContract.address)
    const stakingAssetContract = await deploy('StakingAsset')
    console.log("StakingAsset: ", stakingAssetContract.address)
    const liquidatorContract = await deploy('Liquidator')
    console.log("Liquidator: ", liquidatorContract.address)
    // Access contract's address by address property
    // For example: trueUSDContract.address

    // Deploy UpgradeHelper
    const deployHelperContract = await deploy('DeployHelper')
    
    // Run upgrade (pass all proper arguments)
    await deployHelperContract.setUp(
        // trueUsdProxy,
        // newTrueUsdImplementation,
        // assuredOpportunityProxy,
        // assuredOpportunityImplementation,
        // mockedOpportunity,
        // exponentContractAddress,
        // tokenControllerProxy,
        // tokenControllerImplmentation
    )
})()
