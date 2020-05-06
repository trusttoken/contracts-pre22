
/**
 * Waffle Deploy Script
 *
 * node scripts/deploy_testnet.js "{private_key}" "{rpc_url}"
 *
 * We use ethers to deploy our contract.
 * For upgrades, use deploy/upgrade_testnet.js
 * Use the config object to set paramaters for deployment
 */

(async () => {
  const rpcOptions = {
    rinkeby: 'https://rinkeby.infura.io/v3/81447a33c1cd4eb09efb1e8c388fb28e',
    development: 'http://localhost:7545',
  }

  const config = {
    rpc: process.argv[3] || rpcOptions.development,
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

  const safeMath = await deploy('SafeMath')
  console.log('deployed SafeMath at: ', safeMath.address)

  const tusd = await deploy('TrueUSD')
  const tusdProxy = await deploy('OwnedUpgradeabilityProxy')
  console.log('deployed tusdProxy at: ', tusdProxy.address)

  const tusdController = await deploy('TokenFaucet')
  const controllerProxy = await deploy('OwnedUpgradeabilityProxy')
  console.log('deployed controllerProxy at: ', controllerProxy.address)

  const assuredOpportunity = await deploy('AssuredFinancialOpportunity')
  const assuredOpportunityProxy = await deploy('OwnedUpgradeabilityProxy')
  console.log('deployed assuredOpportunityProxy at: ', assuredOpportunityProxy.address)

  // Deploy the rest of the contracts
  const registry = await deploy('ProvisionalRegistryImplementation')
  const lendingPoolCoreMock = await deploy('LendingPoolCoreMock')
  const aTokenMock = await deploy('ATokenMock', tusdProxy.address, lendingPoolCoreMock.address)
  const financialOpportunity = await deploy('ConfigurableFinancialOpportunityMock', aTokenMock.address)
  const exponentContract = await deploy('FractionalExponents')
  const trustToken = await deploy('MockTrustToken', registry.address)

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
  const liquidator = await deploy('Liquidator', registry.address,
    tusd.address, trustToken.address, ZERO,
    ZERO)

  // deploy assurance pool
  const assurancePool = await deploy('StakedToken', trustToken.address,
    tusd.address, registry.address,
    liquidator.address)

  // Deploy UpgradeHelper
  const deployHelper = await deploy('TestnetDeployHelper')

  // transfer proxy ownership to deploy helper
  await controllerProxy.transferProxyOwnership(deployHelper.address)
  console.log('controller proxy transfer ownership')
  await tusdProxy.transferProxyOwnership(deployHelper.address)
  console.log('tusdProxy proxy transfer ownership')
  await liquidator.transferOwnership(deployHelper.address)
  console.log('liquidator proxy transfer ownership')
  await assuredOpportunityProxy.transferProxyOwnership(deployHelper.address)
  console.log('assuredOpportunityProxy proxy transfer ownership')
  await registry.transferOwnership(deployHelper.address)

  // call deployHelper
  await deployHelper.setup(
    registry.address,
    tusd.address,
    tusdProxy.address,
    tusdController.address,
    controllerProxy.address,
    assuredOpportunity.address,
    assuredOpportunityProxy.address,
    financialOpportunity.address,
    exponentContract.address,
    assurancePool.address,
    liquidator.address,
    { gasLimit: 5000000 },
  )
  console.log('deployHelper: setup')

  // reclaim ownership
  await controllerProxy.claimProxyOwnership({ gasLimit: 5000000 })
  console.log('controllerProxy claim ownership')
  await tusdProxy.claimProxyOwnership({ gasLimit: 5000000 })
  console.log('tusdProxy claim ownership')
  await liquidator.claimOwnership({ gasLimit: 5000000 })
  console.log('liquidator claim ownership')
  await assuredOpportunityProxy.claimProxyOwnership({ gasLimit: 5000000 })
  console.log('assuredOpportunityProxy claim ownership')
  await registry.claimOwnership({ gasLimit: 5000000 })
  console.log('registry claim ownership')

  // setup controller through proxy
  const controller = await contractAt('TokenFaucet',
    controllerProxy.address)
  await controller.claimOwnership({ gasLimit: 5000000 })
  console.log('TokenFaucet claim ownership')

  await controller.setMintThresholds(
    ethers.utils.bigNumberify('1000000000000000000000'),
    ethers.utils.bigNumberify('10000000000000000000000'),
    ethers.utils.bigNumberify('100000000000000000000000'),
    { gasLimit: 5000000 },
  )
  console.log('set mint thresholds')

  console.log('\n\nSUCCESSFULLY DEPLOYED TO NETWORK: ', config.rpc, '\n\n')
})()
