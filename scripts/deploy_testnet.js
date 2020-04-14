
/**
 * Waffle Deploy Script
 *
 * 
 *
 * We use waffle to deploy our contracts from scratch.
 * For upgrades, use deploy/upgrade.js
 * Use the config object to set paramaters for deployment
 */

(async () => {
  const config = {
    rpc: process.argv[3] || 'https://rinkeby.infura.io/v3/81447a33c1cd4eb09efb1e8c388fb28e',
    accountPrivateKey: process.argv[2],
    network: 'rinkeby',
    gas: 40000000
  }

  const ethers = require('ethers')
  const { setupDeployer, getContract, validatePrivateKey } = require('./utils')
  
  validatePrivateKey(config.accountPrivateKey)

  const provider = new ethers.providers.JsonRpcProvider(config.rpc)
  const wallet = new ethers.Wallet(config.accountPrivateKey, provider)

  const deploy = setupDeployer(ethers, wallet)
  const contractAt = getContract(ethers, wallet)

  const ZERO = '0x0000000000000000000000000000000000000000'

  this.tusdProxy = await deploy('OwnedUpgradeabilityProxy')
  this.controllerProxy = await deploy('OwnedUpgradeabilityProxy')
  this.assuranceProxy = await deploy('OwnedUpgradeabilityProxy')
  this.assuredOpportunityProxy = await deploy('OwnedUpgradeabilityProxy')

  // Deploy all contracts
  this.tusd = await deploy('TrueUSD')
  this.registry = await deploy('ProvisionalRegistryImplementation')
  this.tusdController = await deploy('TokenFaucet')

  this.lendingPoolCoreMock = await deploy('LendingPoolCoreMock')

  this.aTokenMock = await deploy(
    'ATokenMock', this.tusdProxy.address, this.lendingPoolCoreMock.address)

  this.financialOpportunity = await deploy(
    'ConfigurableFinancialOpportunityMock', this.aTokenMock.address)

  this.assuredOpportunity = await deploy('AssuredFinancialOpportunity')
  this.exponentContract = await deploy('FractionalExponents')

  // deploy trusttoken
  this.trusttoken = await deploy('MockTrustToken', this.registry.address)

  // setup uniswap
  // needs to compile using truffle compile
  /*
  this.uniswapFactory = await deploy('contracts/uniswap_factory')
  this.uniswapTemplate = await deploy('contracts/uniswap_exchange')
  await this.uniswapFactory.initializeFactory(this.uniswapTemplate.address)
  this.tusdUniswapExchange = await this.uniswapFactory.createExchange(this.tusd.address)
  
  console.log(this.tusdUniswapExchange)
  // this.tusdUniswapAddress = (await this.uniswapFactory.createExchange(
  //   this.tusdProxy.address))//.logs[0].args.exchange
  this.tusdUniswap = await contractAt('contracts/uniswap_exchange', 
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
  */
  // deploy liquidator
  this.liquidator = await deploy('Liquidator', this.registry.address, 
    this.tusd.address, this.trusttoken.address, ZERO, 
    ZERO)
  
  // deploy assurance pool
  this.assurancePool = await deploy('StakedToken', this.trusttoken.address,
    this.tusd.address, this.registry.address,
    this.liquidator.address)

  // Deploy UpgradeHelper
  this.deployHelper = await deploy('TestnetDeployHelper')
  
  // transfer proxy ownership to deploy helper
  await this.controllerProxy.transferProxyOwnership(this.deployHelper.address)
  await this.tusdProxy.transferProxyOwnership(this.deployHelper.address)
  await this.liquidator.transferOwnership(this.deployHelper.address)
  await this.assuredOpportunityProxy.transferProxyOwnership(this.deployHelper.address)
  await this.registry.transferOwnership(this.deployHelper.address)

  // call deployHelper
  await this.deployHelper.setup(
    this.registry.address,
    this.tusd.address,
    this.tusdProxy.address,
    this.tusdController.address,
    this.controllerProxy.address,
    this.assuredOpportunity.address,
    this.assuredOpportunityProxy.address,
    this.financialOpportunity.address,
    this.exponentContract.address,
    this.assurancePool.address,
    this.liquidator.address
  )

  // reclaim ownership
  await this.controllerProxy.claimProxyOwnership()
  await this.tusdProxy.claimProxyOwnership()
  await this.liquidator.claimOwnership()
  await this.assuredOpportunityProxy.claimProxyOwnership()
  await this.registry.claimOwnership()

  // setup controller through proxy
  this.controller = await contractAt('TokenFaucet', 
    this.controllerProxy.address)
  await this.controller.claimOwnership()

})()
