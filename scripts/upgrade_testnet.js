
/**
 * Pattern to upgrade existing testnet smart contracts
 * Must be run by current owner of smart contracts
 *
 * node scripts/deploy_testnet.js "{private_key}" "{rpc_url}"
 *
 * We use ethers to upgrade our contracts.
 * For  deployment, use deploy/deploy_testnet.js
 * Use the config object to set paramaters for deployment
 */

(async () => {
  const rpcOptions = {
    rinkeby: 'https://rinkeby.infura.io/v3/81447a33c1cd4eb09efb1e8c388fb28e',
    development: 'http://localhost:7545'
  }

  const config = {
    rpc: process.argv[3] || rpcOptions.development,
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

  const contracts = require('./deployed/rinkeby_deployed.json')

  const upgradeTrueUSD = async () => {
    // todo
  }

  const upgradeAssuredOpportunity = async () => {
    // todo
  }

  const upgradeTokenController = async () => {
    // todo
  }

  // deploy and return upgrade helper
  this.deployAndGetUpgradeHelper = async() => {
    const upgradeHelper = await deploy('UpgradeHelper')
    await upgradeHelper.setup(
      contract.registryAddress,
      contract.tusdProxyAddress,
      contract.controllerProxyAddress,
      contract.assuredOpportunityProxyAddress,
      contract.financialOpportunityAddress,
      contract.exponentContractAddress,
      contract.assurancePoolAddress,
      contract.liquidatorAddress,
      { gasLimit: 5000000 }
    )
    return upgradeHelper
  }

  // get existing proxies (for upgrade calls)
  this.tusdProxy = contractAt(contracts.tusdProxyAddress)
  this.assuredOpportunityProxy = contractAt(contracts.assuredOpportunityProxyAddress)
  this.tokenControllerProxy = contractAt(contracts.controllerProxyAddress)

  // init deploy helper
  this.upgradeHelper = deployAndGetUpgradeHelper()

  // transfer ownership
  // transfer proxy ownership to deploy helper
  await this.controllerProxy.transferProxyOwnership(this.deployHelper.address)
  console.log('controller proxy transfer ownership')
  await this.tusdProxy.transferProxyOwnership(this.deployHelper.address)
  console.log('tusdProxy proxy transfer ownership')
  await this.liquidator.transferOwnership(this.deployHelper.address)
  console.log('liquidator proxy transfer ownership')
  await this.assuredOpportunityProxy.transferProxyOwnership(this.deployHelper.address)
  console.log('assuredOpportunityProxy proxy transfer ownership')
  await this.registry.transferOwnership(this.deployHelper.address)

  // call upgrade function
  this.upgradeTrueUSD()
  console.log("upgrade TUSD");

  // reclaim ownership
  await this.controllerProxy.claimProxyOwnership({ gasLimit: 5000000 })
  console.log('controllerProxy claim ownership')
  await this.tusdProxy.claimProxyOwnership({ gasLimit: 5000000 })
  console.log('tusdProxy claim ownership')
  await this.liquidator.claimOwnership({ gasLimit: 5000000 })
  console.log('liquidator claim ownership')
  await this.assuredOpportunityProxy.claimProxyOwnership({ gasLimit: 5000000 })
  console.log('assuredOpportunityProxy claim ownership')
  await this.registry.claimOwnership({ gasLimit: 5000000 })
  console.log('registry claim ownership')

  console.log('\n\nSUCCESSFULLY UPGRADED ON NETWORK: ', config.rpc, '\n\n')
})()
