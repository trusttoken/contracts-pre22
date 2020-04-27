
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

  // deploy and return upgrade helper
  const deployAndGetUpgradeHelper = async() => {
    const upgradeHelper = await deploy('UpgradeHelper')
    await upgradeHelper.setup(
      contract.registryAddress,
      //contract.tusd.address,
      contract.tusdProxyAddress,
      //contract.tusdController.address,
      contract.controllerProxyAddress,
      //contract.assuredOpportunity.address,
      contract.assuredOpportunityProxyAddress,
      contract.financialOpportunityAddress,
      contract.exponentContractAddress,
      contract.assurancePoolAddress,
      contract.liquidatorAddress,
      { gasLimit: 5000000 }
    )
    return upgradeHelper
  }

  const upgradeTrueUSD = async (upgradeHelper, newTusdAddress) => {
    this.tusd = await deploy('TrueUSD')
  }

  // deploy and upgrade assured opportunity
  const upgradeAssuredOpportunity = async (upgradeHelper, newOpportunityAddress) => {
    this.lendingPoolCoreMock = await deploy('LendingPoolCoreMock')
    this.aTokenMock = await deploy(
      'ATokenMock', this.tusdProxy.address, this.lendingPoolCoreMock.address)
    this.financialOpportunity = await deploy(
      'ConfigurableFinancialOpportunityMock', this.aTokenMock.address)
    this.assuredOpportunity = await deploy('AssuredFinancialOpportunity')
    this.exponentContract = await deploy('FractionalExponents')
    this.trusttoken = await deploy('MockTrustToken', this.registry.address)
  }

  const upgradeTokenController = async (upgradeHelper, newTokenControllerAddress) => {

  }

  // get existing proxies (for upgrade calls)
  this.tusdProxy = contractAt(contracts.tusdProxyAddress)
  this.assuredOpportunityProxy = contractAt(contracts.assuredOpportunityProxyAddress)
  this.tokenControllerProxy = contractAt(contracts.controllerProxyAddress)

  // init deploy helper
  this.upgradeHelper = deployAndGetUpgradeHelper()

  // call upgrade functions
  upgradeTrueUSD(tusdProxy, tusd)

  // Deploy all contracts
  
  this.registry = await deploy('ProvisionalRegistryImplementation')
  this.tusdController = await deploy('TokenFaucet')

  // setup uniswap
  // needs to compile using truffle compile
  /*
  this.uniswapFactory = await deploy('uniswap_factory')
  this.uniswapTemplate = await deploy('uniswap_exchange')
  await this.uniswapFactory.initializeFactory(this.uniswapTemplate.address)
  this.tusdUniswapExchange = await this.uniswapFactory.createExchange(this.tusd.address)

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
  console.log('controller proxy transfer ownership')
  await this.tusdProxy.transferProxyOwnership(this.deployHelper.address)
  console.log('tusdProxy proxy transfer ownership')
  await this.liquidator.transferOwnership(this.deployHelper.address)
  console.log('liquidator proxy transfer ownership')
  await this.assuredOpportunityProxy.transferProxyOwnership(this.deployHelper.address)
  console.log('assuredOpportunityProxy proxy transfer ownership')
  await this.registry.transferOwnership(this.deployHelper.address)

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

  // setup controller through proxy
  this.controller = await contractAt('TokenFaucet',
    this.controllerProxy.address)
  await this.controller.claimOwnership({ gasLimit: 5000000 })
  console.log('TokenFaucet claim ownership')

  await this.controller.setMintThresholds(
    ethers.utils.bigNumberify('1000000000000000000000'),
    ethers.utils.bigNumberify('10000000000000000000000'),
    ethers.utils.bigNumberify('100000000000000000000000'),
  )
  console.log('set mint thresholds')

  console.log('\n\nSUCCESSFULLY DEPLOYED TO NETWORK: ', config.rpc, '\n\n')
})()
