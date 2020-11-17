import { expect, use } from 'chai'
import { parseEther } from '@ethersproject/units'
import { MaxUint256 } from '@ethersproject/constants'
import { ContractTransaction, Wallet } from 'ethers'
import { MockProvider, solidity } from 'ethereum-waffle'

import {
  beforeEachWithFixture,
  skipBlocksWithProvider,
  skipToBlockWithProvider,
} from 'utils'

import {
  MockErc20Token,
  MockErc20TokenFactory,
  QuadraticTrueDistributor,
  TrueFarmFactory,
  TrueFarm,
  MockDistributorFactory,
} from 'contracts'

use(solidity)

describe('TrueFarm', () => {
  let owner: Wallet
  let staker1: Wallet
  let staker2: Wallet
  let distributor: QuadraticTrueDistributor
  let trustToken: MockErc20Token
  let stakingToken: MockErc20Token
  let provider: MockProvider
  let farm: TrueFarm
  const START_BLOCK = 15

  async function getBlock (tx: Promise<ContractTransaction>) {
    const receipt = await (await tx).wait()
    return receipt.blockNumber
  }

  const skipToBlock = async (targetBlock: number) => skipToBlockWithProvider(provider, targetBlock)

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner, staker1, staker2] = wallets
    provider = _provider
    trustToken = await new MockErc20TokenFactory(owner).deploy()
    stakingToken = await new MockErc20TokenFactory(owner).deploy()
    distributor = await new MockDistributorFactory(owner).deploy()
    await distributor.initialize(START_BLOCK, trustToken.address)
    farm = await new TrueFarmFactory(owner).deploy()
    await farm.initialize(stakingToken.address, distributor.address, 'Test farm')

    await trustToken.mint(distributor.address, '5365000000000000000')
    await distributor.transfer(owner.address, farm.address, await distributor.TOTAL_SHARES())
    await stakingToken.mint(staker1.address, parseEther('1000'))
    await stakingToken.mint(staker2.address, parseEther('1000'))
    await stakingToken.connect(staker1).approve(farm.address, MaxUint256)
    await stakingToken.connect(staker2).approve(farm.address, MaxUint256)
  })

  describe('initializer', () => {
    it('name is correct', async () => {
      expect(await farm.name()).to.equal('Test farm')
    })
  })

  describe('one staker', () => {
    beforeEach(async () => {
      await skipToBlock(START_BLOCK)
    })

    it('correct events emitted', async () => {
      const asStaker = await farm.connect(staker1)
      await expect(asStaker.stake(parseEther('500'))).to.emit(farm, 'Stake')
        .withArgs(staker1.address, parseEther('500'))
      await skipBlocksWithProvider(provider, 5)
      await expect(asStaker.claim()).to.emit(farm, 'Claim')
        .withArgs(staker1.address, 600)
      await expect(asStaker.unstake(parseEther('500'))).to.emit(farm, 'Unstake')
        .withArgs(staker1.address, parseEther('500'))
    })

    it('staking changes stake balance', async () => {
      await farm.connect(staker1).stake(parseEther('500'))
      expect(await farm.staked(staker1.address)).to.equal(parseEther('500'))
      expect(await farm.totalStaked()).to.equal(parseEther('500'))

      await farm.connect(staker1).stake(parseEther('500'))
      expect(await farm.staked(staker1.address)).to.equal(parseEther('1000'))
      expect(await farm.totalStaked()).to.equal(parseEther('1000'))
    })

    it('unstaking changes stake balance', async () => {
      await farm.connect(staker1).stake(parseEther('1000'))
      await farm.connect(staker1).unstake(parseEther('500'))
      expect(await farm.staked(staker1.address)).to.equal(parseEther('500'))
      expect(await farm.totalStaked()).to.equal(parseEther('500'))
    })

    it('exiting changes stake balance', async () => {
      await farm.connect(staker1).stake(parseEther('1000'))
      await farm.connect(staker1).exit(parseEther('500'))
      expect(await farm.staked(staker1.address)).to.equal(parseEther('500'))
      expect(await farm.totalStaked()).to.equal(parseEther('500'))
    })

    it('cannot unstake more than is staked', async () => {
      await farm.connect(staker1).stake(parseEther('1000'))
      await expect(farm.connect(staker1).unstake(parseEther('1001'))).to.be.revertedWith('TrueFarm: Cannot withdraw amount bigger than available balance')
    })

    it('cannot exit more than is staked', async () => {
      await farm.connect(staker1).stake(parseEther('1000'))
      await expect(farm.connect(staker1).exit(parseEther('1001'))).to.be.revertedWith('TrueFarm: Cannot withdraw amount bigger than available balance')
    })

    it('yields rewards per staked tokens (using claim)', async () => {
      const stakeBlock = await getBlock(farm.connect(staker1).stake(parseEther('1000')))
      await skipBlocksWithProvider(provider, 5)
      const claimBlock = await getBlock(farm.connect(staker1).claim())
      expect(await trustToken.balanceOf(staker1.address)).to.equal((claimBlock - stakeBlock) * 100)
    })

    it('yields rewards per staked tokens (using exit)', async () => {
      const stakeBlock = await getBlock(farm.connect(staker1).stake(parseEther('1000')))
      await skipBlocksWithProvider(provider, 5)
      const claimBlock = await getBlock(farm.connect(staker1).exit(parseEther('1000')))
      expect(await trustToken.balanceOf(staker1.address)).to.equal((claimBlock - stakeBlock) * 100)
    })

    it('rewards when stake increases', async () => {
      const stakeBlock = await getBlock(farm.connect(staker1).stake(parseEther('500')))
      await skipBlocksWithProvider(provider, 5)
      await farm.connect(staker1).stake(parseEther('500'))
      await skipBlocksWithProvider(provider, 5)
      const claimBlock = await getBlock(farm.connect(staker1).claim())

      expect(await trustToken.balanceOf(staker1.address)).to.equal((claimBlock - stakeBlock) * 100)
    })

    it('sending stake tokens to TrueFarm does not affect calculations', async () => {
      const stakeBlock = await getBlock(farm.connect(staker1).stake(parseEther('500')))
      await stakingToken.connect(staker1).transfer(farm.address, parseEther('500'))
      await skipBlocksWithProvider(provider, 5)
      const claimBlock = await getBlock(farm.connect(staker1).claim())

      expect(await trustToken.balanceOf(staker1.address)).to.equal((claimBlock - stakeBlock) * 100)
    })

    it('claiming clears claimableRewards', async () => {
      await farm.connect(staker1).stake(parseEther('500'))
      await skipBlocksWithProvider(provider, 5)
      await farm.connect(staker1).stake(parseEther('500'))
      expect(await farm.claimableReward(staker1.address)).to.be.gt(0)

      await farm.connect(staker1).claim()
      expect(await farm.claimableReward(staker1.address)).to.equal(0)
    })

    it('calling distribute does not break reward calculations', async () => {
      const stakeBlock = await getBlock(farm.connect(staker1).stake(parseEther('500')))
      await skipBlocksWithProvider(provider, 5)
      await distributor.distribute(farm.address)
      await skipBlocksWithProvider(provider, 5)
      const claimBlock = await getBlock(farm.connect(staker1).claim())
      expect(await trustToken.balanceOf(staker1.address)).to.equal((claimBlock - stakeBlock) * 100)
    })

    it('splitting distributor shares does not break reward calculations', async () => {
      const stakeBlock = await getBlock(farm.connect(staker1).stake(parseEther('500')))
      await skipBlocksWithProvider(provider, 5)
      const transferBlock = await getBlock(distributor.transfer(farm.address, owner.address, (await distributor.TOTAL_SHARES()).div(2)))
      await skipBlocksWithProvider(provider, 5)
      const claimBlock = await getBlock(farm.connect(staker1).claim())
      expect(await trustToken.balanceOf(staker1.address)).to.equal((transferBlock - stakeBlock + (claimBlock - transferBlock) / 2) * 100)
    })
  })

  describe('with two stakers', function () {
    beforeEach(async () => {
      await farm.connect(staker1).stake(parseEther('400'))
      await farm.connect(staker2).stake(parseEther('100'))
      await skipToBlock(START_BLOCK)
    })

    it('earn rewards in proportion to stake share', async () => {
      await skipBlocksWithProvider(provider, 5)
      const claimBlock1 = await getBlock(farm.connect(staker1).claim())
      const claimBlock2 = await getBlock(farm.connect(staker2).claim())

      expect(await trustToken.balanceOf(staker1.address), '1').to.equal(Math.floor(100 * ((claimBlock1 - START_BLOCK) * 4 / 5)))
      expect(await trustToken.balanceOf(staker2.address), '2').to.equal(Math.floor(100 * ((claimBlock2 - START_BLOCK) / 5)))
    })

    it('if additional funds are transferred to farm, they are also distributed accordingly to shares', async () => {
      await skipBlocksWithProvider(provider, 5)
      trustToken.mint(farm.address, 100)
      const claimBlock1 = await getBlock(farm.connect(staker1).claim())
      const claimBlock2 = await getBlock(farm.connect(staker2).claim())

      expect(await trustToken.balanceOf(staker1.address), '1').to.equal(Math.floor((100 * (claimBlock1 - START_BLOCK) + 100) * 4 / 5))
      expect(await trustToken.balanceOf(staker2.address), '2').to.equal(Math.floor((100 * (claimBlock2 - START_BLOCK) + 100) / 5))
    })

    it('handles reward calculation after unstaking', async () => {
      await skipBlocksWithProvider(provider, 5)
      const unstakeBlock = await getBlock(farm.connect(staker1).unstake(parseEther('300')))
      await skipBlocksWithProvider(provider, 5)
      const claimBlock1 = await getBlock(farm.connect(staker1).claim())
      const claimBlock2 = await getBlock(farm.connect(staker2).claim())

      expect(await trustToken.balanceOf(staker1.address), '1').to.equal(Math.floor(100 * ((unstakeBlock - START_BLOCK) * 4 / 5 + (claimBlock1 - unstakeBlock) / 2)))
      expect(await trustToken.balanceOf(staker2.address), '2').to.equal(Math.floor(100 * ((unstakeBlock - START_BLOCK) / 5 + (claimBlock2 - unstakeBlock) / 2)))
    })
  })
})
