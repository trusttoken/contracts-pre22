import { expect, use } from 'chai'
import { MaxUint256 } from '@ethersproject/constants'
import { Wallet, BigNumber, BigNumberish } from 'ethers'
import { MockProvider, solidity } from 'ethereum-waffle'

import {
  beforeEachWithFixture,
  timeTravel,
  timeTravelTo,
  expectCloseTo,
  expectScaledCloseTo,
  parseEth,
} from 'utils'

import {
  MockErc20Token,
  MockErc20TokenFactory,
  LinearTrueDistributor,
  TrueFarmFactory,
  TrueFarm,
  LinearTrueDistributorFactory,
} from 'contracts'

use(solidity)

describe('TrueFarm', () => {
  const DAY = 24 * 3600
  let owner: Wallet
  let staker1: Wallet
  let staker2: Wallet
  let distributor: LinearTrueDistributor
  let trustToken: MockErc20Token
  let stakingToken: MockErc20Token
  let provider: MockProvider
  let farm: TrueFarm
  let farm2: TrueFarm
  let start: number

  const REWARD_DAYS = 10
  const DURATION = REWARD_DAYS * DAY
  const amount = BigNumber.from(1e11) // 1000 TRU = 100/day
  const txArgs = { gasLimit: 6_000_000 }

  const fromTru = (amount: BigNumberish) => BigNumber.from(amount).mul(BigNumber.from(1e8))

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner, staker1, staker2] = wallets
    provider = _provider
    trustToken = await new MockErc20TokenFactory(owner).deploy()
    stakingToken = await new MockErc20TokenFactory(owner).deploy()
    distributor = await new LinearTrueDistributorFactory(owner).deploy()
    const now = Math.floor(Date.now() / 1000)
    start = now + DAY

    await distributor.initialize(start, DURATION, amount, trustToken.address)

    farm = await new TrueFarmFactory(owner).deploy()
    farm2 = await new TrueFarmFactory(owner).deploy()

    await distributor.setFarm(farm.address)
    await farm.initialize(stakingToken.address, distributor.address, 'Test farm')

    await trustToken.mint(distributor.address, amount)
    // await distributor.transfer(owner.address, farm.address, amount)
    await stakingToken.mint(staker1.address, parseEth(1000))
    await stakingToken.mint(staker2.address, parseEth(1000))
    await stakingToken.connect(staker1).approve(farm.address, MaxUint256)
    await stakingToken.connect(staker2).approve(farm.address, MaxUint256)
  })

  describe('initializer', () => {
    it('name is correct', async () => {
      expect(await farm.name()).to.equal('Test farm')
    })

    it('owner can withdraw funds', async () => {
      await distributor.empty()
      expect(await trustToken.balanceOf(owner.address)).to.equal(amount)
    })

    it('owner can change farm with event', async () => {
      await expect(distributor.setFarm(farm2.address)).to.emit(distributor, 'FarmChanged')
        .withArgs(farm2.address)
    })

    it('cannot init farm unless distributor is set to farm', async () => {
      await expect(farm2.initialize(stakingToken.address, distributor.address, 'Test farm'))
        .to.be.revertedWith('TrueFarm: Distributor farm is not set')
    })
  })

  describe('one staker', () => {
    beforeEach(async () => {
      await timeTravelTo(provider, start)
    })

    it('correct events emitted', async () => {
      await expect(farm.connect(staker1).stake(parseEth(500), txArgs)).to.emit(farm, 'Stake')
        .withArgs(staker1.address, parseEth(500))
      await timeTravel(provider, DAY)
      await expect(farm.connect(staker1).claim(txArgs)).to.emit(farm, 'Claim')
      await expect(farm.connect(staker1).unstake(parseEth(500), txArgs)).to.emit(farm, 'Unstake')
        .withArgs(staker1.address, parseEth(500))
    })

    it('staking changes stake balance', async () => {
      await farm.connect(staker1).stake(parseEth(500), txArgs)
      expect(await farm.staked(staker1.address)).to.equal(parseEth(500))
      expect(await farm.totalStaked()).to.equal(parseEth(500))

      await farm.connect(staker1).stake(parseEth(500), txArgs)
      expect(await farm.staked(staker1.address)).to.equal(parseEth(1000))
      expect(await farm.totalStaked()).to.equal(parseEth(1000))
    })

    it('unstaking changes stake balance', async () => {
      await farm.connect(staker1).stake(parseEth(1000), txArgs)
      await farm.connect(staker1).unstake(parseEth(500), txArgs)
      expect(await farm.staked(staker1.address)).to.equal(parseEth(500))
      expect(await farm.totalStaked()).to.equal(parseEth(500))
    })

    it('exiting changes stake balance', async () => {
      await farm.connect(staker1).stake(parseEth(1000), txArgs)
      await farm.connect(staker1).exit(parseEth(500), txArgs)
      expect(await farm.staked(staker1.address)).to.equal(parseEth(500))
      expect(await farm.totalStaked()).to.equal(parseEth(500))
    })

    it('cannot unstake more than is staked', async () => {
      await farm.connect(staker1).stake(parseEth(1000), txArgs)
      await expect(farm.connect(staker1).unstake(parseEth(1001), txArgs)).to.be.revertedWith('TrueFarm: Cannot withdraw amount bigger than available balance')
    })

    it('cannot exit more than is staked', async () => {
      await farm.connect(staker1).stake(parseEth(1000), txArgs)
      await expect(farm.connect(staker1).exit(parseEth(1001), txArgs)).to.be.revertedWith('TrueFarm: Cannot withdraw amount bigger than available balance')
    })

    it('yields rewards per staked tokens (using claim)', async () => {
      await farm.connect(staker1).stake(parseEth(1000), txArgs)
      await timeTravel(provider, DAY)
      await farm.connect(staker1).claim(txArgs)
      expect(expectScaledCloseTo((await trustToken.balanceOf(staker1.address)), fromTru(100)))
    })

    it('yields rewards per staked tokens (using exit)', async () => {
      await farm.connect(staker1).stake(parseEth(1000), txArgs)
      await timeTravel(provider, DAY)
      await farm.connect(staker1).exit(parseEth(1000), txArgs)
      expect(expectScaledCloseTo((await trustToken.balanceOf(staker1.address)), fromTru(100)))
    })

    it('estimate rewards correctly', async () => {
      await farm.connect(staker1).stake(parseEth(1000), txArgs)
      await timeTravel(provider, DAY)
      expect(expectScaledCloseTo((await farm.claimable(staker1.address)), fromTru(100)))
      await timeTravel(provider, DAY)
      expect(expectScaledCloseTo((await farm.claimable(staker1.address)), fromTru(200)))
      await farm.connect(staker1).unstake(100, txArgs)
      expect(expectScaledCloseTo((await farm.claimable(staker1.address)), fromTru(200)))
      await farm.connect(staker1).claim(txArgs)
      expect(expectScaledCloseTo((await trustToken.balanceOf(staker1.address)), fromTru(200)))
    })

    it('rewards when stake increases', async () => {
      await farm.connect(staker1).stake(parseEth(500), txArgs)
      await timeTravel(provider, DAY)
      await farm.connect(staker1).stake(parseEth(500), txArgs)
      await timeTravel(provider, DAY)
      await farm.connect(staker1).claim(txArgs)

      expect(expectScaledCloseTo((await trustToken.balanceOf(staker1.address)), fromTru(200)))
    })

    it('sending stake tokens to TrueFarm does not affect calculations', async () => {
      await farm.connect(staker1).stake(parseEth(500), txArgs)
      await stakingToken.connect(staker1).transfer(farm.address, parseEth(500), txArgs)
      await timeTravel(provider, DAY)
      await farm.connect(staker1).claim(txArgs)

      expect(expectScaledCloseTo((await trustToken.balanceOf(staker1.address)), fromTru(100)))
    })

    it('staking claims pending rewards', async () => {
      await farm.connect(staker1).stake(parseEth(500), txArgs)
      await timeTravel(provider, DAY)
      await farm.connect(staker1).stake(parseEth(500), txArgs)

      expect(expectScaledCloseTo((await trustToken.balanceOf(staker1.address)), fromTru(100)))
    })

    it('claiming clears claimableRewards', async () => {
      await farm.connect(staker1).stake(parseEth(500), txArgs)
      await timeTravel(provider, DAY)
      // force an update to claimableReward:
      await farm.connect(staker1).unstake(parseEth(1), txArgs)
      expect(await farm.claimableReward(staker1.address)).to.be.gt(0)

      await farm.connect(staker1).claim(txArgs)
      expect(await farm.claimableReward(staker1.address)).to.equal(0)
      expect(await farm.claimable(staker1.address)).to.equal(0)
    })

    it('claimable is zero from the start', async () => {
      expect(await farm.claimable(staker1.address)).to.equal(0)
    })

    it('claimable is callable after unstake', async () => {
      await farm.connect(staker1).stake(parseEth(500), txArgs)
      await timeTravel(provider, DAY)
      await farm.connect(staker1).unstake(parseEth(500), txArgs)
      expect(await farm.claimable(staker1.address)).to.be.gt(0)
    })

    it('calling distribute does not break reward calculations', async () => {
      await farm.connect(staker1).stake(parseEth(500), txArgs)
      await timeTravel(provider, DAY)
      await distributor.distribute(txArgs)
      await timeTravel(provider, DAY)
      await farm.connect(staker1).claim(txArgs)
      expect(expectScaledCloseTo((await trustToken.balanceOf(staker1.address)), fromTru(200)))
    })

    it('owner withdrawing distributes funds', async () => {
      await farm.connect(staker1).stake(parseEth(500), txArgs)
      expect(expectCloseTo((await trustToken.balanceOf(farm.address)), fromTru(0), 2e6))
      await timeTravel(provider, DAY)
      await distributor.connect(owner).empty(txArgs)
      expect(expectScaledCloseTo((await trustToken.balanceOf(farm.address)), fromTru(100)))
      await farm.connect(staker1).claim(txArgs)
      expect(expectScaledCloseTo((await trustToken.balanceOf(staker1.address)), fromTru(100)))
      expect(expectCloseTo((await trustToken.balanceOf(farm.address)), fromTru(0), 2e6))
    })

    it('changing farm distributes funds', async () => {
      await farm.connect(staker1).stake(parseEth(500), txArgs)
      expect(expectCloseTo((await trustToken.balanceOf(farm.address)), fromTru(0), 2e6))
      await timeTravel(provider, DAY)
      await distributor.connect(owner).setFarm(farm2.address, txArgs)
      expect(expectScaledCloseTo((await trustToken.balanceOf(farm.address)), fromTru(100)))
      await farm.connect(staker1).claim(txArgs)
      expect(expectScaledCloseTo((await trustToken.balanceOf(staker1.address)), fromTru(100)))
      expect(expectCloseTo((await trustToken.balanceOf(farm.address)), fromTru(0), 2e6))
    })

    it('can withdraw liquidity after all TRU is distributed', async () => {
      await farm.connect(staker1).stake(parseEth(500), txArgs)
      await timeTravel(provider, DAY * REWARD_DAYS)
      await farm.connect(staker1).claim(txArgs)
      expect(expectScaledCloseTo((await trustToken.balanceOf(staker1.address)), amount))
      await timeTravel(provider, DAY)
      await farm.connect(staker1).unstake(parseEth(500), txArgs)
    })
  })

  describe('with two stakers', function () {
    const dailyReward = amount.div(REWARD_DAYS)

    beforeEach(async () => {
      // staker1 with 4/5 of stake
      await farm.connect(staker1).stake(parseEth(400), txArgs)
      // staker 2 has 1/5 of stake
      await farm.connect(staker2).stake(parseEth(100), txArgs)
      await timeTravelTo(provider, start)
    })

    it('earn rewards in proportion to stake share', async () => {
      const days = 1
      await timeTravel(provider, DAY * days)
      await farm.connect(staker1).claim(txArgs)
      await farm.connect(staker2).claim(txArgs)

      expect(expectScaledCloseTo((await trustToken.balanceOf(staker1.address)),
        dailyReward.mul(days).mul(4).div(5)))
      expect(expectScaledCloseTo((await trustToken.balanceOf(staker2.address)),
        dailyReward.mul(days).mul(1).div(5)))
    })

    it('if additional funds are transferred to farm, they are also distributed accordingly to shares', async () => {
      const days = 1
      const additionalReward = fromTru(100)
      const totalReward = dailyReward.add(additionalReward)
      await timeTravel(provider, DAY * days)
      trustToken.mint(farm.address, additionalReward, txArgs)
      await farm.connect(staker1).claim(txArgs)
      await farm.connect(staker2).claim(txArgs)

      expect(expectScaledCloseTo((await trustToken.balanceOf(staker1.address)),
        totalReward.mul(days).mul(4).div(5)))
      expect(expectScaledCloseTo((await trustToken.balanceOf(staker2.address)),
        totalReward.mul(days).mul(1).div(5)))
    })

    it('handles reward calculation after unstaking', async () => {
      const days = 1
      await timeTravel(provider, DAY)
      await farm.connect(staker1).unstake(parseEth(300), txArgs)
      await timeTravel(provider, DAY)
      await farm.connect(staker1).claim(txArgs)
      await farm.connect(staker2).claim(txArgs)

      const staker1Reward = dailyReward.mul(days).mul(4).div(5).add(
        dailyReward.mul(days).mul(1).div(2))
      const staker2Reward = dailyReward.mul(days).mul(1).div(5).add(
        dailyReward.mul(days).mul(1).div(2))

      expect(expectScaledCloseTo((await trustToken.balanceOf(staker1.address)), staker1Reward))
      expect(expectScaledCloseTo((await trustToken.balanceOf(staker2.address)), staker2Reward))
    })
  })
})
