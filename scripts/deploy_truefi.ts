/**
 * ts-node scripts/deploy_truefi.ts "{private_key}" "{network}" "{TRU address}"
 */
import { ethers, providers } from 'ethers'
import { ask } from './utils'
import { TrueFarmFactory } from '../build/types/TrueFarmFactory'
import { TrueDistributorFactory } from '../build/types/TrueDistributorFactory'

async function deployTrueFi (truAddress: string) {
  const txnArgs = { gasLimit: 2_500_000, gasPrice: 100_000_000_000 }
  const provider = new providers.InfuraProvider(process.argv[3], '81447a33c1cd4eb09efb1e8c388fb28e')
  const wallet = new ethers.Wallet(process.argv[2], provider)

  console.log('Current block ', await provider.getBlockNumber())
  const startingBlock = Number.parseInt(await ask('Starting block'))
  const distributor = await (await new TrueDistributorFactory(wallet).deploy(startingBlock, truAddress, txnArgs)).deployed()

  const blpAddress = await ask('Balancer BAL/TRU LP address')
  const balancerFarm = await (await new TrueFarmFactory(wallet).deploy(blpAddress, distributor.address, txnArgs)).deployed()
  console.log('Balancer TrueFarm ', balancerFarm.address)

  const ulpEthAddress = await ask('Uniswap ETH/TRU LP address')
  const uniswapEthFarm = await (await new TrueFarmFactory(wallet).deploy(ulpEthAddress, distributor.address, txnArgs)).deployed()
  console.log('Uniswap ETH/TRU TrueFarm ', uniswapEthFarm.address)

  const ulpTusdAddress2 = await ask('Uniswap TUSD/TrueFiLP address')
  const uniswapTusdFarm = await (await new TrueFarmFactory(wallet).deploy(ulpTusdAddress2, distributor.address, txnArgs)).deployed()
  console.log('Uniswap TUSD/TrueFiLP TrueFarm ', uniswapTusdFarm.address)

  await (await distributor.transfer(wallet.address, balancerFarm.address, 3333333, txnArgs)).wait()
  await (await distributor.transfer(wallet.address, uniswapEthFarm.address, 3333333, txnArgs)).wait()
  await (await distributor.transfer(wallet.address, uniswapTusdFarm.address, 3333334, txnArgs)).wait()
  console.log('TrueFi deployment completed')
}

deployTrueFi(process.argv[4]).catch(console.error)
