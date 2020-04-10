
(async () => {
    const ethers = require('ethers')
    const provider = new ethers.providers.JsonRpcProvider('https://ropsten.infura.io/v3/2021bd729a8e4d848f3cdbf8bc300881')
    const wallet = new ethers.Wallet('0xfe7c874c470d8353ecb20a2bbad8aa953b1952901f340e699a0c83e0a9557942', provider)

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
    const tokenControllerContract = await deploy('TokenController')
    const aaveFinancialOpportunityContract = await deploy('AaveFinancialOpportunity')
    const assuredFinancialOpportunityContract = await deploy('AssuredFinancialOpportunity')
    const ownedUpgradeabilityProxyContract = await deploy('OwnedUpgradeabilityProxy')
    const fractionalExponentsContract = await deploy('FractionalExponents')
    const stakingAssetContract = await deploy('StakingAsset')
    // Access contract's address by address property
    // For example trueUSDContract.address

    // Deploy UpgradeHelper
    const upgradeHelperContract = await deploy('UpgradeHelper')
    
    // Run upgrade (pass all proper arguments)
    await upgradeHelperContract.performUpgrade(
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
