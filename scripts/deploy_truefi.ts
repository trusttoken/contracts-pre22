/**
 * ts-node scripts/deploy_truefi.ts "{private_key}" "{network}"
 */
import { ethers, providers } from 'ethers'
import { ask } from './utils'
import { TrueFarmFactory } from '../build/types/TrueFarmFactory'
import { SlowTrueDistributorFactory } from '../build/types/SlowTrueDistributorFactory'
import { FastTrueDistributorFactory } from '../build/types/FastTrueDistributorFactory'

async function deployTrueFi () {
  const txnArgs = { gasLimit: 2_500_000, gasPrice: 100_000_000_000 }
  const provider = new providers.InfuraProvider(process.argv[3], '81447a33c1cd4eb09efb1e8c388fb28e')
  const wallet = new ethers.Wallet(process.argv[2], provider)

  const truAddress = await ask('TrustToken address: ')
  console.log('Current block ', await provider.getBlockNumber())
  const startingBlock = Number.parseInt(await ask('Starting block: '))
  const slowDistributor = await (await new SlowTrueDistributorFactory(wallet).deploy(startingBlock, truAddress, txnArgs)).deployed()
  const fastDistributor = await (await new FastTrueDistributorFactory(wallet).deploy(startingBlock, truAddress, txnArgs)).deployed()

  const blpAddress = await ask('Balancer BAL/TRU LP address: ')
  const balancerFarm = await (await new TrueFarmFactory(wallet).deploy(blpAddress, fastDistributor.address, txnArgs)).deployed()
  console.log('Balancer TrueFarm address: ', balancerFarm.address)

  const ulpEthAddress = await ask('Uniswap ETH/TRU LP address: ')
  const uniswapEthFarm = await (await new TrueFarmFactory(wallet).deploy(ulpEthAddress, fastDistributor.address, txnArgs)).deployed()
  console.log('Uniswap ETH/TRU TrueFarm address: ', uniswapEthFarm.address)

  const ulpTusdAddress2 = await ask('Uniswap TUSD/TrueFiLP address: ')
  const uniswapTusdFarm = await (await new TrueFarmFactory(wallet).deploy(ulpTusdAddress2, slowDistributor.address, txnArgs)).deployed()
  console.log('Uniswap TUSD/TrueFiLP TrueFarm address: ', uniswapTusdFarm.address)

  await (await fastDistributor.transfer(wallet.address, balancerFarm.address, 5000000, txnArgs)).wait()
  await (await fastDistributor.transfer(wallet.address, uniswapEthFarm.address, 5000000, txnArgs)).wait()
  await (await slowDistributor.transfer(wallet.address, uniswapTusdFarm.address, 10000000, txnArgs)).wait()
  console.log('TrueFi deployment completed')
}

deployTrueFi().catch(console.error)
