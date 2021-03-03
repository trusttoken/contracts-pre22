import { providers } from 'ethers'
import { solidity } from 'ethereum-waffle'
import { use, expect } from 'chai'
import { forkChain, CONTRACTS_OWNER } from './suite'
import {
  TrueSushiFarm,
  TrueSushiFarmFactory,
  LinearTrueDistributor,
  LinearTrueDistributorFactory,
  Erc20Mock,
  Erc20MockFactory,
} from 'contracts'
import { timeTravel } from 'utils'

use(solidity)

describe.only('Integration: TrueSushiFarm', () => {
  const STARTING_BLOCK_NUMBER = '11959269'
  const SUSHI_WHALE = '0x62cB1071882E70AE9C608053C1b69469302A1890'
  const SUSHI_LP_TOKEN = '0xfceaaf9792139bf714a694f868a215493461446d'
  const SUSHI_TOKEN = '0x6B3595068778DD592e39A122f4f5a5cF09C90fE2'
  const TRU = '0x4C19596f5aAfF459fA38B0f7eD92F11AE6543784'
  const MASTER_CHEF = '0xc2EdaD668740f1aA35E4D8f227fB8E17dcA888Cd'
  const SUSHI_POOL_ID = '95'

  const stakedAmount = 100000000

  let provider: providers.Web3Provider
  let owner: providers.JsonRpcSigner
  let sushiWhale: providers.JsonRpcSigner
  let farm: TrueSushiFarm
  let distributor: LinearTrueDistributor
  let sushiLP: Erc20Mock
  let sushi: Erc20Mock

  before(async () => {
    provider = forkChain('https://eth-mainnet.alchemyapi.io/v2/Vb1r7d3YzPiMTh_plUBI8bzwldnIb2y4', [CONTRACTS_OWNER, SUSHI_WHALE], STARTING_BLOCK_NUMBER)
    owner = provider.getSigner(CONTRACTS_OWNER)
    sushiWhale = provider.getSigner(SUSHI_WHALE)

    distributor = await new LinearTrueDistributorFactory(owner).deploy()
    await distributor.deployed()
    await distributor.initialize(STARTING_BLOCK_NUMBER, 1_000_000, 0, TRU)

    farm = await new TrueSushiFarmFactory(owner).deploy()
    await farm.deployed()
    await distributor.setFarm(farm.address)
    await farm.initialize(SUSHI_LP_TOKEN, distributor.address, MASTER_CHEF, SUSHI_POOL_ID, 'Sushi Farm')

    sushiLP = new Erc20MockFactory(owner).attach(SUSHI_LP_TOKEN)
    sushi = new Erc20MockFactory(owner).attach(SUSHI_TOKEN)
  })

  it('when staking funds are moved to master chef', async () => {
    await sushiLP.connect(sushiWhale).approve(farm.address, stakedAmount)
    await expect(() => farm.connect(sushiWhale).stake(stakedAmount))
      .to.changeTokenBalance(sushiLP, provider.getSigner(MASTER_CHEF), stakedAmount)
  })

  it('when staking additional funds, rewards are collected', async () => {
    await timeTravel(provider, 60 * 60 * 24)
    const sushiBalanceBefore = await sushi.balanceOf(await farm.address)
    await sushiLP.connect(sushiWhale).approve(farm.address, stakedAmount)
    await farm.connect(sushiWhale).stake(stakedAmount)
    const sushiBalanceAfter = await sushi.balanceOf(await farm.address)
    expect(sushiBalanceAfter.gt(sushiBalanceBefore)).to.be.true
  })

  it('when unstaking funds are moved from master chef', async () => {
    await timeTravel(provider, 60 * 60 * 24)
    const sushiBalanceBefore = await sushi.balanceOf(await farm.address)
    await farm.connect(sushiWhale).unstake(stakedAmount)
    const sushiBalanceAfter = await sushi.balanceOf(await farm.address)
    expect(sushiBalanceAfter.gt(sushiBalanceBefore)).to.be.true
  })

  it('when unstaking portion of funds, rewards are collected', async () => {
    await expect(() => farm.connect(sushiWhale).unstake(stakedAmount))
      .to.changeTokenBalance(sushiLP, provider.getSigner(MASTER_CHEF), -stakedAmount)
  })

  it('sushi address is properly saved', async () => {
    expect(await farm.sushi()).to.equal(SUSHI_TOKEN)
  })
})
