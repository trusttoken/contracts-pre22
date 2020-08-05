import bytes32 from './helpers/bytes32.js'
import assertRevert from './helpers/assertRevert.js'
import timeMachine from 'ganache-time-traveler'

const Registry = artifacts.require('RegistryMock')
const StakedToken = artifacts.require('StakedToken')
const TrustToken = artifacts.require('MockTrustToken')
const TrueUSD = artifacts.require('TrueUSDMock')
const OwnedUpgradeabilityProxy = artifacts.require('OwnedUpgradeabilityProxy')

const IS_REGISTERED_CONTRACT = bytes32('isRegisteredContract')
const PASSED_KYCAML = bytes32('hasPassedKYC/AML')
const BN = web3.utils.toBN
const ONE_ETHER = BN(1e18)
const ONE_HUNDRED_ETHER = BN(100).mul(ONE_ETHER)
const ONE_BITCOIN = BN(1e8)
const ONE_HUNDRED_BITCOIN = BN(100).mul(ONE_BITCOIN)
const DEFAULT_RATIO = BN(1000)

contract('StakedAsset', function (accounts) {
  const [, owner, issuer, oneHundred, account1, account2, account3, kycAccount, fakeLiquidator] = accounts
  beforeEach(async function () {
    this.registry = await Registry.new({ from: owner })
    this.rewardToken = await TrueUSD.new(owner, 0, { from: issuer })
    this.stakeToken = await TrustToken.new({ from: issuer })
    await this.stakeToken.initialize(this.registry.address, { from: issuer })

    this.poolProxy = await OwnedUpgradeabilityProxy.new({ from: issuer })
    this.poolImplementation = await StakedToken.new({ from: issuer })
    await this.poolProxy.upgradeTo(this.poolImplementation.address, { from: issuer })
    this.pool = await StakedToken.at(this.poolProxy.address)
    await this.pool.configure(this.stakeToken.address, this.rewardToken.address, this.registry.address, fakeLiquidator, { from: issuer })

    await this.rewardToken.setRegistry(this.registry.address, { from: issuer })
    await this.rewardToken.mint(oneHundred, ONE_HUNDRED_ETHER, { from: issuer })
    await this.stakeToken.mint(oneHundred, ONE_HUNDRED_BITCOIN, { from: issuer })
    await this.registry.subscribe(PASSED_KYCAML, this.pool.address, { from: owner })
    await this.registry.setAttributeValue(kycAccount, PASSED_KYCAML, 1, { from: owner })
    await this.registry.subscribe(IS_REGISTERED_CONTRACT, this.stakeToken.address, { from: owner })
    await this.registry.subscribe(IS_REGISTERED_CONTRACT, this.rewardToken.address, { from: owner })
    await this.registry.setAttributeValue(this.pool.address, IS_REGISTERED_CONTRACT, 1, { from: owner })
  })
  describe('Staked Asset', function () {
    it('correctly sets addresses', async function () {
      assert.equal(await this.pool.stakeAsset.call(), this.stakeToken.address)
      assert.equal(await this.pool.rewardAsset.call(), this.rewardToken.address)
      assert.equal(await this.pool.registry.call(), this.registry.address)
      assert.equal(await this.pool.liquidator.call(), fakeLiquidator)
    })

    it('allows deposit', async function () {
      await this.stakeToken.transfer(this.pool.address, ONE_HUNDRED_BITCOIN, { from: oneHundred })
      assert(ONE_HUNDRED_BITCOIN.eq(await this.stakeToken.balanceOf(this.pool.address)), '100 staked tokens')
      assert(await this.pool.balanceOf.call(oneHundred), DEFAULT_RATIO.mul(ONE_HUNDRED_ETHER))
    })
    it('allows liquidator to withdraw and deposit', async function () {
      await this.stakeToken.transfer(this.pool.address, ONE_HUNDRED_BITCOIN, { from: oneHundred })

      await this.stakeToken.transferFrom(this.pool.address, fakeLiquidator, ONE_HUNDRED_BITCOIN, { from: fakeLiquidator })
      assert(ONE_HUNDRED_BITCOIN.eq(await this.stakeToken.balanceOf.call(fakeLiquidator)), '100 withdrawn')

      await this.stakeToken.transfer(this.pool.address, ONE_HUNDRED_BITCOIN, { from: fakeLiquidator })
      assert(ONE_HUNDRED_BITCOIN.eq(await this.stakeToken.balanceOf.call(this.pool.address)), '100 returned')
      assert.equal(0, await this.pool.balanceOf.call(fakeLiquidator), 'liquidator does not get any stake')
    })
    it('awards to stakers, maintains remainder, claims, transfers unclaimed rewards', async function () {
      // oneHundred: 45, account1: 25, account2: 20, kycAccount: 10
      await this.stakeToken.transfer(kycAccount, BN(10).mul(ONE_BITCOIN), { from: oneHundred })
      await this.stakeToken.transfer(account1, BN(25).mul(ONE_BITCOIN), { from: oneHundred })
      await this.stakeToken.transfer(account2, BN(20).mul(ONE_BITCOIN), { from: oneHundred })
      // all stake
      await this.stakeToken.transfer(this.pool.address, BN(45).mul(ONE_BITCOIN), { from: oneHundred })
      await this.stakeToken.transfer(this.pool.address, BN(25).mul(ONE_BITCOIN), { from: account1 })
      await this.stakeToken.transfer(this.pool.address, BN(20).mul(ONE_BITCOIN), { from: account2 })
      await this.stakeToken.transfer(this.pool.address, BN(10).mul(ONE_BITCOIN), { from: kycAccount })

      assert(ONE_HUNDRED_BITCOIN.eq(await this.stakeToken.balanceOf.call(this.pool.address)))
      const oneHundredStake = BN(45).mul(ONE_BITCOIN).mul(DEFAULT_RATIO)
      assert(oneHundredStake.eq(await this.pool.balanceOf.call(oneHundred)))

      await this.rewardToken.approve(this.pool.address, BN(10).mul(ONE_ETHER), { from: oneHundred })
      await this.pool.award(BN(10).mul(ONE_ETHER), { from: oneHundred })
      assert(BN(9).mul(ONE_ETHER).div(BN(2)).eq(await this.pool.unclaimedRewards.call(oneHundred)))
      assert(BN(5).mul(ONE_ETHER).div(BN(2)).eq(await this.pool.unclaimedRewards.call(account1)))
      assert(BN(2).mul(ONE_ETHER).eq(await this.pool.unclaimedRewards.call(account2)))
      assert(ONE_ETHER.eq(await this.pool.unclaimedRewards.call(kycAccount)))

      // no immediate reward
      await this.rewardToken.approve(this.pool.address, BN(10).mul(ONE_BITCOIN), { from: oneHundred })
      await this.pool.award(BN(10).mul(ONE_BITCOIN), { from: oneHundred })
      assert(BN(9).mul(ONE_ETHER).div(BN(2)).eq(await this.pool.unclaimedRewards.call(oneHundred)))
      assert(BN(5).mul(ONE_ETHER).div(BN(2)).eq(await this.pool.unclaimedRewards.call(account1)))
      assert(BN(2).mul(ONE_ETHER).eq(await this.pool.unclaimedRewards.call(account2)))
      assert(ONE_ETHER.eq(await this.pool.unclaimedRewards.call(kycAccount)))

      // remainder accrues
      await this.rewardToken.approve(this.pool.address, BN(10).mul(ONE_ETHER).sub(BN(10).mul(ONE_BITCOIN)), { from: oneHundred })
      await this.pool.award(BN(10).mul(ONE_ETHER).sub(BN(10).mul(ONE_BITCOIN)), { from: oneHundred })
      assert(BN(9).mul(ONE_ETHER).eq(await this.pool.unclaimedRewards.call(oneHundred)))
      assert(BN(5).mul(ONE_ETHER).eq(await this.pool.unclaimedRewards.call(account1)))
      assert(BN(4).mul(ONE_ETHER).eq(await this.pool.unclaimedRewards.call(account2)))
      assert(BN(2).mul(ONE_ETHER).eq(await this.pool.unclaimedRewards.call(kycAccount)))

      // claim reward
      await this.pool.claimRewards(kycAccount, { from: kycAccount })
      assert.equal(0, await this.pool.unclaimedRewards.call(kycAccount))
      assert(BN(2).mul(ONE_ETHER).eq(await this.rewardToken.balanceOf.call(kycAccount)))

      // transfer unclaimed rewards
      await this.pool.transfer(kycAccount, oneHundredStake, { from: oneHundred })
      assert.equal(0, await this.pool.unclaimedRewards.call(oneHundred))
      assert(BN(9).mul(ONE_ETHER).sub(await this.pool.unclaimedRewards.call(kycAccount)).lt(await this.pool.totalSupply.call()))

      await this.pool.claimRewards(kycAccount, { from: kycAccount })
      assert.equal(0, await this.pool.unclaimedRewards.call(kycAccount))
      assert(BN(11).mul(ONE_ETHER).sub(await this.rewardToken.balanceOf.call(kycAccount)).lt(await this.pool.totalSupply.call()))
    })

    it('preserves unclaimed rewards during additional staking and transfer to empty account', async function () {
      // stake half
      await this.stakeToken.transfer(this.pool.address, BN(50).mul(ONE_BITCOIN), { from: oneHundred })

      assert(DEFAULT_RATIO.mul(BN(50).mul(ONE_BITCOIN)).eq(await this.pool.balanceOf.call(oneHundred)), 'pool balance')

      // reward 1 TUSD
      await this.rewardToken.approve(this.pool.address, ONE_ETHER, { from: oneHundred })
      await this.pool.award(ONE_ETHER, { from: oneHundred })
      assert(ONE_ETHER.eq(await this.pool.unclaimedRewards.call(oneHundred)))
      assert(ONE_ETHER.eq(await this.rewardToken.balanceOf.call(this.pool.address)))

      // stake other half
      await this.stakeToken.transfer(this.pool.address, BN(50).mul(ONE_BITCOIN), { from: oneHundred })
      assert(DEFAULT_RATIO.mul(ONE_HUNDRED_BITCOIN).eq(await this.pool.balanceOf.call(oneHundred)), 'pool balance')
      assert(ONE_ETHER.eq(await this.pool.unclaimedRewards.call(oneHundred)))
      assert(ONE_ETHER.eq(await this.rewardToken.balanceOf.call(this.pool.address)))
      assert(ONE_HUNDRED_BITCOIN.eq(await this.stakeToken.balanceOf.call(this.pool.address)))

      // transferFrom to kycAccount
      await this.pool.approve(account2, DEFAULT_RATIO.mul(ONE_HUNDRED_BITCOIN), { from: oneHundred })
      await this.pool.transferFrom(oneHundred, kycAccount, DEFAULT_RATIO.mul(ONE_HUNDRED_BITCOIN), { from: account2 })
      assert(DEFAULT_RATIO.mul(ONE_HUNDRED_BITCOIN).eq(await this.pool.balanceOf.call(kycAccount)), 'pool balance')
      assert(ONE_ETHER.eq(await this.pool.unclaimedRewards.call(kycAccount)), 'unclaimed rewards transfer')
      assert.equal(0, await this.pool.unclaimedRewards.call(oneHundred))

      // claim
      await this.pool.claimRewards(account1, { from: kycAccount })
      assert.equal(0, await this.pool.unclaimedRewards.call(account1))
      assert.equal(0, await this.pool.unclaimedRewards.call(oneHundred))
      assert.equal(0, await this.pool.unclaimedRewards.call(kycAccount))
      assert.equal(0, await this.rewardToken.balanceOf.call(this.pool.address))
      assert(ONE_ETHER.eq(await this.rewardToken.balanceOf.call(account1)))
    })
    describe('initUnstake all', function () {
      beforeEach(async function () {
        await this.stakeToken.transfer(account1, BN(10).mul(ONE_BITCOIN), { from: oneHundred })
        await this.stakeToken.transfer(this.pool.address, BN(10).mul(ONE_BITCOIN), { from: account1 })
        await this.stakeToken.transfer(this.pool.address, BN(10).mul(ONE_BITCOIN), { from: oneHundred })
        const init = await this.pool.initUnstake(DEFAULT_RATIO.mul(BN(10).mul(ONE_BITCOIN)), { from: oneHundred })
        this.timestamp = init.logs[2].args.timestamp
      })
      it('prevents finalizing unstake', async function () {
        await assertRevert(this.pool.finalizeUnstake(account2, [this.timestamp], { from: oneHundred }))
      })
      it('award not distributed to pending withdrawals', async function () {
        await this.rewardToken.approve(this.pool.address, ONE_HUNDRED_ETHER, { from: oneHundred })
        await this.pool.award(ONE_HUNDRED_ETHER, { from: oneHundred })
        assert((await this.pool.unclaimedRewards(account1)).eq(ONE_HUNDRED_ETHER))
        assert.equal(0, await this.pool.unclaimedRewards(oneHundred))
      })
      it('pending withdrawals considered for calculating stake per deposit', async function () {
        await this.stakeToken.transfer(this.pool.address, BN(10).mul(ONE_BITCOIN), { from: oneHundred })
        assert((await this.pool.balanceOf(account1)).eq(await this.pool.balanceOf(oneHundred)))
      })
      describe('after unstake period', function () {
        beforeEach(async function () {
          // fast forward 2 weeks
          await timeMachine.advanceTime(14 * 24 * 60 * 60)
        })
        it('finalizes unstake', async function () {
          await this.pool.finalizeUnstake(account2, [this.timestamp], { from: oneHundred })
          assert(BN(10).mul(ONE_BITCOIN).eq(await this.stakeToken.balanceOf(account2)))
        })
        it('pending withdrawals due-stake is slashed by liquidator', async function () {
          assert(BN(20).mul(ONE_BITCOIN).eq(await this.stakeToken.balanceOf(this.pool.address)))
          await this.stakeToken.transferFrom(this.pool.address, account3, BN(10).mul(ONE_BITCOIN), { from: fakeLiquidator })
          await this.pool.finalizeUnstake(account2, [this.timestamp], { from: oneHundred })
          assert(BN(5).mul(ONE_BITCOIN).eq(await this.stakeToken.balanceOf(account2)))
        })
      })
    })
    describe('initUnstake half with unclaimed rewards', function () {
      beforeEach(async function () {
        await this.stakeToken.transfer(account1, BN(20).mul(ONE_BITCOIN), { from: oneHundred })
        await this.stakeToken.transfer(this.pool.address, BN(20).mul(ONE_BITCOIN), { from: account1 })
        await this.stakeToken.transfer(this.pool.address, BN(10).mul(ONE_BITCOIN), { from: oneHundred })
        await this.rewardToken.approve(this.pool.address, BN(50).mul(ONE_ETHER), { from: oneHundred })
        await this.pool.award(BN(50).mul(ONE_ETHER), { from: oneHundred })
        const init = await this.pool.initUnstake(DEFAULT_RATIO.mul(BN(5).mul(ONE_BITCOIN)), { from: oneHundred })
        this.timestamp = init.logs[2].args.timestamp
      })
      it('prevents finalizing unstake', async function () {
        await assertRevert(this.pool.finalizeUnstake(account2, [this.timestamp], { from: oneHundred }))
      })
      it('unclaimed reward awarded to remaining stakers', async function () {
        await this.rewardToken.approve(this.pool.address, BN(50).mul(ONE_ETHER), { from: oneHundred })
        await this.pool.award(BN(50).mul(ONE_ETHER), { from: oneHundred })
        assert((await this.pool.unclaimedRewards(account1)).eq(BN(80).mul(ONE_ETHER)))
        assert((await this.pool.unclaimedRewards(oneHundred)).eq(BN(20).mul(ONE_ETHER)))
      })
      it('pending withdrawals considered for calculating stake per deposit', async function () {
        await this.stakeToken.transfer(this.pool.address, BN(15).mul(ONE_BITCOIN), { from: oneHundred })
        assert((await this.pool.balanceOf(account1)).eq(await this.pool.balanceOf(oneHundred)))
      })
      describe('after unstake period', function () {
        beforeEach(async function () {
          // fast forward 2 weeks
          await timeMachine.advanceTime(14 * 24 * 60 * 60)
        })
        it('finalizes unstake', async function () {
          await this.pool.finalizeUnstake(account2, [this.timestamp], { from: oneHundred })
          assert(BN(5).mul(ONE_BITCOIN).eq(await this.stakeToken.balanceOf(account2)))
        })
        it('pending withdrawals due-stake is slashed by liquidator', async function () {
          assert(BN(30).mul(ONE_BITCOIN).eq(await this.stakeToken.balanceOf(this.pool.address)))
          await this.stakeToken.transferFrom(this.pool.address, account3, BN(6).mul(ONE_BITCOIN), { from: fakeLiquidator })
          await this.pool.finalizeUnstake(account2, [this.timestamp], { from: oneHundred })
          assert(BN(4).mul(ONE_BITCOIN).eq(await this.stakeToken.balanceOf(account2)))
        })
      })
    })
    describe('initUnstake third with claimed and unclaimed rewards', function () {
      beforeEach(async function () {
        await this.registry.setAttributeValue(oneHundred, PASSED_KYCAML, 1, { from: owner })
        await this.stakeToken.transfer(account1, BN(25).mul(ONE_BITCOIN), { from: oneHundred })
        // 25, 25
        await this.stakeToken.transfer(this.pool.address, BN(25).mul(ONE_BITCOIN), { from: account1 })
        await this.stakeToken.transfer(this.pool.address, BN(25).mul(ONE_BITCOIN), { from: oneHundred })
        // 40 rewards distributed 20, 20 among 25, 25
        await this.rewardToken.approve(this.pool.address, BN(40).mul(ONE_ETHER), { from: oneHundred })
        await this.pool.award(BN(40).mul(ONE_ETHER), { from: oneHundred })

        // 40 rewards distributed 25, 15 among 25, 15
        const init1 = await this.pool.initUnstake(DEFAULT_RATIO.mul(BN(10).mul(ONE_BITCOIN)), { from: oneHundred })
        this.timestamp1 = init1.logs[2].args.timestamp
        await timeMachine.advanceTime(15)
        // 25 rewards distributed 25, 0 among 25, 15
        await this.pool.claimRewards(fakeLiquidator, { from: oneHundred })
        // add 16 rewards distributed 10, 6 among 25, 15
        // total 41 rewards distributed 35, 6 among 25, 15
        await this.rewardToken.approve(this.pool.address, BN(16).mul(ONE_ETHER), { from: oneHundred })
        await this.pool.award(BN(16).mul(ONE_ETHER), { from: oneHundred })
        // now 41 rewards distributed 35, 6 among 25, 10
        const init2 = await this.pool.initUnstake(DEFAULT_RATIO.mul(BN(5).mul(ONE_BITCOIN)), { from: oneHundred })
        this.timestamp2 = init2.logs[2].args.timestamp
      })
      it('prevents finalizing unstake', async function () {
        await assertRevert(this.pool.finalizeUnstake(account2, [this.timestamp1, this.timestamp2], { from: oneHundred }))
      })
      it('unclaimed reward awarded to remaining stakers', async function () {
        assert((await this.pool.unclaimedRewards(account1)).eq(BN(35).mul(ONE_ETHER)))
        assert((await this.pool.unclaimedRewards(oneHundred)).eq(BN(6).mul(ONE_ETHER)))
        // now 76 rewards distributed 60, 16 among 25, 10
        await this.rewardToken.approve(this.pool.address, BN(35).mul(ONE_ETHER), { from: oneHundred })
        await this.pool.award(BN(35).mul(ONE_ETHER), { from: oneHundred })
        assert((await this.pool.unclaimedRewards(account1)).eq(BN(60).mul(ONE_ETHER)))
        assert((await this.pool.unclaimedRewards(oneHundred)).eq(BN(16).mul(ONE_ETHER)))
      })
      it('pending withdrawals considered for calculating stake per deposit', async function () {
        await this.stakeToken.transfer(this.pool.address, BN(15).mul(ONE_BITCOIN), { from: oneHundred })
        assert((await this.pool.balanceOf(account1)).eq(await this.pool.balanceOf(oneHundred)))
      })
      describe('after unstake period', function () {
        beforeEach(async function () {
          // fast forward 2 weeks
          await timeMachine.advanceTime(14 * 24 * 60 * 60)
        })
        it('finalizes unstake', async function () {
          await this.pool.finalizeUnstake(account2, [this.timestamp1, this.timestamp2], { from: oneHundred })
          assert(BN(15).mul(ONE_BITCOIN).eq(await this.stakeToken.balanceOf(account2)))
        })
        it('pending withdrawals due-stake is slashed by liquidator', async function () {
          assert(BN(50).mul(ONE_BITCOIN).eq(await this.stakeToken.balanceOf(this.pool.address)))
          await this.stakeToken.transferFrom(this.pool.address, account3, BN(40).mul(ONE_BITCOIN), { from: fakeLiquidator })
          await this.pool.finalizeUnstake(account2, [this.timestamp1, this.timestamp2], { from: oneHundred })
          assert(BN(3).mul(ONE_BITCOIN).eq(await this.stakeToken.balanceOf(account2)))
        })
      })
    })
    describe('erc20', function () {
      it('name', async function () {
        assert.equal('TrustToken staked for TrueUSD', await this.pool.name.call())
      })
      it('symbol', async function () {
        assert.equal('TRU:TUSD', await this.pool.symbol.call())
      })
      it('decimals', async function () {
        assert.equal(11, await this.pool.decimals.call())
      })
    })
  })
})
