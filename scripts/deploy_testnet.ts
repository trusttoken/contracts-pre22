/**
 * Ethers Deploy Script
 *
 * ts-node scripts/deploy_testnet.ts "{private_key}" "{rpc_url}"
 *
 * We use ethers to deploy our contracts from scratch.
 * For upgrades, use deploy/upgrade.ts
 * Use the config object to set parameters for deployment
 */

import { ethers, providers } from 'ethers'
import { setupDeployer, validatePrivateKey } from './utils'

const rpcOptions = {
  rinkeby: 'https://rinkeby.infura.io/v3/81447a33c1cd4eb09efb1e8c388fb28e',
  development: 'http://localhost:7545',
}

export const deploy = async (accountPrivateKey: string, provider: providers.JsonRpcProvider) => {
  validatePrivateKey(accountPrivateKey)

  const wallet = new ethers.Wallet(accountPrivateKey, provider)

  const deploy = setupDeployer(wallet)

  const ZERO = '0x0000000000000000000000000000000000000000'

  const safeMath = await deploy('SafeMath')
  console.log('deployed SafeMath at: ', safeMath.address)

  const trueUSDImplementation = await deploy('TrueUSD')
  const trueUSDProxy = await deploy('OwnedUpgradeabilityProxy')
  const trueUSD = trueUSDImplementation.attach(trueUSDProxy.address)
  console.log('deployed trueUSDProxy at: ', trueUSDProxy.address)

  const registryImplementation = await deploy('ProvisionalRegistryImplementation')
  const registryProxy = await deploy('OwnedUpgradeabilityProxy')
  const registry = registryImplementation.attach(registryProxy.address)
  console.log('deployed registryProxy at: ', registryProxy.address)

  const tokenControllerImplementation = await deploy('TokenController')
  const tokenControllerProxy = await deploy('OwnedUpgradeabilityProxy')
  const tokenController = tokenControllerImplementation.attach(tokenControllerProxy.address)
  console.log('deployed tokenControllerProxy at: ', tokenControllerProxy.address)

  const assuredFinancialOpportunityImplementation = await deploy('AssuredFinancialOpportunity')
  const assuredFinancialOpportunityProxy = await deploy('OwnedUpgradeabilityProxy')
  const assuredFinancialOpportunity = assuredFinancialOpportunityImplementation.attach(assuredFinancialOpportunityProxy.address)
  console.log('deployed assuredFinancialOpportunityProxy at: ', assuredFinancialOpportunityProxy.address)

  // Deploy the rest of the contracts
  const lendingPoolCoreMock = await deploy('LendingPoolCoreMock')
  const aTokenMock = await deploy('ATokenMock', trueUSDProxy.address, lendingPoolCoreMock.address)
  const lendingPoolMock = await deploy('LendingPoolMock', lendingPoolCoreMock.address, aTokenMock.address)
  const fractionalExponents = await deploy('FractionalExponents')
  const trustToken = await deploy('MockTrustToken', registry.address)

  const financialOpportunityImplementation = await deploy('AaveFinancialOpportunity')
  const financialOpportunityProxy = await deploy('OwnedUpgradeabilityProxy')
  console.log('deployed aaveFinancialOpportunityProxy at: ', financialOpportunityProxy.address)

  const liquidatorImplementation = await deploy('Liquidator')
  const liquidatorProxy = await deploy('OwnedUpgradeabilityProxy')
  const liquidator = liquidatorImplementation.attach(liquidatorProxy.address)
  console.log('deployed liquidatorProxy at: ', liquidatorProxy.address)

  // setup uniswap
  // needs to compile using truffle compile
  /*
  this.uniswapFactory = await deploy('uniswap_factory')
  this.uniswapTemplate = await deploy('uniswap_exchange')
  await this.uniswapFactory.initializeFactory(this.uniswapTemplate.address)
  this.trueUSDUniswapExchange = await this.uniswapFactory.createExchange(this.trueUSD.address)

  console.log(this.trueUSDUniswapExchange)
  // this.trueUSDUniswapAddress = (await this.uniswapFactory.createExchange(
  //   this.trueUSDProxy.address))//.logs[0].args.exchange
  this.trueUSDUniswap = await contractAt('uniswap_exchange',
    this.trueUSDUniswap.address)

  this.trustUniswapAddress = (await this.uniswapFactory.createExchange(
    this.trusttoken.address)).logs[0].args.exchange

  this.trustUniswap = await UniswapExchange.at(this.trustUniswapAddress)
  // deploy liquidator
  this.liquidator = await deploy('Liquidator', this.registry.address,
    this.trueUSD.address, this.trusttoken.address, this.trueUSDUniswap.address,
    this.trustUniswap.address)

  // deploy assurance pool
  this.assurancePool = await deploy('StakedToken', this.trusttoken.address,
    this.trueUSD.address, this.registry.address,
    this.liquidator.address)
  */
  // deploy liquidator

  // deploy assurance pool
  const assurancePool = await deploy(
    'StakedToken',
    trustToken.address,
    trueUSD.address,
    registry.address,
    liquidator.address,
  )

  // Deploy UpgradeHelper
  const deployHelper = await deploy(
    'DeployHelper',
    trueUSDProxy.address,
    registryProxy.address,
    tokenControllerProxy.address,
    assuredFinancialOpportunityProxy.address,
    financialOpportunityProxy.address,
    liquidatorProxy.address,
    fractionalExponents.address,
    assurancePool.address,
  )

  let tx

  // transfer proxy ownership to deploy helper
  tx = await tokenControllerProxy.transferProxyOwnership(deployHelper.address)
  await tx.wait()
  console.log('controller proxy transfer ownership')

  tx = await trueUSDProxy.transferProxyOwnership(deployHelper.address)
  await tx.wait()
  console.log('trueUSDProxy proxy transfer ownership')

  // transfer proxy ownership to deploy helper
  tx = await registryProxy.transferProxyOwnership(deployHelper.address)
  await wallet.provider.waitForTransaction(tx.hash)
  console.log('registry proxy transfer ownership')

  tx = await assuredFinancialOpportunityProxy.transferProxyOwnership(deployHelper.address)
  await tx.wait()
  console.log('assuredFinancialOpportunityProxy proxy transfer ownership')

  tx = await financialOpportunityProxy.transferProxyOwnership(deployHelper.address)
  await tx.wait()
  console.log('financialOpportunityProxy proxy transfer ownership')

  tx = await registryProxy.transferProxyOwnership(deployHelper.address)
  await tx.wait()
  console.log('registryProxy proxy transfer ownership')

  tx = await liquidatorProxy.transferProxyOwnership(deployHelper.address)
  await tx.wait()
  console.log('liquidator proxy transfer ownership')

  tx = await deployHelper.setup(
    trueUSDImplementation.address,
    registryImplementation.address,
    tokenControllerImplementation.address,
    assuredFinancialOpportunityImplementation.address,
    financialOpportunityImplementation.address,
    liquidatorImplementation.address,
    aTokenMock.address,
    lendingPoolMock.address,
    trustToken.address,
    ZERO,
    ZERO,
    { gasLimit: 5000000 },
  )
  await tx.wait()
  console.log('deployHelper: setup')

  // reclaim ownership
  tx = await tokenControllerProxy.claimProxyOwnership({ gasLimit: 5000000 })
  await tx.wait()
  console.log('tokenControllerProxy claim ownership')

  tx = await trueUSDProxy.claimProxyOwnership({ gasLimit: 5000000 })
  await tx.wait()
  console.log('trueUSDProxy claim ownership')

  // reclaim ownership
  tx = await registryProxy.claimProxyOwnership({ gasLimit: 5000000 })
  await wallet.provider.waitForTransaction(tx.hash)
  console.log('registryProxy  claim ownership')

  tx = await assuredFinancialOpportunityProxy.claimProxyOwnership({ gasLimit: 5000000 })
  await tx.wait()
  console.log('assuredFinancialOpportunityProxy claim ownership')

  tx = await financialOpportunityProxy.claimProxyOwnership({ gasLimit: 5000000 })
  await tx.wait()
  console.log('financialOpportunityProxy claim ownership')

  tx = await assuredFinancialOpportunity.claimOwnership({ gasLimit: 5000000 })
  await tx.wait()
  console.log('assuredFinancialOpportunity claim ownership')

  tx = await tokenController.claimOwnership({ gasLimit: 5000000 })
  await tx.wait()
  console.log('tokenController claim ownership')

  tx = await registryProxy.claimProxyOwnership({ gasLimit: 5000000 })
  await tx.wait()
  console.log('registry proxy claim ownership')

  tx = await liquidatorProxy.claimProxyOwnership({ gasLimit: 5000000 })
  await tx.wait()
  console.log('liquidator proxy claim ownership')

  tx = await tokenController.setMintThresholds(
    ethers.utils.bigNumberify('1000000000000000000000'),
    ethers.utils.bigNumberify('10000000000000000000000'),
    ethers.utils.bigNumberify('100000000000000000000000'),
    { gasLimit: 5000000 },
  )
  await tx.wait()
  console.log('set mint thresholds')

  console.log('\n\nSUCCESSFULLY DEPLOYED TO NETWORK: ', provider.connection.url, '\n\n')
}

if (require.main === module) {
  const provider = new ethers.providers.JsonRpcProvider(process.argv[3] || rpcOptions.development)
  deploy(process.argv[2], provider).catch(console.error)
}
