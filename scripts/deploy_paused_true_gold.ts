import { Wallet } from 'ethers'

import { deployContract } from 'scripts/utils/deployContract'
import { waitForTx } from 'scripts/utils/waitForTx'

import { PausedTrueGoldFactory } from 'contracts/types/PausedTrueGoldFactory'
import { PausedTrueGold } from 'contracts/types/PausedTrueGold'

export async function deployPausedTrueGold (deployer: Wallet): Promise<PausedTrueGold> {
  const pausedToken = await deployContract(deployer, PausedTrueGoldFactory)
  await waitForTx(pausedToken.initialize(0, 0))
  return pausedToken
}
