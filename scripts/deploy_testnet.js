
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
    rpc: process.argv[3] || 'http://localhost:7545',
    accountPrivateKey: process.argv[2],
    network: 5777,
    gas: 40000000
  }

  const ethers = require('ethers')
  const { setupDeployer, getContract, validatePrivateKey } = require('./utils')
  
  validatePrivateKey(config.accountPrivateKey)

  const provider = new ethers.providers.JsonRpcProvider(config.rpc)
  const wallet = new ethers.Wallet(config.accountPrivateKey, provider)

  const deploy = setupDeployer(ethers, wallet)
  const contractAt = getContract(ethers, wallet)

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
  // needs to compile using truffle compile
  this.uniswapFactory = await deploy('uniswap_factory')
  this.uniswapTemplate = await deploy('uniswap_exchange')
  await this.uniswapFactory.initializeFactory(this.uniswapTemplate.address)

  this.tusdUniswapExchange = await this.uniswapFactory.createExchange(this.tusd.address, {gasPrice: 70000000})
  
  console.log(this.tusdUniswapExchange)
  // this.tusdUniswapAddress = (await this.uniswapFactory.createExchange(
  //   this.tusdProxy.address))//.logs[0].args.exchange
  this.tusdUniswap = await contractAt('uniswap_exchange', 
    this.tusdUniswap.address)

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
