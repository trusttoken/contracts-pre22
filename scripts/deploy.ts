/**
 * Ethers Deploy Script
 *
 * ts-node scripts/deploy.ts "{private_key}" "{network}"
 *
 * We use ethers to deploy our contracts from scratch.
 * For upgrades, use deploy/upgrade.ts
 * Use the config object to set parameters for deployment
 */

import { ethers, providers } from 'ethers'
import { getContract, setupDeployer, validatePrivateKey } from './utils'

interface DeployedAddresses {
  trueUsd: string,
  registry: string,
  aaveLendingPool: string,
  aaveLendingPoolCore: string,
  aTUSD: string,
  uniswapFactory: string,
}

export const deploy = async (accountPrivateKey: string, provider: providers.JsonRpcProvider, network: string) => {
  validatePrivateKey(accountPrivateKey)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const deployedAddresses: DeployedAddresses = require(`./deployedAddresses/${network}.json`)

  for (const [name, address] of Object.entries(deployedAddresses)) {
    const code = await provider.getCode(address)
    if (!code || code === '0x') {
      throw new Error(`Did not find contract ${name} under ${address} :(`)
    }
  }

  const wallet = new ethers.Wallet(accountPrivateKey, provider)

  const deploy = setupDeployer(wallet)
  const contractAt = getContract(wallet)

  const safeMath = await deploy('SafeMath')
  console.log('deployed SafeMath at: ', safeMath.address)

  const trueUSDImplementation = await deploy('TrueUSD')
  const trueUSDProxy = contractAt('TrueUSD', deployedAddresses.trueUsd)

  const tokenControllerImplementation = await deploy('TokenController')
  const tokenControllerProxy = await deploy('OwnedUpgradeabilityProxy')
  const tokenController = tokenControllerImplementation.attach(tokenControllerProxy.address)
  console.log('deployed tokenControllerProxy at: ', tokenControllerProxy.address)

  const assuredFinancialOpportunityImplementation = await deploy('AssuredFinancialOpportunity')
  const assuredFinancialOpportunityProxy = await deploy('OwnedUpgradeabilityProxy')
  const assuredFinancialOpportunity = assuredFinancialOpportunityImplementation.attach(assuredFinancialOpportunityProxy.address)
  console.log('deployed assuredFinancialOpportunityProxy at: ', assuredFinancialOpportunityProxy.address)

  // Deploy the rest of the contracts
  const registry = contractAt('Registry', deployedAddresses.registry)
  const lendingPool = contractAt('LendingPool', deployedAddresses.aaveLendingPool)
  const aTokenMock = await deploy('IAToken', deployedAddresses.aTUSD)
  const fractionalExponents = await deploy('FractionalExponents')
  const trustToken = await deploy('TrustToken', registry.address)

  const financialOpportunityImplementation = await deploy('AaveFinancialOpportunity')
  const financialOpportunityProxy = await deploy('OwnedUpgradeabilityProxy')
  console.log('deployed aaveFinancialOpportunityProxy at: ', financialOpportunityProxy.address)

  // setup uniswap
  const uniswapFactory = contractAt('uniswap_factory', deployedAddresses.uniswapFactory)
  const uniswapTemplate = await deploy('uniswap_exchange')
  await uniswapFactory.initializeFactory(uniswapTemplate.address)

  const trueUSDUniswapExchange = await uniswapFactory.createExchange(trueUSDProxy.address)
  console.log('created trueUSDUniswapExchange at: ', trueUSDUniswapExchange.address)

  const trustTokenUniswapExchange = await uniswapFactory.createExchange(trustToken.address)
  console.log('created trustTokenUniswapExchange at: ', trustTokenUniswapExchange.address)

  // deploy liquidator
  const liquidator = await deploy('Liquidator',
    registry.address, trueUSDProxy.address, trustToken.address,
    trueUSDUniswapExchange.address, trueUSDUniswapExchange.address)

  // deploy assurance pool
  const assurancePool = await deploy(
    'StakedToken',
    trustToken.address,
    trueUSDProxy.address,
    registry.address,
    liquidator.address,
  )

  // Deploy UpgradeHelper
  const deployHelper = await deploy('DeployHelper')

  let tx

  // transfer proxy ownership to deploy helper
  tx = await tokenControllerProxy.transferProxyOwnership(deployHelper.address)
  await wallet.provider.waitForTransaction(tx.hash)
  console.log('controller proxy transfer ownership')

  tx = await trueUSDProxy.transferProxyOwnership(deployHelper.address)
  await wallet.provider.waitForTransaction(tx.hash)
  console.log('trueUSDProxy proxy transfer ownership')

  tx = await assuredFinancialOpportunityProxy.transferProxyOwnership(deployHelper.address)
  await wallet.provider.waitForTransaction(tx.hash)
  console.log('assuredFinancialOpportunityProxy proxy transfer ownership')

  tx = await financialOpportunityProxy.transferProxyOwnership(deployHelper.address)
  await wallet.provider.waitForTransaction(tx.hash)
  console.log('financialOpportunityProxy proxy transfer ownership')

  tx = await liquidator.transferOwnership(deployHelper.address)
  await wallet.provider.waitForTransaction(tx.hash)
  console.log('liquidator transfer ownership')

  tx = await registry.transferOwnership(deployHelper.address)
  await wallet.provider.waitForTransaction(tx.hash)
  console.log('registry transfer ownership')

  // call deployHelper
  tx = await deployHelper.setup(
    registry.address,
    trueUSDImplementation.address,
    trueUSDProxy.address,
    tokenControllerImplementation.address,
    tokenControllerProxy.address,
    assuredFinancialOpportunityImplementation.address,
    assuredFinancialOpportunityProxy.address,
    financialOpportunityImplementation.address,
    financialOpportunityProxy.address,
    fractionalExponents.address,
    assurancePool.address,
    liquidator.address,
    aTokenMock.address,
    lendingPool.address,
    { gasLimit: 5000000 },
  )
  await wallet.provider.waitForTransaction(tx.hash)
  console.log('deployHelper: setup')

  // reclaim ownership
  tx = await tokenControllerProxy.claimProxyOwnership({ gasLimit: 5000000 })
  await wallet.provider.waitForTransaction(tx.hash)
  console.log('tokenControllerProxy claim ownership')

  tx = await trueUSDProxy.claimProxyOwnership({ gasLimit: 5000000 })
  await wallet.provider.waitForTransaction(tx.hash)
  console.log('trueUSDProxy claim ownership')

  tx = await assuredFinancialOpportunityProxy.claimProxyOwnership({ gasLimit: 5000000 })
  await wallet.provider.waitForTransaction(tx.hash)
  console.log('assuredFinancialOpportunityProxy claim ownership')

  tx = await financialOpportunityProxy.claimProxyOwnership({ gasLimit: 5000000 })
  await wallet.provider.waitForTransaction(tx.hash)
  console.log('financialOpportunityProxy claim ownership')

  tx = await assuredFinancialOpportunity.claimOwnership({ gasLimit: 5000000 })
  await wallet.provider.waitForTransaction(tx.hash)
  console.log('assuredFinancialOpportunity claim ownership')

  tx = await tokenController.claimOwnership({ gasLimit: 5000000 })
  await wallet.provider.waitForTransaction(tx.hash)
  console.log('tokenController claim ownership')

  tx = await registry.claimOwnership({ gasLimit: 5000000 })
  await wallet.provider.waitForTransaction(tx.hash)
  console.log('registry claim ownership')

  tx = await liquidator.claimOwnership({ gasLimit: 5000000 })
  await wallet.provider.waitForTransaction(tx.hash)
  console.log('liquidator claim ownership')

  tx = await tokenController.setMintThresholds(
    ethers.utils.bigNumberify('1000000000000000000000'),
    ethers.utils.bigNumberify('10000000000000000000000'),
    ethers.utils.bigNumberify('100000000000000000000000'),
    { gasLimit: 5000000 },
  )
  await wallet.provider.waitForTransaction(tx.hash)
  console.log('set mint thresholds')

  console.log('\n\nSUCCESSFULLY DEPLOYED TO NETWORK: ', provider.connection.url, '\n\n')
}

if (require.main === module) {
  if (!['mainnet', 'kovan', 'ropsten', 'rinkeby'].includes(process.argv[3])) {
    throw new Error(`Unknown network: ${process.argv[3]}`)
  }
  const provider = new ethers.providers.InfuraProvider(process.argv[3], '81447a33c1cd4eb09efb1e8c388fb28e')
  deploy(process.argv[2], provider, process.argv[3]).catch(console.error)
}
