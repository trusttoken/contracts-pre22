
/**
 * Waffle Deploy Script
 *
 * We use waffle to deploy our contracts.
 * Use the config object to set paramaters for deployment
 *
 */

// this might be unsafe. We want to use ethereum accounts
const config = {
    rpc: 'localhost:7585',
    accountPrivateKey: 'ac74a462679b69b28f5c3c124eda5cc521a0d3d5ca9b0877f9e500ed94c24414'
}

(async () => {
    const ethers = require('ethers')
    const provider = new ethers.providers.JsonRpcProvider(config.rpc)
    const wallet = new ethers.Wallet(config.accountPrivateKey, provider)

    const deploy = async (contractName) => {
            const contractJson = require(`../build/${contractName}.json`)
            const deployTransaction = new ethers.ContractFactory(contractJson.abi, contractJson.bytecode).getDeployTransaction()
            const transaction = await wallet.sendTransaction(deployTransaction, { gas: 40000000 })
            const receipt = await wallet.provider.waitForTransaction(transaction.hash)
            console.log(`${contractName} address: ${receipt.contractAddress}`)
            return new ethers.Contract(receipt.contractAddress, contractJson.abi, wallet)
            
    }

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
