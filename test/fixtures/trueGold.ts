import { utils, Wallet } from 'ethers'

import { MAX_BURN_BOUND } from 'utils'

import { TrueGoldFactory } from 'contracts/types/TrueGoldFactory'

export const initialSupply = utils.parseUnits('12000', 6)

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function setupTrueGold ([deployer, initialHolder, secondAccount, thirdAccount]: Wallet[]) {
  const trueGoldFactory = new TrueGoldFactory(deployer)
  const token = await trueGoldFactory.deploy()
  await token.initialize(0, MAX_BURN_BOUND)
  await token.mint(initialHolder.address, initialSupply)

  return { deployer, initialHolder, secondAccount, thirdAccount, token }
}
