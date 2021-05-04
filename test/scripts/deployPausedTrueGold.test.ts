import { solidity } from 'ethereum-waffle'
import { expect, use } from 'chai'
import { waffle } from 'hardhat'

import { deployPausedTrueGold } from 'scripts/deploy_paused_true_gold'

import { PausedTrueGold } from 'contracts'
import { PausedTrueGoldJson } from 'build'

use(solidity)

describe('deployPausedTrueGold', () => {
  const pausedTokenBytecode = PausedTrueGoldJson.deployedBytecode

  const provider = waffle.provider
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
