import { Wallet } from 'ethers'

import { deployContract } from './utils/deployContract'
import { waitForTx } from './utils/waitForTx'

import { PausedTrueGoldFactory } from '../build/types/PausedTrueGoldFactory'
import { PausedTrueGold } from '../build/types/PausedTrueGold'

export async function deployPausedTrueGold (deployer: Wallet): Promise<PausedTrueGold> {
  const pausedToken = await deployContract(deployer, PausedTrueGoldFactory)
  await waitForTx(pausedToken.initialize(0, 0))
  return pausedToken
}
