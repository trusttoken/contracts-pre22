/* eslint-disable */ 
/**
 * PRIVATE_KEY={private_key} ts-node scripts/deploy_truefi.ts "{network}"
 */
import { ethers, providers } from 'ethers'

import {
  OwnedUpgradeabilityProxyFactory,
  RatingAgencyV2DistributorFactory,
  LinearTrueDistributorFactory,
  TrueRatingAgencyV2Factory,
  StkTruTokenFactory,
  GovernorAlphaFactory,
  TimelockFactory,
  LoanFactoryFactory,
  LiquidatorFactory,
  TruPriceChainLinkOracleFactory,
  TrueRatingAgencyFactory,
  TrueLenderFactory,
  TrueFiPoolFactory,
  TrustTokenFactory,
} from '../build'

const txnArgs = { gasLimit: 1_500_000, gasPrice: 160_000_000_000 }
const contractArgs = { gasLimit: 5_500_000, gasPrice: txnArgs.gasPrice }

async function deployTruefi () {
  const provider = new providers.InfuraProvider(process.argv[2], 'e33335b99d78415b82f8b9bc5fdc44c0')
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider)
  // await deployImplementations(wallet)
  // await deployProxies(wallet)
  // await deployProxiesWithImpl(wallet)
  // await deployLoanFactory(wallet)
  await deployDistributor(wallet)
  // await deployAddressBehindProxy(wallet, '', 'TruePriceOracle')
}

async function deployImplementations (wallet) {
  const trueRatingAgencyImpl = await (await new TrueRatingAgencyFactory(wallet).deploy(contractArgs)).deployed()
  console.log(`TrueRatingAgency: ${trueRatingAgencyImpl.address}`)

  const trueLenderImpl = await (await new TrueLenderFactory(wallet).deploy(contractArgs)).deployed()
  console.log(`TrueLender: ${trueLenderImpl.address}`)

  const trueFiPoolImpl = await (await new TrueFiPoolFactory(wallet).deploy(contractArgs)).deployed()
  console.log(`TrueFiPool: ${trueFiPoolImpl.address}`)

  const trustTokenImpl = await (await new TrustTokenFactory(wallet).deploy(contractArgs)).deployed()
  console.log(`TrustToken: ${trustTokenImpl.address}`)
}

async function deployProxies(wallet) {

  const ratingAgencyV2DistributorImpl = await (await new RatingAgencyV2DistributorFactory(wallet).deploy(contractArgs)).deployed()
  console.log(`RatingAgencyV2Distributor: ${ratingAgencyV2DistributorImpl.address}`)

  const linearTrueDistributorImpl = await (await new LinearTrueDistributorFactory(wallet).deploy(contractArgs)).deployed()
  console.log(`LinearTrueDistributor: ${linearTrueDistributorImpl.address}`)

  const trueRatingAgencyV2Impl = await (await new TrueRatingAgencyV2Factory(wallet).deploy(contractArgs)).deployed()
  console.log(`TrueRatingAgencyV2: ${trueRatingAgencyV2Impl.address}`)

  const stkTruTokenImpl = await (await new StkTruTokenFactory(wallet).deploy(contractArgs)).deployed()
  console.log(`StkTruToken: ${stkTruTokenImpl.address}`)

  const governorAlphaImpl = await (await new GovernorAlphaFactory(wallet).deploy(contractArgs)).deployed()
  console.log(`GovernorAlpha: ${governorAlphaImpl.address}`)

  const timelockImpl = await (await new TimelockFactory(wallet).deploy(contractArgs)).deployed()
  console.log(`Timelock: ${timelockImpl.address}`)

  const liquidatorImpl = await (await new LiquidatorFactory(wallet).deploy(contractArgs)).deployed()
  console.log(`Liquidator: ${liquidatorImpl.address}`)

  const truPriceChainLinkOracle = await (await new TruPriceChainLinkOracleFactory(wallet).deploy('0xa7becdd46648110112c85dd489a70f1119c81698', contractArgs)).deployed()
  console.log(`TruPriceChainLinkOracle: ${truPriceChainLinkOracle.address}`)

  await deployContractBehindProxy(wallet, ratingAgencyV2DistributorImpl, 'ratingAgencyV2Distributor')
  await deployContractBehindProxy(wallet, linearTrueDistributorImpl, 'linearTrueDistributor')
  await deployContractBehindProxy(wallet, trueRatingAgencyV2Impl, 'trueRatingAgencyV2')
  await deployContractBehindProxy(wallet, stkTruTokenImpl, 'stkTruToken')
  await deployContractBehindProxy(wallet, governorAlphaImpl, 'governorAlpha')
  await deployContractBehindProxy(wallet, timelockImpl, 'timelock')
  await deployContractBehindProxy(wallet, liquidatorImpl, 'liquidator')
}

async function deployContractBehindProxy(wallet, contract, name) {
  const proxy = await (await new OwnedUpgradeabilityProxyFactory(wallet).deploy(txnArgs)).deployed()
  await proxy.upgradeTo(contract.address, txnArgs)
  console.log(`${name} proxy at: ${proxy.address}`)
}


async function deployProxiesWithImpl(wallet) {
  const contracts = [
    { name: 'RatingAgencyV2Distributor', address: '0xF931f6c549F7FbBD41192eE13D6f2278493dD46b' },
    { name: 'LinearTrueDistributor', address: '0x1Bd6423320f8450A4bcD64E16F9cc228f589d1B9' },
    { name: 'TrueRatingAgencyV2', address: '0x353488058bA40b280B73C06FEAdA42CA4d61f7Fc' },
    { name: 'StkTruToken', address: '0xA367647cfc0525CBbdEe6EA036617E0884e3128b' },
    { name: 'GovernorAlpha', address: '0x8BEF17e7E0F339ddCE09842be757786e2Fe35D32' },
    { name: 'Timelock', address: '0x7762BC14f475fd8Ba8F994DD17bee91D2D280Db7' },
    { name: 'Liquidator', address: '0xA5C6B8930373972c5b67cd8bF4F3DaDBDA82F772' }
  ]
  for (let i = 0; i < contracts.length; i++) {
    await deployAddressBehindProxy(wallet, contracts[i].address, contracts[i].name)
  }
}

async function deployAddressBehindProxy(wallet, address, name) {
  const proxy = await (await new OwnedUpgradeabilityProxyFactory(wallet).deploy(txnArgs)).deployed()
  await proxy.upgradeTo(address, txnArgs)
  console.log(`${name} proxy at: ${proxy.address}`)
}

async function deployLoanFactory(wallet) {
  const loanFactoryImpl = await (await new LoanFactoryFactory(wallet).deploy(contractArgs)).deployed()
  console.log(`LoanFactory: ${loanFactoryImpl.address}`)
}

async function deployDistributor(wallet) {
  const ratingAgencyDistributorImpl = await (await new RatingAgencyV2DistributorFactory(wallet).deploy(contractArgs)).deployed()
  console.log(`RatingAgencyV2Distributor: ${ratingAgencyDistributorImpl.address}`)
}

deployTruefi().catch(console.error)
