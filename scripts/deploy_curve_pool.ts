/**
 * ts-node scripts/deploy_curve_pool.ts "{private_key}" "{network}"
 */
import { ethers, providers } from 'ethers'
import { ask } from './utils/ask'
import { CurvePoolFactory } from '../build/types/CurvePoolFactory'

async function deployCurvePool () {
  const txnArgs = { gasLimit: 2_500_000, gasPrice: 100_000_000_000 }
  const provider = new providers.InfuraProvider(process.argv[3], '81447a33c1cd4eb09efb1e8c388fb28e')
  const wallet = new ethers.Wallet(process.argv[2], provider)

  const tusdAddress = await ask('TUSD token address: ')
  const curveAddress = await ask('Curve TUSD deposit address: ')

  const curvePool = await (await new CurvePoolFactory(wallet).deploy(curveAddress, tusdAddress, txnArgs)).deployed()
  console.log('Curve Pool address: ', curvePool.address)
  console.log('Curve Pool  deployment completed')
}

deployCurvePool().catch(console.error)
