import { MockProvider } from 'ethereum-waffle'
import { expect } from 'chai'

import { deployPausedTrueGold } from 'scripts/deploy_paused_true_gold'

import { toHex } from 'utils'

import {
  PausedTrueGold,
  PausedTrueGoldJson,
} from 'contracts'

describe('deployPausedTrueGold', () => {
  const pausedTokenBytecode = toHex(PausedTrueGoldJson.evm.deployedBytecode.object)

  const provider = new MockProvider()
  const [deployer] = provider.getWallets()

  let pausedToken: PausedTrueGold

  before(async () => {
    pausedToken = await deployPausedTrueGold(deployer)
  })

  it('deploys the contract', async () => {
    expect(await provider.getCode(pausedToken.address)).to.eq(pausedTokenBytecode)
  })

  it('initializes the contract', async () => {
    await expect(pausedToken.initialize(0, 10)).to.be.revertedWith('Contract instance has already been initialized')
    expect(await pausedToken.owner()).to.eq(deployer.address)
  })
})
