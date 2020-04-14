
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
  const rpcOptions = {
    rinkeby: 'https://rinkeby.infura.io/v3/81447a33c1cd4eb09efb1e8c388fb28e',
    development: 'http://localhost:7545'
  }
  const config = {
    rpc: process.argv[3] || rpcOptions.rinkeby,
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

  this.deployHelper = await contractAt('TestnetDeployHelper', '0xC640024E0372B4949F343b9e2d6047aC37822381')
  this.registry = await contractAt('ProvisionalRegistryImplementation', 'address')
  this.tusd = await contractAt('TrueUSD', '0xCA5Aab260134B007a49E47F8cEE2d0884D2D482D')
  this.tusdProxy = await contractAt('OwnedUpgradeabilityProxy', '0x19b9116741B4cc6aB43389a1fbF8d148cE8a0293')
  this.tusdController = await contractAt('TokenFaucet', 'address')
  this.controllerProxy = await contractAt('OwnedUpgradeabilityProxy', '0xb129060DC999361dE72812C786A53A399C416876')
  this.assuredOpportunity = await contractAt('AssuredFinancialOpportunity', 'address')
  this.assuredOpportunityProxy = await contractAt('OwnedUpgradeabilityProxy', '0x62ECeff223088a7af27f7834d1e72AfEbD8E4c34')
  this.financialOpportunity = await contractAt('ConfigurableFinancialOpportunityMock', 'address')
  this.exponentContract = await contractAt('ExponentContract', 'address')
  this.assurancePool = await contractAt('StakedToken', 'address')
  this.liquidator = await contractAt('Liquidator', 'address')

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
    this.liquidator.address,
    { gasLimit: 5000000 }
  )
  console.log("deployHelper: setup")

  // reclaim ownership
  await this.controllerProxy.claimProxyOwnership()
  console.log("controllerProxy claim ownership")
  await this.tusdProxy.claimProxyOwnership()
  console.log("tusdProxy claim ownership")
  await this.liquidator.claimOwnership()
  console.log("liquidator claim ownership")
  await this.assuredOpportunityProxy.claimProxyOwnership()
  console.log("assuredOpportunityProxy claim ownership")
  await this.registry.claimOwnership()
  console.log("registry claim ownership")

  // setup controller through proxy
  this.controller = await contractAt('TokenFaucet', 
    this.controllerProxy.address)
  await this.controller.claimOwnership()
  console.log("TokenFaucet claim ownership")

  console.log("\n\nSUCCESSFULLY DEPLOYED TO NETWORK: ", config.rpc, "\n\n")
})()
