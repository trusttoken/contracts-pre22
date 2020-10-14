import { expect } from 'chai'
import { MockProvider } from 'ethereum-waffle'
import { Wallet } from 'ethers'
import { utils, BigNumber } from 'ethers'
import { Zero, MaxUint256 } from '@ethersproject/constants'
import { beforeEachWithFixture } from '../utils/beforeEachWithFixture'
import { toTrustToken } from '../../scripts/utils'
import { TrueDistributor } from '../../build/types/TrueDistributor'
import { TrueDistributorFactory } from '../../build/types/TrueDistributorFactory'
import { MockErc20TokenFactory } from '../../build/types/MockErc20TokenFactory'
import { MockErc20Token } from '../../build/types/MockErc20Token'
import { skipBlocksWithProvider } from '../utils/timeTravel'

describe('TrueDistributor', () => {
  let owner: Wallet
  let farm: Wallet
  let fakeToken: Wallet
  let distributor: TrueDistributor
  let trustToken: MockErc20Token
  let provider: MockProvider

  const skipBlocks = async (numberOfBlocks: number) => skipBlocksWithProvider(provider, numberOfBlocks)

  const normaliseRewardToTrustTokens = (amount: BigNumber) => amount.div(BigNumber.from(10).pow(33))

  const expectBlock = async (expectedBlockNumber: number) => {
    expect(await provider.getBlockNumber()).to.equal(expectedBlockNumber)
  }

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner, farm, fakeToken] = wallets
    provider = _provider
    trustToken = await new MockErc20TokenFactory(owner).deploy()
    distributor = await new TrueDistributorFactory(owner).deploy(0, trustToken.address)
    await trustToken.mint(distributor.address, utils.parseEther('5365000000000000000'))
  })

  describe('constructor', () => {
    it('startingBlock is properly set', async () => {
      const arbitraryBlockNumber = 1234567890
      const freshDistributorWithCustomStartingBlock = await new TrueDistributorFactory(owner).deploy(arbitraryBlockNumber, fakeToken.address)
      expect(await freshDistributorWithCustomStartingBlock.startingBlock()).to.equal(arbitraryBlockNumber)
    })

    it('all shares belong to deployer', async () => {
      expect(await distributor.getShares(owner.address))
        .to.equal(await distributor.TOTAL_SHARES())
    })

    it('deployer becomes owner', async () => {
      expect(await distributor.owner())
        .to.equal(owner.address)
    })
  })

  describe('normalise', () => {
    it('removes precision', async () => {
      const normalisedValue = (await distributor.PRECISION()).mul(123)
      const normalisationResult = await distributor.normalise(normalisedValue)
      expect(normalisationResult).to.equal(123)
    })
  })

  describe('distribute', () => {
    it('should properly save distribution block', async () => {
      await expectBlock(3)
      await skipBlocks(4)
      await expectBlock(7)
      await distributor.distribute(owner.address)
      await expectBlock(8)

      expect(await distributor.getLastDistributionBlock(owner.address)).to.equal(8)
    })

    it('should transfer tokens to share holder', async () => {
      const expectedReward = await distributor.reward(0, 7)
      await skipBlocks(3)
      await distributor.distribute(owner.address)
      await expectBlock(8)

      expect(await trustToken.balanceOf(owner.address))
        .to.equal(normaliseRewardToTrustTokens(expectedReward))
    })

    it('should properly split tokens between multiple share holders', async () => {
      const halfOfShares = (await distributor.TOTAL_SHARES()).div(2)

      await distributor.transfer(owner.address, farm.address, halfOfShares)
      const block1 = await provider.getBlockNumber()

      await skipBlocks(10)
      await distributor.distribute(owner.address)
      const block2 = await provider.getBlockNumber()

      const expectedOwnersReward = (await distributor.reward(0, block1))
        .add((await distributor.reward(block1, block2)).div(2))

      expect(await trustToken.balanceOf(owner.address))
        .to.equal(normaliseRewardToTrustTokens(expectedOwnersReward))

      await skipBlocks(3)
      await distributor.distribute(farm.address)
      const block3 = await provider.getBlockNumber()
      const expectedFarmsReward = (await distributor.reward(block1, block3)).div(2)

      expect(await trustToken.balanceOf(farm.address))
        .to.equal(normaliseRewardToTrustTokens(expectedFarmsReward))
    })

    it('should distribute tokens for correct interval', async () => {
      const expectedReward = await distributor.reward(8, 11)

      await skipBlocks(4)
      await distributor.distribute(owner.address)
      await expectBlock(8)

      const balanceBeforeSecondDistribution = await trustToken.balanceOf(owner.address)

      await skipBlocks(2)
      await distributor.distribute(owner.address)
      await expectBlock(11)

      const balanceAfterSecondDistribution = await trustToken.balanceOf(owner.address)

      expect(balanceAfterSecondDistribution.sub(balanceBeforeSecondDistribution))
        .to.equal(normaliseRewardToTrustTokens(expectedReward))
    })
  })

  describe('transfer', () => {
    it('properly transfers', async () => {
      const totalShares = await distributor.TOTAL_SHARES()
      const someAmountOfShares = 2500000
      await distributor.transfer(owner.address, farm.address, someAmountOfShares)

      expect(await distributor.getShares(farm.address)).to.equal(someAmountOfShares)
      expect(await distributor.getShares(owner.address)).to.equal(totalShares.sub(someAmountOfShares))
    })

    it('reverts if total shares exceed donors balance', async () => {
      const someSuperBigAmountOfShares = (await distributor.TOTAL_SHARES()).mul(10)

      await expect(
        distributor.transfer(owner.address, farm.address, someSuperBigAmountOfShares),
      ).to.be.reverted
    })

    it('reverts if not owner tries to transfer', async () => {
      const someAmountOfShares = 2500000
      await expect(
        distributor.connect(farm).transfer(owner.address, farm.address, someAmountOfShares),
      ).to.be.reverted
    })

    it('should distribute tokens to both transfer participants and then transfer', async () => {
      const someAmountOfShares = 2500000
      await distributor.transfer(owner.address, farm.address, someAmountOfShares)
      await skipBlocks(5)

      const ownerBalanceBeforeTransfer = await trustToken.balanceOf(owner.address)
      const farmBalanceBeforeTransfer = await trustToken.balanceOf(farm.address)

      await distributor.transfer(farm.address, owner.address, someAmountOfShares)

      const ownerBalanceAfterTransfer = await trustToken.balanceOf(owner.address)
      const farmBalanceAfterTransfer = await trustToken.balanceOf(farm.address)

      expect(ownerBalanceAfterTransfer.gt(ownerBalanceBeforeTransfer)).to.be.true
      expect(farmBalanceAfterTransfer.gt(farmBalanceBeforeTransfer)).to.be.true
    })
  })

  describe('reward', () => {
    it('returns 0 for 0 blocks interval', async () => {
      expect(await distributor.reward(0, 0)).to.equal(0)
      expect(await distributor.reward(10, 10)).to.equal(0)
      expect(await distributor.reward(1000, 1000)).to.equal(0)
    })

    it('returns 0 for interval starting after last block', async () => {
      const lastBlock = await distributor.lastBlock()
      expect(await distributor.reward(lastBlock, lastBlock.add(100))).to.equal(0)
    })

    it('returns 0 for interval ending before first block', async () => {
      const delayedDistributor = await new TrueDistributorFactory(owner).deploy(100, trustToken.address)
      expect(await delayedDistributor.reward(0, 99)).to.equal(0)
    })

    it('has correct precision', async () => {
      expect((await distributor.reward(0, await distributor.getTotalBlocks())).div(await distributor.PRECISION())).to.equal(toTrustToken(536500000).sub(1))
    })

    it('from block 0 to last', async () => {
      expect(await distributor.reward(0, await distributor.getTotalBlocks())).to.equal('53649999999999999999999999971605309297031160000000')
    })

    it('sums to total TRU distributor (with step 1000000)', async () => {
      let sum = Zero
      const totalBlocks = (await distributor.getTotalBlocks()).toNumber()

      for (let i = 0; i < totalBlocks; i += 1000000) {
        const newReward = await distributor.reward(i, Math.min(i + 1000000, totalBlocks))
        sum = sum.add(newReward)
      }
      expect(sum).to.equal('53649999999999999999999999971605309297031160000000')
    })

    it('in every following interval reward is smaller (with step 100000)', async () => {
      let lastReward = MaxUint256
      const totalBlocks = (await distributor.getTotalBlocks()).toNumber()

      for (let i = 0; i < totalBlocks; i += 100000) {
        const newReward = await distributor.reward(i, Math.min(i + 100000, totalBlocks))
        expect(newReward).to.be.lt(lastReward)
        lastReward = newReward
      }
    })

    it('reverts on invalid interval', async () => {
      await expect(distributor.reward(10, 1)).to.be.revertedWith('invalid interval')
    })

    it('no reward can be claimed before starting block', async () => {
      const distributorWithPostponedRewards = await new TrueDistributorFactory(owner).deploy(100, fakeToken.address)
      expect(await distributorWithPostponedRewards.reward(0, 1)).to.equal('0')
    })

    it('returns proper value (starting block is > 0)', async () => {
      const distributorWithPostponedRewards = await new TrueDistributorFactory(owner).deploy(2000, fakeToken.address)
      const rewardFromPostponedDistributor = await distributorWithPostponedRewards.reward(2000, 2004)
      const rewardFromDefaultDistributor = await distributor.reward(0, 4)

      expect(rewardFromPostponedDistributor).to.equal(rewardFromDefaultDistributor)
    })

    it('returns proper value if interval starts before starting block, but ends after', async () => {
      const distributorWithPostponedRewards = await new TrueDistributorFactory(owner).deploy(2, fakeToken.address)
      const rewardFromPostponedDistributor = await distributorWithPostponedRewards.reward(0, 4)
      const rewardFromDefaultDistributor = await distributor.reward(0, 2)

      expect(rewardFromPostponedDistributor).to.equal(rewardFromDefaultDistributor)
    })

    it('returns proper value if interval starts before ending block, but ends after', async () => {
      const lastBlock = await distributor.lastBlock()
      const reward = await distributor.reward(lastBlock.sub(2000), lastBlock.add(2000))
      const expectedReward = await distributor.reward(lastBlock.sub(2000), lastBlock)

      expect(reward).to.equal(expectedReward)
    })

    it('returns total reward for interval including total rewarding period', async () => {
      const delayedDistributor = await new TrueDistributorFactory(owner).deploy(1000, fakeToken.address)
      const lastBlock = await delayedDistributor.lastBlock()

      const reward = await distributor.reward(0, lastBlock.add(2000))
      const expectedReward = '53649999999999999999999999971605309297031160000000'

      expect(reward).to.equal(expectedReward)
    })
  })
})
