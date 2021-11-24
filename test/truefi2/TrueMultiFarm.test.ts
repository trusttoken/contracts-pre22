import { expect, use } from 'chai'
import { MaxUint256 } from '@ethersproject/constants'
import { Wallet, BigNumber } from 'ethers'
import { MockProvider, solidity } from 'ethereum-waffle'

import {
  timeTravel,
  timeTravelTo,
  expectCloseTo,
  expectScaledCloseTo,
  parseEth,
  parseTRU,
} from 'utils'
import { setupTruefi2 } from 'fixtures/setupTruefi2'
import { beforeEachWithFixture } from 'fixtures/beforeEachWithFixture'

import {
  MockErc20Token,
  MockErc20Token__factory,
  LinearTrueDistributor,
  TrueMultiFarm__factory,
  TrueMultiFarm,
  LinearTrueDistributor__factory,
  StkTruToken,
  MockTrueCurrency,
} from 'contracts'

use(solidity)

describe('TrueMultiFarm', () => {
  const DAY = 24 * 3600
  let owner: Wallet
  let staker1: Wallet
  let staker2: Wallet
  let distributor: LinearTrueDistributor
  let tru: MockTrueCurrency
  let stkTru: StkTruToken
  let firstToken: MockErc20Token
  let secondToken: MockErc20Token
  let provider: MockProvider
  let farm: TrueMultiFarm
  let farm2: TrueMultiFarm
  let start: number

  const REWARD_DAYS = 10
  const DURATION = REWARD_DAYS * DAY
  const amount = BigNumber.from(1e11) // 1000 TRU = 100/day
  const txArgs = { gasLimit: 6_000_000 }

  const totalStaked = async (token = firstToken) => {
    return farm.stakes(token.address)
  }

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner, staker1, staker2] = wallets
    provider = _provider
    await provider.send('hardhat_reset', [])

    ; ({
      tru,
      stkTru,
    } = await setupTruefi2(owner, _provider))

    firstToken = await new MockErc20Token__factory(owner).deploy()
    secondToken = await new MockErc20Token__factory(owner).deploy()
    distributor = await new LinearTrueDistributor__factory(owner).deploy()
    const now = Math.floor(Date.now() / 1000)
    start = now + DAY

    await distributor.initialize(start, DURATION, amount, tru.address, txArgs)

    farm = await new TrueMultiFarm__factory(owner).deploy()
    farm2 = await new TrueMultiFarm__factory(owner).deploy()

    await distributor.setFarm(farm.address, txArgs)
    await farm.initialize(distributor.address, stkTru.address, txArgs)
    await farm.setShares([firstToken.address], [1], txArgs)

    await tru.mint(distributor.address, amount, txArgs)

    await firstToken.mint(staker1.address, parseEth(1000), txArgs)
    await firstToken.mint(staker2.address, parseEth(1000), txArgs)
    await firstToken.connect(staker1).approve(farm.address, MaxUint256, txArgs)
    await firstToken.connect(staker2).approve(farm.address, MaxUint256, txArgs)

    await secondToken.mint(staker1.address, parseEth(1000), txArgs)
    await secondToken.mint(staker2.address, parseEth(1000), txArgs)
    await secondToken.connect(staker1).approve(farm.address, MaxUint256, txArgs)
    await secondToken.connect(staker2).approve(farm.address, MaxUint256, txArgs)
  })

  describe('initializer', () => {
    it('owner can withdraw funds', async () => {
      await distributor.empty()
      expect(await tru.balanceOf(owner.address)).to.equal(amount)
    })

    it('owner can change farm with event', async () => {
      await expect(distributor.setFarm(farm2.address)).to.emit(distributor, 'FarmChanged')
        .withArgs(farm2.address)
    })

    it('cannot init farm unless distributor is set to farm', async () => {
      await expect(farm2.initialize(distributor.address, stkTru.address))
        .to.be.revertedWith('TrueMultiFarm: Distributor farm is not set')
    })
  })

  describe('one farm', () => {
    describe('one staker', () => {
      beforeEach(async () => {
        await timeTravelTo(provider, start)
      })

      it('correct events emitted', async () => {
        await expect(farm.connect(staker1).stake(firstToken.address, parseEth(500), txArgs)).to.emit(farm, 'Stake')
          .withArgs(firstToken.address, staker1.address, parseEth(500))
        await timeTravel(provider, DAY)
        await expect(farm.connect(staker1).claim([firstToken.address], txArgs)).to.emit(farm, 'Claim')
        await expect(farm.connect(staker1).unstake(firstToken.address, parseEth(500), txArgs)).to.emit(farm, 'Unstake')
          .withArgs(firstToken.address, staker1.address, parseEth(500))
      })

      it('staking changes stake balance', async () => {
        await farm.connect(staker1).stake(firstToken.address, parseEth(500), txArgs)
        expect(await farm.staked(firstToken.address, staker1.address)).to.equal(parseEth(500))
        expect(await totalStaked()).to.equal(parseEth(500))

        await farm.connect(staker1).stake(firstToken.address, parseEth(500), txArgs)
        expect(await farm.staked(firstToken.address, staker1.address)).to.equal(parseEth(1000))
        expect(await totalStaked()).to.equal(parseEth(1000))
      })

      it('unstaking changes stake balance', async () => {
        await farm.connect(staker1).stake(firstToken.address, parseEth(1000), txArgs)
        await farm.connect(staker1).unstake(firstToken.address, parseEth(500), txArgs)
        expect(await farm.staked(firstToken.address, staker1.address)).to.equal(parseEth(500))
        expect(await totalStaked()).to.equal(parseEth(500))
      })

      it('exiting changes stake balance', async () => {
        await farm.connect(staker1).stake(firstToken.address, parseEth(1000), txArgs)
        await farm.connect(staker1).exit([firstToken.address], txArgs)
        expect(await farm.staked(firstToken.address, staker1.address)).to.equal('0')
        expect(await totalStaked()).to.equal('0')
      })

      it('cannot unstake more than is staked', async () => {
        await farm.connect(staker1).stake(firstToken.address, parseEth(1000), txArgs)
        await expect(farm.connect(staker1).unstake(firstToken.address, parseEth(1001), txArgs)).to.be.revertedWith('TrueMultiFarm: Cannot withdraw amount bigger than available balance')
      })

      it('yields rewards per staked tokens (using claim)', async () => {
        await farm.connect(staker1).stake(firstToken.address, parseEth(1000), txArgs)
        await timeTravel(provider, DAY)
        await farm.connect(staker1).claim([firstToken.address], txArgs)
        expect(expectScaledCloseTo((await stkTru.balanceOf(staker1.address)), parseTRU(100)))
      })

      it('yields rewards per staked tokens (using exit)', async () => {
        await farm.connect(staker1).stake(firstToken.address, parseEth(1000), txArgs)
        await timeTravel(provider, DAY)
        await farm.connect(staker1).exit([firstToken.address], txArgs)
        expect(expectScaledCloseTo((await stkTru.balanceOf(staker1.address)), parseTRU(100)))
      })

      it('estimate rewards correctly', async () => {
        await farm.connect(staker1).stake(firstToken.address, parseEth(1000), txArgs)
        await timeTravel(provider, DAY)
        expect(expectScaledCloseTo((await farm.claimable(firstToken.address, staker1.address)), parseTRU(100), 1000))
        await timeTravel(provider, DAY)
        expect(expectScaledCloseTo((await farm.claimable(firstToken.address, staker1.address)), parseTRU(200), 1000))
        await farm.connect(staker1).unstake(firstToken.address, 100, txArgs)
        expect(expectScaledCloseTo((await farm.claimable(firstToken.address, staker1.address)), parseTRU(200), 1000))
        await farm.connect(staker1).claim([firstToken.address], txArgs)
        expect(expectScaledCloseTo((await stkTru.balanceOf(staker1.address)), parseTRU(200), 1000))
      })

      it('rewards when stake increases', async () => {
        await farm.connect(staker1).stake(firstToken.address, parseEth(500), txArgs)
        await timeTravel(provider, DAY)
        await farm.connect(staker1).stake(firstToken.address, parseEth(500), txArgs)
        await timeTravel(provider, DAY)
        await farm.connect(staker1).claim([firstToken.address], txArgs)

        expect(expectScaledCloseTo((await stkTru.balanceOf(staker1.address)), parseTRU(200)))
      })

      it('sending stake tokens to TrueMultiFarm does not affect calculations', async () => {
        await farm.connect(staker1).stake(firstToken.address, parseEth(500), txArgs)
        await firstToken.connect(staker1).transfer(farm.address, parseEth(500), txArgs)
        await timeTravel(provider, DAY)
        await farm.connect(staker1).claim([firstToken.address], txArgs)

        expect(expectScaledCloseTo((await stkTru.balanceOf(staker1.address)), parseTRU(100)))
      })

      it('staking claims pending rewards', async () => {
        await farm.connect(staker1).stake(firstToken.address, parseEth(500), txArgs)
        await timeTravel(provider, DAY)
        await farm.connect(staker1).stake(firstToken.address, parseEth(500), txArgs)

        expect(expectScaledCloseTo((await stkTru.balanceOf(staker1.address)), parseTRU(100)))
      })

      it('claiming sets claimable to 0', async () => {
        await farm.connect(staker1).stake(firstToken.address, parseEth(500), txArgs)
        await timeTravel(provider, DAY)
        // force an update to claimableReward:
        await farm.connect(staker1).unstake(firstToken.address, parseEth(1), txArgs)

        await farm.connect(staker1).claim([firstToken.address], txArgs)
        expect(await farm.claimable(firstToken.address, staker1.address)).to.equal(0)
      })

      it('claimable is zero from the start', async () => {
        expect(await farm.claimable(firstToken.address, staker1.address)).to.equal(0)
      })

      it('claimable is callable after unstake', async () => {
        await farm.connect(staker1).stake(firstToken.address, parseEth(500), txArgs)
        await timeTravel(provider, DAY)
        await farm.connect(staker1).unstake(firstToken.address, parseEth(500), txArgs)
        expect(await farm.claimable(firstToken.address, staker1.address)).to.be.gt(0)
      })

      it('calling distribute does not break reward calculations', async () => {
        await farm.connect(staker1).stake(firstToken.address, parseEth(500), txArgs)
        await timeTravel(provider, DAY)
        await distributor.distribute(txArgs)
        await timeTravel(provider, DAY)
        await farm.connect(staker1).claim([firstToken.address], txArgs)
        expect(expectScaledCloseTo((await stkTru.balanceOf(staker1.address)), parseTRU(200)))
      })

      it('owner withdrawing distributes funds', async () => {
        await farm.connect(staker1).stake(firstToken.address, parseEth(500), txArgs)
        expect(expectCloseTo((await tru.balanceOf(farm.address)), parseTRU(0), 2e6))
        await timeTravel(provider, DAY)
        await distributor.connect(owner).empty(txArgs)
        expect(expectScaledCloseTo((await tru.balanceOf(farm.address)), parseTRU(100)))
        await farm.connect(staker1).claim([firstToken.address], txArgs)
        expect(expectScaledCloseTo((await stkTru.balanceOf(staker1.address)), parseTRU(100)))
        expect(expectCloseTo((await tru.balanceOf(farm.address)), parseTRU(0), 2e6))
      })

      it('changing farm distributes funds', async () => {
        await farm.connect(staker1).stake(firstToken.address, parseEth(500), txArgs)
        expect(expectCloseTo((await tru.balanceOf(farm.address)), parseTRU(0), 2e6))
        await timeTravel(provider, DAY)
        await distributor.connect(owner).setFarm(farm2.address, txArgs)
        expect(expectScaledCloseTo((await tru.balanceOf(farm.address)), parseTRU(100)))
        await farm.connect(staker1).claim([firstToken.address], txArgs)
        expect(expectScaledCloseTo((await stkTru.balanceOf(staker1.address)), parseTRU(100)))
        expect(expectCloseTo((await tru.balanceOf(farm.address)), parseTRU(0), 2e6))
      })

      it('can withdraw liquidity after all TRU is distributed', async () => {
        await farm.connect(staker1).stake(firstToken.address, parseEth(500), txArgs)
        await timeTravel(provider, DAY * REWARD_DAYS)
        await farm.connect(staker1).claim([firstToken.address], txArgs)
        expect(expectScaledCloseTo((await stkTru.balanceOf(staker1.address)), amount))
        await timeTravel(provider, DAY)
        await farm.connect(staker1).unstake(firstToken.address, parseEth(500), txArgs)
      })

      it('scales withdrawn stkTru after slash', async () => {
        await tru.mint(owner.address, parseTRU(1000))
        await tru.approve(stkTru.address, parseTRU(1000))
        await stkTru.stake(parseTRU(1000))
        await stkTru.setLiquidator(owner.address)
        await stkTru.withdraw(parseTRU(100))

        await farm.connect(staker1).stake(firstToken.address, parseEth(500), txArgs)
        await timeTravel(provider, DAY * REWARD_DAYS)
        await farm.connect(staker1).claim([firstToken.address], txArgs)
        expect(expectScaledCloseTo((await stkTru.balanceOf(staker1.address)), amount.mul(10).div(9)))
      })
    })

    describe('with two stakers', function () {
      const dailyReward = amount.div(REWARD_DAYS)

      beforeEach(async () => {
        // staker1 with 4/5 of stake
        await farm.connect(staker1).stake(firstToken.address, parseEth(400), txArgs)
        // staker 2 has 1/5 of stake
        await farm.connect(staker2).stake(firstToken.address, parseEth(100), txArgs)
        await timeTravelTo(provider, start)
      })

      it('earn rewards in proportion to stake share', async () => {
        const days = 1
        await timeTravel(provider, DAY * days)
        await farm.connect(staker1).claim([firstToken.address], txArgs)
        await farm.connect(staker2).claim([firstToken.address], txArgs)

        expect(expectScaledCloseTo((await stkTru.balanceOf(staker1.address)),
          dailyReward.mul(days).mul(4).div(5)))
        expect(expectScaledCloseTo((await stkTru.balanceOf(staker2.address)),
          dailyReward.mul(days).mul(1).div(5)))
      })

      it('if additional funds are transferred to farm, they are also distributed accordingly to shares', async () => {
        const days = 1
        const additionalReward = parseTRU(100)
        const totalReward = dailyReward.add(additionalReward)
        await timeTravel(provider, DAY * days)
        tru.mint(farm.address, additionalReward, txArgs)
        await farm.connect(staker1).claim([firstToken.address], txArgs)
        await farm.connect(staker2).claim([firstToken.address], txArgs)

        expect(expectScaledCloseTo((await stkTru.balanceOf(staker1.address)),
          totalReward.mul(days).mul(4).div(5)))
        expect(expectScaledCloseTo((await stkTru.balanceOf(staker2.address)),
          totalReward.mul(days).mul(1).div(5)))
      })

      it('handles reward calculation after unstaking', async () => {
        const days = 1
        await timeTravel(provider, DAY)
        await farm.connect(staker1).unstake(firstToken.address, parseEth(300), txArgs)
        await timeTravel(provider, DAY)
        await farm.connect(staker1).claim([firstToken.address], txArgs)
        await farm.connect(staker2).claim([firstToken.address], txArgs)

        const staker1Reward = dailyReward.mul(days).mul(4).div(5).add(
          dailyReward.mul(days).mul(1).div(2))
        const staker2Reward = dailyReward.mul(days).mul(1).div(5).add(
          dailyReward.mul(days).mul(1).div(2))

        expect(expectScaledCloseTo((await stkTru.balanceOf(staker1.address)), staker1Reward))
        expect(expectScaledCloseTo((await stkTru.balanceOf(staker2.address)), staker2Reward))
      })
    })
  })

  describe('two farms', () => {
    beforeEach(async () => {
      await farm.setShares([secondToken.address], [3], txArgs)
    })

    it('getShare shows pool shares', async () => {
      expect(await farm.getShare(firstToken.address)).to.equal(1)
      expect(await farm.getShare(secondToken.address)).to.equal(3)
    })

    describe('one staker', () => {
      beforeEach(async () => {
        await timeTravelTo(provider, start)
      })

      it('correct events emitted', async () => {
        await expect(farm.connect(staker1).stake(firstToken.address, parseEth(500), txArgs)).to.emit(farm, 'Stake')
          .withArgs(firstToken.address, staker1.address, parseEth(500))
        await expect(farm.connect(staker1).stake(secondToken.address, parseEth(500), txArgs)).to.emit(farm, 'Stake')
          .withArgs(secondToken.address, staker1.address, parseEth(500))

        await timeTravel(provider, DAY)

        await expect(farm.connect(staker1).claim([firstToken.address, secondToken.address], txArgs)).to.emit(farm, 'Claim')
        await expect(farm.connect(staker1).unstake(firstToken.address, parseEth(500), txArgs)).to.emit(farm, 'Unstake')
          .withArgs(firstToken.address, staker1.address, parseEth(500))
        await expect(farm.connect(staker1).unstake(secondToken.address, parseEth(500), txArgs)).to.emit(farm, 'Unstake')
          .withArgs(secondToken.address, staker1.address, parseEth(500))
      })

      it('rejects if attempted to stake token with 0 shares', async () => {
        await farm.setShares([secondToken.address], [0])
        await expect(farm.connect(staker1).stake(secondToken.address, parseEth(500), txArgs)).to.be.revertedWith('TrueMultiFarm: This token has no shares')
      })

      it('allows to unstake token with 0 shares', async () => {
        await farm.connect(staker1).stake(secondToken.address, parseEth(500), txArgs)
        await farm.setShares([secondToken.address], [0])
        await expect(farm.connect(staker1).stake(secondToken.address, parseEth(500), txArgs)).to.be.revertedWith('TrueMultiFarm: This token has no shares')
        await farm.connect(staker1).exit([secondToken.address])
      })

      it('staking changes stake balance', async () => {
        await farm.connect(staker1).stake(secondToken.address, parseEth(500), txArgs)
        expect(await farm.staked(secondToken.address, staker1.address)).to.equal(parseEth(500))
        expect(await totalStaked(secondToken)).to.equal(parseEth(500))

        await farm.connect(staker1).stake(secondToken.address, parseEth(500), txArgs)
        expect(await farm.staked(secondToken.address, staker1.address)).to.equal(parseEth(1000))
        expect(await totalStaked(secondToken)).to.equal(parseEth(1000))
      })

      it('unstaking changes stake balance', async () => {
        await farm.connect(staker1).stake(secondToken.address, parseEth(1000), txArgs)
        await farm.connect(staker1).unstake(secondToken.address, parseEth(500), txArgs)
        expect(await farm.staked(secondToken.address, staker1.address)).to.equal(parseEth(500))
        expect(await totalStaked(secondToken)).to.equal(parseEth(500))
      })

      it('exiting changes stake balance', async () => {
        await farm.connect(staker1).stake(secondToken.address, parseEth(1000), txArgs)
        await farm.connect(staker1).exit([secondToken.address], txArgs)
        expect(await farm.staked(secondToken.address, staker1.address)).to.equal('0')
        expect(await totalStaked(secondToken)).to.equal('0')
      })

      it('cannot unstake more than is staked', async () => {
        await farm.connect(staker1).stake(secondToken.address, parseEth(1000), txArgs)
        await expect(farm.connect(staker1).unstake(secondToken.address, parseEth(1001), txArgs)).to.be.revertedWith('TrueMultiFarm: Cannot withdraw amount bigger than available balance')
      })

      it('yields rewards per staked tokens (using multi claim)', async () => {
        await farm.connect(staker1).stake(firstToken.address, parseEth(1000), txArgs)
        await farm.connect(staker1).stake(secondToken.address, parseEth(1000), txArgs)

        await timeTravel(provider, DAY)
        await farm.connect(staker1).claim([firstToken.address, secondToken.address], txArgs)
        expect(expectScaledCloseTo((await stkTru.balanceOf(staker1.address)), parseTRU(100)))
      })

      it('yields rewards per staked tokens (using single claims)', async () => {
        await farm.connect(staker1).stake(firstToken.address, parseEth(1000), txArgs)
        await farm.connect(staker1).stake(secondToken.address, parseEth(1000), txArgs)

        await timeTravel(provider, DAY)
        await farm.connect(staker1).claim([firstToken.address], txArgs)
        expect(expectScaledCloseTo((await stkTru.balanceOf(staker1.address)), parseTRU(25)))

        await farm.connect(staker1).claim([secondToken.address], txArgs)
        expect(expectScaledCloseTo((await stkTru.balanceOf(staker1.address)), parseTRU(100)))
      })

      it('yields rewards per staked tokens (using exit)', async () => {
        await farm.connect(staker1).stake(firstToken.address, parseEth(1000), txArgs)
        await farm.connect(staker1).stake(secondToken.address, parseEth(1000), txArgs)

        await timeTravel(provider, DAY)
        await farm.connect(staker1).exit([secondToken.address], txArgs)
        expect(expectScaledCloseTo((await stkTru.balanceOf(staker1.address)), parseTRU(75)))
        await farm.connect(staker1).exit([firstToken.address], txArgs)
        expect(expectScaledCloseTo((await stkTru.balanceOf(staker1.address)), parseTRU(100)))
      })

      it('estimate rewards correctly', async () => {
        await farm.connect(staker1).stake(firstToken.address, parseEth(1000), txArgs)
        await farm.connect(staker1).stake(secondToken.address, parseEth(1000), txArgs)

        await timeTravel(provider, DAY)
        expect(expectScaledCloseTo((await farm.claimable(firstToken.address, staker1.address)), parseTRU(25), 1000))
        expect(expectScaledCloseTo((await farm.claimable(secondToken.address, staker1.address)), parseTRU(75), 1000))

        await timeTravel(provider, DAY)
        expect(expectScaledCloseTo((await farm.claimable(firstToken.address, staker1.address)), parseTRU(50), 1000))
        expect(expectScaledCloseTo((await farm.claimable(secondToken.address, staker1.address)), parseTRU(150), 1000))

        await farm.connect(staker1).unstake(firstToken.address, 100, txArgs)

        expect(expectScaledCloseTo((await farm.claimable(firstToken.address, staker1.address)), parseTRU(50), 1000))
        expect(expectScaledCloseTo((await farm.claimable(secondToken.address, staker1.address)), parseTRU(150), 1000))

        await farm.connect(staker1).claim([firstToken.address, secondToken.address], txArgs)
        expect(expectScaledCloseTo((await stkTru.balanceOf(staker1.address)), parseTRU(200), 1000))
      })

      it('rewards when stake increases', async () => {
        await farm.connect(staker1).stake(firstToken.address, parseEth(500), txArgs)
        await farm.connect(staker1).stake(secondToken.address, parseEth(500), txArgs)

        await timeTravel(provider, DAY)
        await farm.connect(staker1).stake(firstToken.address, parseEth(500), txArgs)
        await farm.connect(staker1).stake(secondToken.address, parseEth(500), txArgs)

        await timeTravel(provider, DAY)
        await farm.connect(staker1).claim([firstToken.address, secondToken.address], txArgs)

        expect(expectScaledCloseTo((await stkTru.balanceOf(staker1.address)), parseTRU(200)))
      })

      it('sending stake tokens to TrueMultiFarm does not affect calculations', async () => {
        await farm.connect(staker1).stake(secondToken.address, parseEth(500), txArgs)
        await secondToken.connect(staker1).transfer(farm.address, parseEth(500), txArgs)
        await timeTravel(provider, DAY)
        await farm.connect(staker1).claim([secondToken.address], txArgs)

        expect(expectScaledCloseTo((await stkTru.balanceOf(staker1.address)), parseTRU(75)))
      })

      it('staking claims pending rewards', async () => {
        await farm.connect(staker1).stake(firstToken.address, parseEth(500), txArgs)
        await farm.connect(staker1).stake(secondToken.address, parseEth(500), txArgs)
        await timeTravel(provider, DAY)

        await farm.connect(staker1).stake(firstToken.address, parseEth(500), txArgs)
        expect(expectScaledCloseTo((await stkTru.balanceOf(staker1.address)), parseTRU(25)))

        await farm.connect(staker1).stake(secondToken.address, parseEth(500), txArgs)
        expect(expectScaledCloseTo((await stkTru.balanceOf(staker1.address)), parseTRU(100)))
      })

      it('claiming sets claimable to 0', async () => {
        await farm.connect(staker1).stake(firstToken.address, parseEth(500), txArgs)
        await farm.connect(staker1).stake(secondToken.address, parseEth(500), txArgs)
        await timeTravel(provider, DAY)
        // force an update to claimableReward:
        await farm.connect(staker1).unstake(firstToken.address, parseEth(1), txArgs)
        await farm.connect(staker1).unstake(secondToken.address, parseEth(1), txArgs)

        await farm.connect(staker1).claim([firstToken.address, secondToken.address], txArgs)
        expect(await farm.claimable(firstToken.address, staker1.address)).to.equal(0)
        expect(await farm.claimable(secondToken.address, staker1.address)).to.equal(0)
      })

      it('claimable is zero from the start', async () => {
        expect(await farm.claimable(firstToken.address, staker1.address)).to.equal(0)
      })

      it('claimable is callable after unstake', async () => {
        await farm.connect(staker1).stake(firstToken.address, parseEth(500), txArgs)
        await timeTravel(provider, DAY)
        await farm.connect(staker1).unstake(firstToken.address, parseEth(500), txArgs)
        expect(await farm.claimable(firstToken.address, staker1.address)).to.be.gt(0)
      })

      it('calling distribute does not break reward calculations', async () => {
        await farm.connect(staker1).stake(firstToken.address, parseEth(500), txArgs)
        await farm.connect(staker1).stake(secondToken.address, parseEth(500), txArgs)
        await timeTravel(provider, DAY)
        await distributor.distribute(txArgs)
        await timeTravel(provider, DAY)
        await farm.connect(staker1).claim([firstToken.address, secondToken.address], txArgs)
        expect(expectScaledCloseTo((await stkTru.balanceOf(staker1.address)), parseTRU(200)))
      })

      it('owner withdrawing distributes funds', async () => {
        await farm.connect(staker1).stake(firstToken.address, parseEth(500), txArgs)
        await farm.connect(staker1).stake(secondToken.address, parseEth(500), txArgs)
        expect(expectCloseTo((await tru.balanceOf(farm.address)), parseTRU(0), 2e6))

        await timeTravel(provider, DAY)
        await distributor.connect(owner).empty(txArgs)
        expect(expectScaledCloseTo((await tru.balanceOf(farm.address)), parseTRU(100)))

        await farm.connect(staker1).claim([firstToken.address, secondToken.address], txArgs)
        expect(expectScaledCloseTo((await stkTru.balanceOf(staker1.address)), parseTRU(100)))
        expect(expectCloseTo((await tru.balanceOf(farm.address)), parseTRU(0), 2e6))

        await timeTravel(provider, DAY)
        expect(await farm.claimable(firstToken.address, staker1.address)).to.equal(0)
        expect(await farm.claimable(secondToken.address, staker1.address)).to.equal(0)
      })

      it('changing farm distributes funds', async () => {
        await farm.connect(staker1).stake(firstToken.address, parseEth(500), txArgs)
        await farm.connect(staker1).stake(secondToken.address, parseEth(500), txArgs)
        expect(expectCloseTo((await tru.balanceOf(farm.address)), parseTRU(0), 2e6))

        await timeTravel(provider, DAY)
        await distributor.connect(owner).setFarm(farm2.address, txArgs)
        expect(expectScaledCloseTo((await tru.balanceOf(farm.address)), parseTRU(100)))
        await farm.connect(staker1).claim([firstToken.address, secondToken.address], txArgs)
        expect(expectScaledCloseTo((await stkTru.balanceOf(staker1.address)), parseTRU(100)))
        expect(expectCloseTo((await tru.balanceOf(farm.address)), parseTRU(0), 2e6))

        await timeTravel(provider, DAY)
        expect(await farm.claimable(firstToken.address, staker1.address)).to.equal(0)
        expect(await farm.claimable(secondToken.address, staker1.address)).to.equal(0)
      })

      it('can withdraw liquidity after all TRU is distributed', async () => {
        await farm.connect(staker1).stake(firstToken.address, parseEth(500), txArgs)
        await timeTravel(provider, DAY * REWARD_DAYS)
        await farm.connect(staker1).claim([firstToken.address], txArgs)
        expect(expectScaledCloseTo((await stkTru.balanceOf(staker1.address)), amount.div(4)))
        await timeTravel(provider, DAY)
        await farm.connect(staker1).unstake(firstToken.address, parseEth(500), txArgs)
      })
    })

    describe('with two stakers', function () {
      const dailyReward = amount.div(REWARD_DAYS)

      beforeEach(async () => {
        // staker1 with 4/5 of stake
        await farm.connect(staker1).stake(firstToken.address, parseEth(400), txArgs)
        await farm.connect(staker1).stake(secondToken.address, parseEth(400), txArgs)
        // staker 2 has 1/5 of stake
        await farm.connect(staker2).stake(firstToken.address, parseEth(100), txArgs)
        await farm.connect(staker2).stake(secondToken.address, parseEth(100), txArgs)
        await timeTravelTo(provider, start)
      })

      it('earn rewards in proportion to stake share', async () => {
        const days = 1
        await timeTravel(provider, DAY * days)
        await farm.connect(staker1).claim([firstToken.address], txArgs)
        await farm.connect(staker2).claim([firstToken.address], txArgs)

        // 1st token has 1/4 of shares
        expect(expectScaledCloseTo((await stkTru.balanceOf(staker1.address)),
          dailyReward.mul(days).mul(4).div(5).div(4)))
        expect(expectScaledCloseTo((await stkTru.balanceOf(staker2.address)),
          dailyReward.mul(days).mul(1).div(5).div(4)))

        await farm.connect(staker1).claim([secondToken.address], txArgs)
        await farm.connect(staker2).claim([secondToken.address], txArgs)

        expect(expectScaledCloseTo((await stkTru.balanceOf(staker1.address)),
          dailyReward.mul(days).mul(4).div(5)))
        expect(expectScaledCloseTo((await stkTru.balanceOf(staker2.address)),
          dailyReward.mul(days).mul(1).div(5)))
      })

      it('if additional funds are transferred to farm, they are also distributed accordingly to shares', async () => {
        const days = 1
        const additionalReward = parseTRU(100)
        const totalReward = dailyReward.add(additionalReward)
        await timeTravel(provider, DAY * days)
        tru.mint(farm.address, additionalReward, txArgs)
        await farm.connect(staker1).claim([firstToken.address, secondToken.address], txArgs)
        await farm.connect(staker2).claim([firstToken.address, secondToken.address], txArgs)

        expect(expectScaledCloseTo((await stkTru.balanceOf(staker1.address)),
          totalReward.mul(days).mul(4).div(5)))
        expect(expectScaledCloseTo((await stkTru.balanceOf(staker2.address)),
          totalReward.mul(days).mul(1).div(5)))
      })

      it('handles reward calculation after unstaking', async () => {
        const days = 1
        await timeTravel(provider, DAY)
        await farm.connect(staker1).unstake(firstToken.address, parseEth(300), txArgs)
        await farm.connect(staker1).unstake(secondToken.address, parseEth(300), txArgs)
        await timeTravel(provider, DAY)
        await farm.connect(staker1).claim([firstToken.address, secondToken.address], txArgs)
        await farm.connect(staker2).claim([firstToken.address, secondToken.address], txArgs)

        const staker1Reward = dailyReward.mul(days).mul(4).div(5).add(
          dailyReward.mul(days).mul(1).div(2))
        const staker2Reward = dailyReward.mul(days).mul(1).div(5).add(
          dailyReward.mul(days).mul(1).div(2))

        expect(expectScaledCloseTo((await stkTru.balanceOf(staker1.address)), staker1Reward))
        expect(expectScaledCloseTo((await stkTru.balanceOf(staker2.address)), staker2Reward))
      })
    })

    describe('farm shares change', () => {
      beforeEach(async () => {
        await timeTravelTo(provider, start)

        await farm.connect(staker1).stake(firstToken.address, parseEth(500))
        await farm.connect(staker1).stake(secondToken.address, parseEth(500))
      })

      it('rejects if length of farms mismatch', async () => {
        await expect(farm.setShares([firstToken.address, secondToken.address], [6], txArgs)).to.be.revertedWith('TrueMultiFarm: Array lengths mismatch')
      })

      it('rejects if non-owner attempts to change shares', async () => {
        await expect(farm.connect(staker1).setShares([firstToken.address, secondToken.address], [6], txArgs)).to.be.revertedWith('Ownable: caller is not the owner')
      })

      it('shares change is handled properly', async () => {
        await timeTravel(provider, DAY)
        expectScaledCloseTo(await farm.claimable(firstToken.address, staker1.address), parseTRU(25))
        expectScaledCloseTo(await farm.claimable(secondToken.address, staker1.address), parseTRU(75))

        await farm.setShares([firstToken.address, secondToken.address], [2, 2], txArgs)
        expectScaledCloseTo(await farm.claimable(firstToken.address, staker1.address), parseTRU(25))
        expectScaledCloseTo(await farm.claimable(secondToken.address, staker1.address), parseTRU(75))

        await timeTravel(provider, DAY)
        expectScaledCloseTo(await farm.claimable(firstToken.address, staker1.address), parseTRU(75))
        expectScaledCloseTo(await farm.claimable(secondToken.address, staker1.address), parseTRU(125))
      })

      it('claiming works when shares are changing', async () => {
        await timeTravel(provider, DAY)
        expectScaledCloseTo(await farm.claimable(firstToken.address, staker1.address), parseTRU(25))
        expectScaledCloseTo(await farm.claimable(secondToken.address, staker1.address), parseTRU(75))

        await farm.connect(staker1).claim([secondToken.address])
        expectScaledCloseTo(await farm.claimable(firstToken.address, staker1.address), parseTRU(25))
        expectCloseTo(await farm.claimable(secondToken.address, staker1.address), parseTRU(0), parseTRU(0.02).toNumber())

        await farm.setShares([firstToken.address, secondToken.address], [2, 2], txArgs)
        expectScaledCloseTo(await farm.claimable(firstToken.address, staker1.address), parseTRU(25))
        expectCloseTo(await farm.claimable(secondToken.address, staker1.address), parseTRU(0), parseTRU(0.02).toNumber())

        await timeTravel(provider, DAY)
        expectScaledCloseTo(await farm.claimable(firstToken.address, staker1.address), parseTRU(75))
        expectScaledCloseTo(await farm.claimable(secondToken.address, staker1.address), parseTRU(50))
      })

      it('calculates rewards correctly after new farm was added', async () => {
        const thirdToken = await new MockErc20Token__factory(owner).deploy()
        await thirdToken.mint(staker1.address, parseEth(1000), txArgs)
        await thirdToken.connect(staker1).approve(farm.address, MaxUint256, txArgs)

        await timeTravel(provider, DAY)
        await farm.setShares([thirdToken.address], [6], txArgs)
        await farm.connect(staker1).stake(thirdToken.address, parseEth(500), txArgs)

        expectScaledCloseTo(await farm.claimable(firstToken.address, staker1.address), parseTRU(25))
        expectScaledCloseTo(await farm.claimable(secondToken.address, staker1.address), parseTRU(75))
        expectCloseTo(await farm.claimable(thirdToken.address, staker1.address), parseTRU(0), parseTRU(0.02).toNumber())

        await timeTravel(provider, DAY)
        expectScaledCloseTo(await farm.claimable(firstToken.address, staker1.address), parseTRU(35))
        expectScaledCloseTo(await farm.claimable(secondToken.address, staker1.address), parseTRU(105))
        expectScaledCloseTo(await farm.claimable(thirdToken.address, staker1.address), parseTRU(60))
      })

      it('works for complex cases', async () => {
        const thirdToken = await new MockErc20Token__factory(owner).deploy()
        await thirdToken.mint(staker1.address, parseEth(1000), txArgs)
        await thirdToken.connect(staker1).approve(farm.address, MaxUint256, txArgs)

        await timeTravel(provider, DAY)
        await farm.setShares([thirdToken.address], [6], txArgs)
        await farm.connect(staker1).stake(thirdToken.address, parseEth(500), txArgs)

        expectScaledCloseTo(await farm.claimable(firstToken.address, staker1.address), parseTRU(25))
        expectScaledCloseTo(await farm.claimable(secondToken.address, staker1.address), parseTRU(75))
        expectCloseTo(await farm.claimable(thirdToken.address, staker1.address), parseTRU(0), parseTRU(0.02).toNumber())

        await timeTravel(provider, DAY)
        await farm.connect(staker1).claim([secondToken.address])
        expectScaledCloseTo(await farm.claimable(firstToken.address, staker1.address), parseTRU(35))
        expectCloseTo(await farm.claimable(secondToken.address, staker1.address), parseTRU(0), parseTRU(0.02).toNumber())
        expectScaledCloseTo(await farm.claimable(thirdToken.address, staker1.address), parseTRU(60))

        await farm.connect(staker1).unstake(firstToken.address, parseEth(500))
        await timeTravel(provider, DAY)
        expectScaledCloseTo(await farm.claimable(firstToken.address, staker1.address), parseTRU(35))
        expectScaledCloseTo(await farm.claimable(secondToken.address, staker1.address), parseTRU(30))
        expectScaledCloseTo(await farm.claimable(thirdToken.address, staker1.address), parseTRU(120))

        await farm.connect(staker1).claim([firstToken.address, secondToken.address])
        expectCloseTo(await farm.claimable(firstToken.address, staker1.address), parseTRU(0), parseTRU(0.02).toNumber())
        expectCloseTo(await farm.claimable(secondToken.address, staker1.address), parseTRU(0), parseTRU(0.02).toNumber())
        expectScaledCloseTo(await farm.claimable(thirdToken.address, staker1.address), parseTRU(120))

        await farm.connect(staker2).stake(secondToken.address, parseEth(1000))
        await timeTravel(provider, DAY)
        expectCloseTo(await farm.claimable(firstToken.address, staker1.address), parseTRU(0), parseTRU(0.02).toNumber())
        expectScaledCloseTo(await farm.claimable(secondToken.address, staker1.address), parseTRU(10))
        expectScaledCloseTo(await farm.claimable(thirdToken.address, staker1.address), parseTRU(180))
        expectScaledCloseTo(await farm.claimable(secondToken.address, staker2.address), parseTRU(20))

        await farm.setShares([firstToken.address, secondToken.address, thirdToken.address], [0, 3, 1], txArgs)

        await timeTravel(provider, DAY)
        expectCloseTo(await farm.claimable(firstToken.address, staker1.address), parseTRU(0), parseTRU(0.02).toNumber())
        expectScaledCloseTo(await farm.claimable(secondToken.address, staker1.address), parseTRU(35))
        expectScaledCloseTo(await farm.claimable(thirdToken.address, staker1.address), parseTRU(205))
        expectScaledCloseTo(await farm.claimable(secondToken.address, staker2.address), parseTRU(70))
      })
    })
  })
})
