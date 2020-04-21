
/**
 * Waffle Deploy Script
 *
 * node scripts/deploy_testnet.js "{private_key}" "{rpc_url}"
 *
 * We use waffle to deploy our contracts from scratch.
 * For upgrades, use deploy/upgrade.js
 * Use the config object to set paramaters for deployment
 */

(async () => {
  const rpcOptions = {
    rinkeby: 'https://rinkeby.infura.io/v3/81447a33c1cd4eb09efb1e8c388fb28e',
    development: 'http://localhost:7545',
  }

  const config = {
    rpc: process.argv[3] || rpcOptions.rinkeby,
    accountPrivateKey: process.argv[2],
    network: 'rinkeby',
    gas: 40000000,
  }

  const ethers = require('ethers')
  const { setupDeployer, getContract, validatePrivateKey } = require('./utils')

  validatePrivateKey(config.accountPrivateKey)

  const provider = new ethers.providers.JsonRpcProvider(config.rpc)
  const wallet = new ethers.Wallet(config.accountPrivateKey, provider)

  const deploy = setupDeployer(ethers, wallet)
  const contractAt = getContract(ethers, wallet)

  const ZERO = '0x0000000000000000000000000000000000000000'

  this.safeMath = await deploy('SafeMath') 
  console.log('deployed SafeMath at: ', this.safeMath.address)
  this.tusdProxy = await deploy('OwnedUpgradeabilityProxy')
  console.log('deployed tusdProxy at: ', this.tusdProxy.address)
  this.controllerProxy = await deploy('OwnedUpgradeabilityProxy')
  console.log('deployed controllerProxy at: ', this.controllerProxy.address)
  this.assuredOpportunityProxy = await deploy('OwnedUpgradeabilityProxy')
  console.log('deployed assuredOpportunityProxy at: ', this.assuredOpportunityProxy.address)

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
    { gasLimit: 5000000 },
  )
  console.log('deployHelper: setup')

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
    { gasLimit: 5000000 }
  )
  console.log('set mint thresholds')

  console.log('\n\nSUCCESSFULLY DEPLOYED TO NETWORK: ', config.rpc, '\n\n')
})()
