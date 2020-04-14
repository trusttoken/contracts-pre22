
/**
 * Waffle Deploy Script
 *
 * We use waffle to deploy our contracts from scratch.
 * For upgrades, use deploy/upgrade.js
 * Use the config object to set paramaters for deployment
 */

// this might be unsafe. We want to use ethereum accounts instead of hardcode pk

(async () => {

    const config = {
        rpc: 'http://localhost:7545',
        accountPrivateKey: 'ac74a462679b69b28f5c3c124eda5cc521a0d3d5ca9b0877f9e500ed94c24414',
        network: 5777,
        gas: 40000000
    }

    const ethers = require('ethers')
    const provider = new ethers.providers.JsonRpcProvider(config.rpc)
    const wallet = new ethers.Wallet(config.accountPrivateKey, provider)
    console.log(provider)

    // function to deploy contract with args
    // args are passed as an array
    const deploy = async (contractName, ...args) => {
        console.log(...args)
        const contractJson = require(`../build/${contractName}.json`)
        const deployTransaction = new ethers.ContractFactory(
            contractJson.abi, contractJson.bytecode).getDeployTransaction(...args)
        const transaction = await wallet.sendTransaction(deployTransaction, { gas: config.gas })
        const receipt = await wallet.provider.waitForTransaction(transaction.hash)
        console.log(`${contractName} address: ${receipt.contractAddress}`)
        return new ethers.Contract(receipt.contractAddress, contractJson.abi, wallet)
    }

    this.tusdProxy = await deploy('OwnedUpgradeabilityProxy')
    this.controllerProxy = await deploy('OwnedUpgradeabilityProxy')
    this.assuranceProxy = await deploy('OwnedUpgradeabilityProxy')

    // Deploy all contracts
    this.tusd = await deploy('TrueUSD')
    this.registry = await deploy('ProvisionalRegistryImplementation')
    this.tokenController = await deploy('TokenController')
    this.aaveFinancialOpportunity = await deploy('AaveFinancialOpportunity')
    this.assuredFinancialOpportunity = await deploy('AssuredFinancialOpportunity')
    this.ownedUpgradeabilityProxy = await deploy('OwnedUpgradeabilityProxy')
    this.fractionalExponents = await deploy('FractionalExponents')

    // deploy trusttoken
    this.trusttoken = await deploy('MockTrustToken', this.registry.address)

    // setup uniswap
    this.uniswapFactory = await deploy('contracts/uniswap_factory')
    this.uniswapTemplate = await deploy('contracts/uniswap_exchange')
    //this.tusdUniswapAddress = (await this.uniswapFactory.createExchange(
    //    this.tusdProxy.address))//.logs[0].args.exchange
    this.tusdUniswap = await UniswapExchange.at(this.tusdUniswapAddress)
    this.tusdUniswap = new ethers.Contract(this.tusdUniswapAddress, contractJson.abi, wallet)
    this.trustUniswapAddress = (await this.uniswapFactory.createExchange(
        this.trusttoken.address)).logs[0].args.exchange
    this.trustUniswap = await UniswapExchange.at(this.trustUniswapAddress)

    // deploy liquidator
    this.liquidator = await deploy('Liquidator', this.registry.address, 
        this.tusd.address, this.trusttoken.address, this.tusdUniswap.address, 
        this.trustUniswap.address)
    
    // deploy assurance pool
    this.assurancePool = await deploy('StakedToken', this.trusttoken.address,
        this.tusd.address, this.registry.address,
        this.liquidator.address)
    
    // Deploy UpgradeHelper
    this.deployHelper = await deploy('DeployHelper')
    
    // transfer proxy ownership to deploy helper
    await this.controllerProxy.transferProxyOwnership(this.deployHelper.address)
    await this.tusdProxy.transferProxyOwnership(this.deployHelper.address)
    await this.liquidator.transferOwnership(this.deployHelper.address)
    await this.assuredOpportunityProxy.transferProxyOwnership(this.deployHelper.address)
    await this.registry.transferOwnership(this.deployHelper.address)

})()
