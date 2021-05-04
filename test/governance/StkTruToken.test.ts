import { expect, use } from 'chai'
import { providers, utils, Wallet, constants } from 'ethers'
import { solidity } from 'ethereum-waffle'
import { AddressZero, MaxUint256 } from '@ethersproject/constants'

import { setupDeploy } from 'scripts/utils'

import {
  beforeEachWithFixture,
  DAY,
  expectCloseTo,
  expectScaledCloseTo,
  parseEth,
  parseTRU,
  timeTravel,
  timeTravelTo,
} from 'utils'

import {
  LinearTrueDistributor, LinearTrueDistributor__factory,
  MockTrueCurrency,
  MockTrueCurrency__factory,
  StkTruToken,
  StkTruToken__factory,
  TrustToken,
  TrustToken__factory,
} from 'contracts'

use(solidity)

describe('StkTruToken', () => {
  let owner: Wallet
  let staker: Wallet
  let liquidator: Wallet
  let tru: TrustToken
  let stkToken: StkTruToken
  let tfusd: MockTrueCurrency
  let feeToken: MockTrueCurrency
  let distributor: LinearTrueDistributor
  let provider: providers.JsonRpcProvider

  const amount = parseTRU(100)
  const stakeCooldown = DAY * 14

  beforeEachWithFixture(async (wallets, _provider) => {
    ([owner, staker, liquidator] = wallets)
    provider = _provider
    const deployContract = setupDeploy(owner)
    tru = await deployContract(TrustToken__factory)
    await tru.initialize()
    tfusd = await deployContract(MockTrueCurrency__factory)
    feeToken = await deployContract(MockTrueCurrency__factory)
    distributor = await deployContract(LinearTrueDistributor__factory)

    stkToken = await deployContract(StkTruToken__factory)
    await stkToken.initialize(tru.address, tfusd.address, feeToken.address, distributor.address, liquidator.address)

    await tru.mint(owner.address, amount)
    await tru.approve(stkToken.address, amount)

    await tru.mint(staker.address, amount.div(2))
    await tru.connect(staker).approve(stkToken.address, amount.div(2))
  })

  describe('Initializer', () => {
    it('sets TRU', async () => {
      expect(await stkToken.tru()).to.eq(tru.address)
    })

    it('sets tfUSD', async () => {
      expect(await stkToken.tfusd()).to.eq(tfusd.address)
    })

    it('sets fee token', async () => {
      expect(await stkToken.feeToken()).to.eq(feeToken.address)
    })

    it('sets distributor', async () => {
      expect(await stkToken.distributor()).to.eq(distributor.address)
    })

    it('sets liquidator', async () => {
      expect(await stkToken.liquidator()).to.eq(liquidator.address)
    })

    it('sets cooldown time', async () => {
      expect(await stkToken.cooldownTime()).to.eq(DAY * 14)
    })

    it('sets unstake period duration', async () => {
      expect(await stkToken.unstakePeriodDuration()).to.eq(DAY * 2)
    })
  })

  describe('setFeeToken', () => {
    it('is possible to change fee token from address(0)', async () => {
      await stkToken.setFeeToken(AddressZero)
      await stkToken.setFeeToken(feeToken.address)
      expect(await stkToken.feeToken()).to.eq(feeToken.address)
    })

    it('only owner', async () => {
      await expect(stkToken.connect(staker).setFeeToken(tfusd.address))
        .to.be.revertedWith('only owner')
    })

    it('cannot change when rewards were not claimed', async () => {
      await feeToken.mint(stkToken.address, 1)
      await expect(stkToken.setFeeToken(tfusd.address))
        .to.be.revertedWith('StkTruToken: Cannot replace fee token with underlying rewards')
    })

    it('changes value', async () => {
      await stkToken.setFeeToken(tfusd.address)
      expect(await stkToken.feeToken()).to.eq(tfusd.address)
    })

    it('emits event', async () => {
      await expect(stkToken.setFeeToken(tfusd.address))
        .to.emit(stkToken, 'FeeTokenChanged')
        .withArgs(tfusd.address)
    })
  })

  describe('setPayerWhitelistingStatus', () => {
    it('only owner', async () => {
      await expect(stkToken.connect(staker).setPayerWhitelistingStatus(staker.address, true))
        .to.be.revertedWith('only owner')
    })

    it('sets status', async () => {
      await stkToken.setPayerWhitelistingStatus(staker.address, true)
      expect(await stkToken.whitelistedFeePayers(staker.address)).to.eq(true)

      await stkToken.setPayerWhitelistingStatus(staker.address, false)
      expect(await stkToken.whitelistedFeePayers(staker.address)).to.eq(false)
    })

    it('emits event', async () => {
      await expect(stkToken.setPayerWhitelistingStatus(staker.address, true))
        .to.emit(stkToken, 'FeePayerWhitelistingStatusChanged')
        .withArgs(staker.address, true)

      await expect(stkToken.setPayerWhitelistingStatus(staker.address, false))
        .to.emit(stkToken, 'FeePayerWhitelistingStatusChanged')
        .withArgs(staker.address, false)
    })
  })

  describe('setLiquidator', () => {
    it('only owner', async () => {
      await expect(stkToken.connect(staker).setLiquidator(staker.address))
        .to.be.revertedWith('only owner')
    })

    it('sets liquidator', async () => {
      await stkToken.setLiquidator(owner.address)
      expect(await stkToken.liquidator()).to.eq(owner.address)
    })

    it('emits event', async () => {
      await expect(stkToken.setLiquidator(owner.address))
        .to.emit(stkToken, 'LiquidatorChanged')
        .withArgs(owner.address)
    })
  })

  describe('setCooldownTime', () => {
    it('changes value', async () => {
      await stkToken.setCooldownTime(100)
      expect(await stkToken.cooldownTime()).to.equal(100)
    })

    it('only owner', async () => {
      await expect(stkToken.connect(staker).setCooldownTime(100)).to.be.revertedWith('only owner')
    })

    it('cannot be infinite', async () => {
      await expect(stkToken.setCooldownTime(MaxUint256)).to.be.revertedWith('StkTruToken: Cooldown too large')
    })

    it('emits event', async () => {
      await expect(stkToken.setCooldownTime(100))
        .to.emit(stkToken, 'CooldownTimeChanged')
        .withArgs(100)
    })
  })

  describe('setPauseStatus', () => {
    it('only owner', async () => {
      await expect(stkToken.connect(staker).setPauseStatus(true)).to.be.revertedWith('only owner')
    })

    it('sets status', async () => {
      await stkToken.setPauseStatus(true)
      expect(await stkToken.pauseStatus()).to.eq(true)

      await stkToken.setPauseStatus(false)
      expect(await stkToken.pauseStatus()).to.eq(false)
    })

    it('emits event', async () => {
      await expect(stkToken.setPauseStatus(true))
        .to.emit(stkToken, 'PauseStatusChanged')
        .withArgs(true)

      await expect(stkToken.setPauseStatus(false))
        .to.emit(stkToken, 'PauseStatusChanged')
        .withArgs(false)
    })
  })

  describe('setUnstakePeriodDuration', () => {
    it('changes value', async () => {
      await stkToken.setUnstakePeriodDuration(100)
      expect(await stkToken.unstakePeriodDuration()).to.equal(100)
    })

    it('only owner', async () => {
      await expect(stkToken.connect(staker).setUnstakePeriodDuration(100)).to.be.revertedWith('only owner')
    })

    it('cannot be infinite', async () => {
      await expect(stkToken.setUnstakePeriodDuration(MaxUint256)).to.be.revertedWith('StkTruToken: Unstake period too large')
    })

    it('cannot be 0', async () => {
      await expect(stkToken.setUnstakePeriodDuration(0)).to.be.revertedWith('StkTruToken: Unstake period cannot be 0')
    })

    it('emits event', async () => {
      await expect(stkToken.setUnstakePeriodDuration(100))
        .to.emit(stkToken, 'UnstakePeriodDurationChanged')
    })
  })

  describe('Staking-Unstaking', () => {
    it('stake emits event', async () => {
      await expect(stkToken.stake(amount)).to.emit(stkToken, 'Stake').withArgs(owner.address, amount)
    })

    it('unstake emits event', async () => {
      await stkToken.stake(amount)
      await stkToken.cooldown()
      await timeTravel(provider, stakeCooldown)
      await expect(stkToken.unstake(amount)).to.emit(stkToken, 'Unstake').withArgs(owner.address, amount)
    })

    it('tokens are burnt on unstake', async () => {
      await stkToken.stake(amount)
      await stkToken.cooldown()
      await timeTravel(provider, stakeCooldown)
      await stkToken.unstake(amount)
      expect(await stkToken.totalSupply()).to.equal(0)
    })

    it('changes stake supply', async () => {
      await stkToken.stake(amount)
      expect(await stkToken.stakeSupply()).to.equal(amount)
      await stkToken.cooldown()
      await timeTravel(provider, stakeCooldown)
      await stkToken.unstake(amount)
      expect(await stkToken.stakeSupply()).to.equal(0)
    })

    it('single user stakes, unstakes, gets same amount of TRU', async () => {
      await stkToken.stake(amount)
      await stkToken.cooldown()
      await timeTravel(provider, stakeCooldown)
      await stkToken.unstake(amount)
      expect(await tru.balanceOf(owner.address)).to.equal(amount)
    })

    it('multiple users get proportional amounts of TRU', async () => {
      await stkToken.stake(amount)
      await stkToken.connect(staker).stake(amount.div(2))

      expect(await stkToken.balanceOf(owner.address)).to.equal(amount)
      expect(await stkToken.balanceOf(staker.address)).to.equal(amount.div(2))

      await stkToken.connect(staker).cooldown()
      await stkToken.cooldown()

      await timeTravel(provider, stakeCooldown)
      await stkToken.unstake(amount)
      await stkToken.connect(staker).unstake(amount.div(2))
      expect(await tru.balanceOf(owner.address)).to.equal(amount)
      expect(await tru.balanceOf(staker.address)).to.equal(amount.div(2))
    })
  })

  describe('Withdraw', () => {
    const liquidationAmount = parseTRU(1)

    it('can be called only by the liquidator', async () => {
      await expect(stkToken.withdraw(1)).to.be.revertedWith('StkTruToken: Can be called only by the liquidator')
    })

    it('transfers amount to liquidator', async () => {
      await stkToken.stake(amount)
      await stkToken.connect(liquidator).withdraw(liquidationAmount)
      expect(await tru.balanceOf(liquidator.address)).to.equal(liquidationAmount)
    })

    it('reduces stake supply', async () => {
      await stkToken.stake(amount)
      await stkToken.connect(liquidator).withdraw(liquidationAmount)
      expect(await stkToken.stakeSupply()).to.equal(amount.sub(liquidationAmount))
    })

    it('emits event', async () => {
      await stkToken.stake(amount)
      await expect(stkToken.connect(liquidator).withdraw(liquidationAmount)).to.emit(stkToken, 'Withdraw')
        .withArgs(liquidationAmount)
    })

    it('staking post withdraw works correctly', async () => {
      await stkToken.stake(amount)
      await stkToken.connect(liquidator).withdraw(liquidationAmount)
      await stkToken.connect(staker).stake(amount.div(2))
      expect(await stkToken.balanceOf(staker.address)).to.equal(amount.div(2).mul(100).div(99))

      await stkToken.cooldown()
      await stkToken.connect(staker).cooldown()
      await timeTravel(provider, stakeCooldown)

      await stkToken.connect(staker).unstake(await stkToken.balanceOf(staker.address))
      await stkToken.unstake(amount)

      expect(await tru.balanceOf(owner.address)).to.equal(parseTRU(99).add(1))
      expect(await tru.balanceOf(staker.address)).to.equal(amount.div(2).sub(1))
    })
  })

  describe('Claim', () => {
    const distributionStart = 1700000000

    beforeEach(async () => {
      await distributor.initialize(distributionStart, 10 * DAY, parseTRU(10000), tru.address)
      await tru.mint(distributor.address, parseTRU(10000))
      await distributor.setFarm(stkToken.address)
      await timeTravelTo(provider, distributionStart)
    })

    it('complex scenario', async () => {
      await stkToken.stake(amount, { gasLimit: 3000000 })
      await timeTravel(provider, DAY)

      await tfusd.mint(stkToken.address, parseEth(1), { gasLimit: 3000000 })
      await feeToken.mint(stkToken.address, parseEth(2), { gasLimit: 3000000 })

      expectScaledCloseTo(await stkToken.claimable(owner.address, tru.address), parseTRU(1000))
      expect(await stkToken.claimable(owner.address, tfusd.address)).to.equal(parseEth(1))
      expect(await stkToken.claimable(owner.address, feeToken.address)).to.equal(parseEth(2))

      await stkToken.connect(staker).stake(amount.div(2), { gasLimit: 3000000 })
      await timeTravel(provider, DAY)

      expectScaledCloseTo(await stkToken.claimable(owner.address, tru.address), parseTRU(1666.666))
      expectScaledCloseTo(await stkToken.claimable(staker.address, tru.address), parseTRU(333.3333))

      await tru.mint(stkToken.address, parseTRU(3000), { gasLimit: 3000000 })

      expectScaledCloseTo(await stkToken.claimable(owner.address, tru.address), parseTRU(3666.666))
      expectScaledCloseTo(await stkToken.claimable(staker.address, tru.address), parseTRU(1333.3333))

      expect(await stkToken.claimable(owner.address, tfusd.address)).to.equal(parseEth(1))
      expect(await stkToken.claimable(staker.address, tfusd.address)).to.equal(0)
      expect(await stkToken.claimable(owner.address, feeToken.address)).to.equal(parseEth(2))
      expect(await stkToken.claimable(staker.address, feeToken.address)).to.equal(0)

      await tfusd.mint(stkToken.address, parseEth(3), { gasLimit: 3000000 })
      await feeToken.mint(stkToken.address, parseEth(6), { gasLimit: 3000000 })

      expect(await stkToken.claimable(owner.address, tfusd.address)).to.equal(parseEth(3))
      expect(await stkToken.claimable(staker.address, tfusd.address)).to.equal(parseEth(1))
      expect(await stkToken.claimable(owner.address, feeToken.address)).to.equal(parseEth(6))
      expect(await stkToken.claimable(staker.address, feeToken.address)).to.equal(parseEth(2))

      await stkToken.claim({ gasLimit: 3000000 })
      await stkToken.connect(staker).claim({ gasLimit: 3000000 })

      expectScaledCloseTo(await tru.balanceOf(owner.address), parseTRU(3666.666))
      expectScaledCloseTo(await tru.balanceOf(staker.address), parseTRU(1333.3333))
      expect(await tfusd.balanceOf(owner.address)).to.equal(parseEth(3))
      expect(await tfusd.balanceOf(staker.address)).to.equal(parseEth(1))
      expect(await feeToken.balanceOf(owner.address)).to.equal(parseEth(6))
      expect(await feeToken.balanceOf(staker.address)).to.equal(parseEth(2))
    })

    describe('Individual Token Claims', () => {
      beforeEach(async () => {
        await stkToken.stake(amount, { gasLimit: 3000000 })
        await timeTravel(provider, DAY)
        await tfusd.mint(stkToken.address, parseEth(1), { gasLimit: 3000000 })
        await feeToken.mint(stkToken.address, parseEth(1), { gasLimit: 3000000 })
      })

      it('claim only TRU', async () => {
        const balanceBefore = await tru.balanceOf(owner.address)
        expectScaledCloseTo(await stkToken.claimable(owner.address, tru.address), parseTRU(1000))
        await stkToken.claimRewards(tru.address, { gasLimit: 3000000 })
        expectScaledCloseTo(await tru.balanceOf(owner.address), balanceBefore.add(parseTRU(1000)))
      })

      it('claim only tfUSD', async () => {
        const balanceBefore = await tfusd.balanceOf(owner.address)
        expect(await stkToken.claimable(owner.address, tfusd.address)).to.equal(parseEth(1))
        await stkToken.claimRewards(tfusd.address, { gasLimit: 3000000 })
        expectScaledCloseTo(await tfusd.balanceOf(owner.address), (balanceBefore.add(parseEth(1))))
      })

      it('claim only fee token', async () => {
        const balanceBefore = await feeToken.balanceOf(owner.address)

        expect(await stkToken.claimable(owner.address, feeToken.address)).to.equal(parseEth(1))
        await stkToken.claimRewards(feeToken.address, { gasLimit: 3000000 })
        expectScaledCloseTo(await feeToken.balanceOf(owner.address), (balanceBefore.add(parseEth(1))))
      })

      it('claimable returns 0 for non-rewards tokens', async () => {
        expect(await stkToken.claimable(owner.address, constants.AddressZero)).to.equal(0)
      })

      it('cannot claim non-reward tokens revert', async () => {
        await expect(stkToken.claimRewards(constants.AddressZero, { gasLimit: 3000000 })).to.be.revertedWith('Token not supported for rewards')
      })

      it('skips transfer if there is nothing to claim', async () => {
        await stkToken.claimRewards(feeToken.address, { gasLimit: 3000000 })
        await expect(stkToken.claimRewards(feeToken.address, { gasLimit: 3000000 }))
          .to.not.emit(feeToken, 'Transfer')
      })
    })

    describe('Claim Restake TRU with no extra', () => {
      beforeEach(async () => {
        await stkToken.stake(amount, { gasLimit: 3000000 })
        await timeTravel(provider, DAY)
        await tfusd.mint(stkToken.address, parseEth(1), { gasLimit: 3000000 })
      })

      it('emits Claim event', async () => {
        await expect(stkToken.claimRestake(0)).to.emit(stkToken, 'Claim')
      })

      it('emits Stake event', async () => {
        await expect(stkToken.claimRestake(0)).to.emit(stkToken, 'Stake')
      })

      it('clears claimable balance', async () => {
        expectScaledCloseTo(await stkToken.claimable(owner.address, tru.address), parseTRU(1000))
        await stkToken.claimRestake(0)
        expect(await stkToken.claimable(owner.address, tru.address)).to.equal(0)
      })

      it('stakes claimable balance', async () => {
        expect(await stkToken.stakeSupply()).to.equal(amount)
        await stkToken.claimRestake(0)
        expectScaledCloseTo(await stkToken.stakeSupply(), amount.add(parseTRU(1000)))
      })

      it('does not affect owner address balance', async () => {
        const balanceBefore = await tru.balanceOf(owner.address)
        await stkToken.claimRestake(0)
        expect(await tru.balanceOf(owner.address)).to.equal(balanceBefore)
      })
    })

    describe('Claim Restake TRU with extra', () => {
      const extraStake = amount.div(4)

      beforeEach(async () => {
        await stkToken.stake(amount, { gasLimit: 3000000 })
        await tru.mint(owner.address, extraStake)
        await tru.approve(stkToken.address, extraStake)
        await timeTravel(provider, DAY)
        await tfusd.mint(stkToken.address, parseEth(1), { gasLimit: 3000000 })
      })

      it('emits Claim event', async () => {
        await expect(stkToken.claimRestake(extraStake)).to.emit(stkToken, 'Claim')
      })

      it('emits Stake event', async () => {
        await expect(stkToken.claimRestake(extraStake)).to.emit(stkToken, 'Stake')
      })

      it('clears claimable balance', async () => {
        expectScaledCloseTo(await stkToken.claimable(owner.address, tru.address), parseTRU(1000))
        await stkToken.claimRestake(extraStake)
        expect(await stkToken.claimable(owner.address, tru.address)).to.equal(0)
      })

      it('stakes claimable balance and extra amount', async () => {
        expect(await stkToken.stakeSupply()).to.equal(amount)
        await stkToken.claimRestake(extraStake)
        expectScaledCloseTo(await stkToken.stakeSupply(), amount.add(parseTRU(1000)).add(extraStake))
      })

      it('removes extra amount from owner address balance', async () => {
        const balanceBefore = await tru.balanceOf(owner.address)
        await stkToken.claimRestake(extraStake)
        expect(await tru.balanceOf(owner.address)).to.equal(balanceBefore.sub(extraStake))
      })
    })
  })

  describe('Cooldown', () => {
    it('emits event', async () => {
      const tx = await stkToken.cooldown()
      const block = await provider.getBlock(tx.blockNumber)

      await expect(Promise.resolve(tx)).to.emit(stkToken, 'Cooldown')
        .withArgs(owner.address, block.timestamp + stakeCooldown)
    })

    it('cannot unstake without starting cooldown timer', async () => {
      await stkToken.stake(amount)
      await timeTravel(provider, stakeCooldown)
      await expect(stkToken.unstake(amount)).to.be.revertedWith('StkTruToken: Stake on cooldown')
    })

    it('cannot unstake on cooldown', async () => {
      await stkToken.stake(amount)
      await stkToken.cooldown()
      await timeTravel(provider, stakeCooldown - DAY)
      await expect(stkToken.unstake(amount)).to.be.revertedWith('StkTruToken: Stake on cooldown')
    })

    it('cannot unstake after unstake window has passed', async () => {
      await stkToken.stake(amount)
      await stkToken.cooldown()
      await timeTravel(provider, stakeCooldown + 2 * DAY + 1)
      await expect(stkToken.unstake(amount)).to.be.revertedWith('StkTruToken: Stake on cooldown')
    })

    it('staking more resets cooldown and emits event', async () => {
      await stkToken.stake(amount.div(2))
      await stkToken.cooldown()
      await timeTravel(provider, DAY)
      const tx = await stkToken.stake(amount.div(2))
      const block = await provider.getBlock(tx.blockNumber)

      await expect(await stkToken.unlockTime(owner.address)).to.equal(block.timestamp + 14 * DAY)
      await expect(Promise.resolve(tx)).to.emit(stkToken, 'Cooldown')
    })

    it('staking more while on unstake period resets cooldown', async () => {
      await stkToken.stake(amount.div(2))
      await stkToken.cooldown()
      await timeTravel(provider, stakeCooldown + DAY)
      const tx = await stkToken.stake(amount.div(2))
      const block = await provider.getBlock(tx.blockNumber)

      await expect(await stkToken.unlockTime(owner.address)).to.equal(block.timestamp + 14 * DAY)
    })

    it('staking on expired cooldown does not reset cooldown', async () => {
      await stkToken.stake(amount.div(2))
      await stkToken.cooldown()
      await timeTravel(provider, stakeCooldown + 2 * DAY + 1)

      await expect(await stkToken.unlockTime(owner.address)).to.equal(MaxUint256)
    })

    it('tokens received during cooldown cannot be unstaked', async () => {
      await stkToken.stake(amount)
      await stkToken.transfer(staker.address, amount.div(2))
      await stkToken.cooldown()
      await stkToken.connect(staker).transfer(owner.address, amount.div(2))
      expect(await stkToken.unstakable(owner.address)).to.equal(amount.div(2))
      await timeTravel(provider, stakeCooldown + 1)
      await expect(stkToken.unstake(amount.div(2).add(1))).to.be.revertedWith('StkTruToken: Insufficient balance')
      await expect(stkToken.unstake(amount.div(2))).to.be.not.reverted
    })

    it('transferring back received tokens does not reduce unstakable amount', async () => {
      await stkToken.stake(amount)
      await stkToken.transfer(staker.address, amount.div(2))
      await stkToken.cooldown()
      await stkToken.connect(staker).transfer(owner.address, amount.div(2))
      await stkToken.transfer(staker.address, amount.div(2))
      expect(await stkToken.unstakable(owner.address)).to.equal(amount.div(2))
    })

    it('calling cooldown again allows to unstake received tokens', async () => {
      await stkToken.stake(amount)
      await stkToken.transfer(staker.address, amount.div(2))
      await stkToken.cooldown()
      await stkToken.connect(staker).transfer(owner.address, amount.div(2))
      await stkToken.cooldown()

      expect(await stkToken.unstakable(owner.address)).to.equal(amount)
    })
  })

  describe('Voting power decreases after liquidation', () => {
    let withdrawBlockNumber: number

    beforeEach(async () => {
      await stkToken.stake(amount)
      ;({ blockNumber: withdrawBlockNumber } = await (await stkToken.connect(liquidator).withdraw(parseTRU(1))).wait())
    })

    it('getCurrentVotes has decreased', async () => {
      expect(await stkToken.getCurrentVotes(owner.address)).to.equal(parseTRU(99))
    })

    it('getCurrentVotes after delegation', async () => {
      await stkToken.delegate(staker.address)
      expect(await stkToken.getCurrentVotes(owner.address)).to.equal(0)
      expect(await stkToken.getCurrentVotes(staker.address)).to.equal(parseTRU(99))
    })

    it('getPriorVotes has decreased', async () => {
      expect(await stkToken.getPriorVotes(owner.address, withdrawBlockNumber - 1)).to.equal(parseTRU(99))
    })
  })

  describe('Transfer', () => {
    const distributionStart = 1700000000

    beforeEach(async () => {
      await distributor.initialize(distributionStart, 10 * DAY, parseTRU(10000), tru.address)
      await tru.mint(distributor.address, parseTRU(10000), { gasLimit: 3000000 })
      await distributor.setFarm(stkToken.address)
      await timeTravelTo(provider, distributionStart)
      await stkToken.stake(amount)
    })

    it('updates claim state on transfer', async () => {
      await timeTravel(provider, DAY)
      await tfusd.mint(stkToken.address, parseEth(1))
      await feeToken.mint(stkToken.address, parseEth(2))

      expectScaledCloseTo(await stkToken.claimable(owner.address, tru.address), parseTRU(1000))
      expect(await stkToken.claimable(owner.address, tfusd.address)).to.equal(parseEth(1))
      expect(await stkToken.claimable(owner.address, feeToken.address)).to.equal(parseEth(2))

      await stkToken.transfer(staker.address, amount.div(2))
      await stkToken.claim()

      expectScaledCloseTo(await tru.balanceOf(owner.address), parseTRU(1000))
      expect(await tfusd.balanceOf(owner.address)).to.equal(parseEth(1))
      expect(await feeToken.balanceOf(owner.address)).to.equal(parseEth(2))

      expectCloseTo(await stkToken.claimable(staker.address, tru.address), parseTRU(0))
      expect(await stkToken.claimable(staker.address, tfusd.address)).to.equal(0)
      expect(await stkToken.claimable(staker.address, feeToken.address)).to.equal(0)
    })

    it('gas cost', async () => {
      const tx = await (await stkToken.transfer(staker.address, amount.div(2), { gasLimit: 300000 })).wait()
      expect(tx.gasUsed).to.be.lt(200000)
    })
  })

  describe('Pay fee', async () => {
    const futureTimestamp = 1700000000

    const getSortedTimestamps = async () => {
      const result = []
      for (let i = 0; ; i++) {
        try {
          const index = await stkToken.sortedScheduledRewardIndices(i)
          result.push((await stkToken.scheduledRewards(index)).timestamp.toNumber())
        } catch (e) {
          break
        }
      }
      return result
    }

    beforeEach(async () => {
      await tfusd.mint(owner.address, MaxUint256.div(2))
      await tfusd.approve(stkToken.address, MaxUint256.div(2))
      await stkToken.setPayerWhitelistingStatus(owner.address, true)
    })

    it('is not possible without whitelisting', async () => {
      await stkToken.setPayerWhitelistingStatus(owner.address, false)
      await expect(stkToken.payFee(1, 100))
        .to.be.revertedWith('StkTruToken: Can be called only by whitelisted payers')
      await stkToken.setPayerWhitelistingStatus(owner.address, true)
      await expect(stkToken.payFee(1, 100))
        .not.to.be.reverted

      await tfusd.mint(staker.address, MaxUint256.div(2))
      await tfusd.connect(staker).approve(stkToken.address, MaxUint256.div(2))
      await expect(stkToken.connect(staker).payFee(1, 100))
        .to.be.revertedWith('StkTruToken: Can be called only by whitelisted payers')
      await stkToken.setPayerWhitelistingStatus(staker.address, true)
      await expect(stkToken.connect(staker).payFee(1, 100))
        .not.to.be.reverted
    })

    it('keeps list sorted', async () => {
      expect(await getSortedTimestamps()).to.deep.equal([])
      await stkToken.payFee(1, 100)
      expect(await getSortedTimestamps()).to.deep.equal([100])
      await stkToken.payFee(1, 200)
      expect(await getSortedTimestamps()).to.deep.equal([100, 200])
      await stkToken.payFee(1, 50)
      expect(await getSortedTimestamps()).to.deep.equal([50, 100, 200])
      await stkToken.payFee(1, 150)
      expect(await getSortedTimestamps()).to.deep.equal([50, 100, 150, 200])
      await stkToken.payFee(1, 25)
      expect(await getSortedTimestamps()).to.deep.equal([25, 50, 100, 150, 200])
      await stkToken.payFee(1, 400)
      expect(await getSortedTimestamps()).to.deep.equal([25, 50, 100, 150, 200, 400])
      await stkToken.payFee(1, 75)
      expect(await getSortedTimestamps()).to.deep.equal([25, 50, 75, 100, 150, 200, 400])
    })

    it('splits fee in half and pays out when time comes', async () => {
      await stkToken.payFee(parseEth(2), futureTimestamp - 100)
      await stkToken.payFee(parseEth(2), futureTimestamp + 100)
      await stkToken.payFee(parseEth(2), futureTimestamp + 200)

      expect(await stkToken.undistributedTfusdRewards()).to.equal(parseEth(3))
      expect(await stkToken.nextDistributionIndex()).to.equal(0)

      // call claim on non-staker to update staking info
      await stkToken.claim()
      expect((await stkToken.farmRewards(tfusd.address)).totalFarmRewards).to.equal(utils.parseUnits('3', 48))

      await timeTravelTo(provider, futureTimestamp)
      await stkToken.claim()

      expect(await stkToken.undistributedTfusdRewards()).to.equal(parseEth(2))
      expect(await stkToken.nextDistributionIndex()).to.equal(1)
      expect((await stkToken.farmRewards(tfusd.address)).totalFarmRewards).to.equal(utils.parseUnits('4', 48))

      await timeTravelTo(provider, futureTimestamp + 300)
      await stkToken.claim()

      expect(await stkToken.undistributedTfusdRewards()).to.equal(0)
      expect(await stkToken.nextDistributionIndex()).to.equal(3)
      expect((await stkToken.farmRewards(tfusd.address)).totalFarmRewards).to.equal(utils.parseUnits('6', 48))
    })

    it('correctly inserts fee with end time in the past', async () => {
      await stkToken.payFee(parseEth(2), futureTimestamp - 100)
      await stkToken.payFee(parseEth(2), futureTimestamp + 100)
      await stkToken.payFee(parseEth(2), futureTimestamp + 200)
      await timeTravelTo(provider, futureTimestamp)
      await stkToken.claim()

      await stkToken.payFee(parseEth(2), futureTimestamp - 300)
      expect(await getSortedTimestamps()).to.deep.equal([-100, -300, 100, 200].map(x => x + futureTimestamp))
    })

    it('correctly inserts fee when all past timestamps passed', async () => {
      await stkToken.payFee(parseEth(2), futureTimestamp - 100)

      await timeTravelTo(provider, futureTimestamp)
      await stkToken.claim()

      await stkToken.payFee(parseEth(2), futureTimestamp + 100)
      expect(await getSortedTimestamps()).to.deep.equal([-100, 100].map(x => x + futureTimestamp))
    })
  })
})
