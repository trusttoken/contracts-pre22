import { expect, use } from 'chai'
import { BigNumber, BigNumberish, Wallet } from 'ethers'
import { deployMockContract, solidity } from 'ethereum-waffle'

import {
  beforeEachWithFixture,
  parseTRU,
  timeTravel as _timeTravel,
  expectScaledCloseTo,
  expectBalanceChangeCloseTo,
  extractLegacyLoanToken,
  parseEth,
  parseUSDC,
  DAY,
  setupTruefi2,
} from 'utils'

import {
  TrueRatingAgencyV2,
  TrueRatingAgencyV2__factory,
  MockTrueCurrency,
  StkTruToken,
  ArbitraryDistributor,
  MockUsdc,
  TrueFiPool2,
  TestLoanFactory,
  TestLoanFactory__factory,
  TestTrueLender,
  TestTrueLender__factory,
  TrueFiCreditOracle,
  TestTrueRatingAgencyV2__factory,
  TestLegacyLoanToken2__factory,
  TestLegacyLoanToken2,
} from 'contracts'

import {
  ArbitraryDistributorJson,
} from 'build'
import { setupDeploy } from 'scripts/utils'

use(solidity)

describe('TrueRatingAgencyV2', () => {
  let owner: Wallet
  let otherWallet: Wallet

  let rater: TrueRatingAgencyV2
  let trustToken: MockTrueCurrency
  let stakedTrustToken: StkTruToken
  let arbitraryDistributor: ArbitraryDistributor
  let creditOracle: TrueFiCreditOracle

  let tusd: MockTrueCurrency
  let usdc: MockUsdc

  let lender: TestTrueLender
  let loanToken: TestLegacyLoanToken2
  let loanFactory: TestLoanFactory
  let tusdPool: TrueFiPool2
  let usdcPool: TrueFiPool2

  const stake = parseTRU(15e6)

  const dayInSeconds = 60 * 60 * 24
  const yearInSeconds = dayInSeconds * 365
  const averageMonthInSeconds = yearInSeconds / 12

  const txArgs = {
    gasLimit: 6_000_000,
  }

  let timeTravel: (time: number) => Promise<void>

  beforeEachWithFixture(async (_wallets, _provider) => {
    [owner, otherWallet] = _wallets
    timeTravel = (time: number) => _timeTravel(_provider, time)
    const deployContract = setupDeploy(owner)
    rater = await deployContract(TestTrueRatingAgencyV2__factory)

    lender = await new TestTrueLender__factory(owner).deploy()
    loanFactory = await new TestLoanFactory__factory(owner).deploy()

    ; ({
      tru: trustToken,
      stkTru: stakedTrustToken,
      arbitraryDistributor,
      feeToken: usdc,
      standardToken: tusd,
      lender,
      loanFactory,
      feePool: usdcPool,
      standardPool: tusdPool,
      creditOracle,
    } = await setupTruefi2(owner, _provider, { lender: lender, loanFactory: loanFactory, rater: rater }))

    const legacyLtImpl = await deployContract(TestLegacyLoanToken2__factory)
    await loanFactory.setLoanTokenImplementation(legacyLtImpl.address)

    await rater.setRatersRewardFactor(10000)

    const tx = await loanFactory.createLegacyLoanToken(tusdPool.address, owner.address, 5_000_000, yearInSeconds * 2, 1000)
    loanToken = await extractLegacyLoanToken(tx, owner)
    await loanToken.setLender(lender.address)

    await tusd.approve(loanToken.address, 5_000_000)

    await tusd.mint(owner.address, parseEth(1e7))

    await trustToken.mint(owner.address, stake.mul(2))
    await trustToken.mint(arbitraryDistributor.address, stake)
    await trustToken.approve(stakedTrustToken.address, stake.mul(2))

    await stakedTrustToken.delegate(owner.address)
    await stakedTrustToken.connect(otherWallet).delegate(otherWallet.address)
    await stakedTrustToken.stake(stake)

    await tusd.mint(tusdPool.address, parseEth(1e8))
    await usdc.mint(usdcPool.address, parseUSDC(1e7))

    await creditOracle.setScore(owner.address, 255)
    await creditOracle.setMaxBorrowerLimit(owner.address, parseEth(100_000_000))

    await tusd.mint(lender.address, parseEth(1e7))
    await usdc.mint(lender.address, parseUSDC(1e7))
  })

  describe('Initializer', () => {
    it('sets trust token address', async () => {
      expect(await rater.TRU()).to.equal(trustToken.address)
    })

    it('checks distributor beneficiary address', async () => {
      const mockDistributor = await deployMockContract(owner, ArbitraryDistributorJson.abi)
      await mockDistributor.mock.beneficiary.returns(owner.address)
      const newRater = await new TrueRatingAgencyV2__factory(owner).deploy()
      await expect(newRater.initialize(trustToken.address, stakedTrustToken.address, mockDistributor.address)).to.be.revertedWith('TrueRatingAgencyV2: Invalid distributor beneficiary')
    })
  })

  describe('Parameters set up', () => {
    describe('setRatersRewardFactor', () => {
      it('changes ratersRewardFactor', async () => {
        await rater.setRatersRewardFactor(1234)
        expect(await rater.ratersRewardFactor())
          .to.equal(1234)
      })

      it('emits LossFactorChanged', async () => {
        await expect(rater.setRatersRewardFactor(1234))
          .to.emit(rater, 'RatersRewardFactorChanged').withArgs(1234)
      })

      it('must be called by owner', async () => {
        await expect(rater.connect(otherWallet).setRatersRewardFactor(1234))
          .to.be.revertedWith('caller is not the owner')
      })

      it('must be less than or equal 100%', async () => {
        await expect(rater.setRatersRewardFactor(100 * 101))
          .to.be.revertedWith('TrueRatingAgencyV2: Raters reward factor cannot be greater than 100%')
      })
    })

    describe('setRewardMultiplier', () => {
      it('changes rewardMultiplier', async () => {
        await rater.setRewardMultiplier(1234)
        expect(await rater.rewardMultiplier())
          .to.equal(1234)
      })

      it('emits RewardMultiplierChanged', async () => {
        await expect(rater.setRewardMultiplier(1234))
          .to.emit(rater, 'RewardMultiplierChanged').withArgs(1234)
      })

      it('must be called by owner', async () => {
        await expect(rater.connect(otherWallet).setRewardMultiplier(1234))
          .to.be.revertedWith('Ownable: caller is not the owner')
      })
    })
  })

  describe('Claim', () => {
    const rewardMultiplier = 1
    beforeEach(async () => {
      const tx = await loanFactory.createLegacyLoanToken(tusdPool.address, owner.address, parseEth(5e6), yearInSeconds * 2, 100)
      loanToken = await extractLegacyLoanToken(tx, owner)
      await loanToken.setLender(lender.address)

      await trustToken.mint(otherWallet.address, parseTRU(15e7))
      await trustToken.connect(otherWallet).approve(stakedTrustToken.address, parseTRU(15e7))
      await stakedTrustToken.connect(otherWallet).stake(parseTRU(15e7))
      await timeTravel(1)

      await rater.setRewardMultiplier(rewardMultiplier)
      await tusd.approve(loanToken.address, parseEth(5e6))
      await rater.submit(loanToken.address)
    })

    const expectRoughTrustTokenBalanceChangeAfterClaim = async (expectedChange: BigNumberish, wallet: Wallet = owner) => {
      const balanceBefore = await trustToken.balanceOf(wallet.address)
      await rater.claim(loanToken.address, wallet.address, txArgs)
      const balanceAfter = await trustToken.balanceOf(wallet.address)
      expectScaledCloseTo(balanceAfter.sub(balanceBefore), BigNumber.from(expectedChange))
    }

    it('can only be called after loan is funded', async () => {
      await rater.yes(loanToken.address, stake.mul(2))
      await expect(rater.claim(loanToken.address, owner.address))
        .to.be.revertedWith('TrueRatingAgencyV2: Loan was not funded')
    })

    it('when called for the first time, moves funds from distributor to rater and then are distributed to caller', async () => {
      await rater.yes(loanToken.address, stake.mul(2))
      await timeTravel(7 * DAY + 1)
      await lender.fund(loanToken.address)
      const balanceBefore = await trustToken.balanceOf(owner.address)
      await rater.claim(loanToken.address, owner.address, txArgs)
      const balanceAfter = await trustToken.balanceOf(owner.address)
      expectScaledCloseTo(balanceAfter.sub(balanceBefore), parseTRU(1e5))
    })

    it('when called for the first time, moves funds from distributor to rater (different reward multiplier)', async () => {
      await rater.setRewardMultiplier(50)
      await rater.yes(loanToken.address, stake.mul(2))
      await timeTravel(7 * DAY + 1)
      await lender.fund(loanToken.address)

      const balanceBefore = await trustToken.balanceOf(owner.address)
      await rater.claim(loanToken.address, owner.address, txArgs)
      const balanceAfter = await trustToken.balanceOf(owner.address)
      expectScaledCloseTo(balanceAfter.sub(balanceBefore), parseTRU(5e6))
    })

    it('when called for the second time, does not interact with distributor anymore', async () => {
      await rater.yes(loanToken.address, stake.mul(2))
      await timeTravel(7 * DAY + 1)
      await lender.fund(loanToken.address)

      await rater.claim(loanToken.address, owner.address, txArgs)
      await expectBalanceChangeCloseTo(() => rater.claim(loanToken.address, owner.address, txArgs), trustToken, rater, 0)
    })

    it('emits event', async () => {
      await rater.yes(loanToken.address, stake.mul(2))
      await timeTravel(7 * DAY + 1)
      await lender.fund(loanToken.address)

      await expect(rater.claim(loanToken.address, owner.address, txArgs))
        .to.emit(rater, 'Claimed')
        .withArgs(loanToken.address, owner.address, parseTRU(100000))
    })

    it('works when ratersRewardFactor is 0', async () => {
      await rater.setRatersRewardFactor(0)

      await rater.yes(loanToken.address, stake.mul(2))
      await timeTravel(7 * DAY + 1)
      await lender.fund(loanToken.address)

      const balanceBefore = await trustToken.balanceOf(arbitraryDistributor.address)
      await rater.claim(loanToken.address, owner.address, txArgs)
      const balanceAfter = await trustToken.balanceOf(arbitraryDistributor.address)
      expectScaledCloseTo(balanceBefore.sub(balanceAfter), parseTRU(1e5))
    })

    describe('with different ratersRewardFactor value', () => {
      beforeEach(async () => {
        await rater.setRatersRewardFactor(4000)
      })

      it('moves proper amount of funds from distributor', async () => {
        await rater.yes(loanToken.address, stake.mul(2))
        await timeTravel(7 * DAY + 1)
        await lender.fund(loanToken.address)

        const balanceBefore = await trustToken.balanceOf(arbitraryDistributor.address)
        await rater.claim(loanToken.address, owner.address, txArgs)
        const balanceAfter = await trustToken.balanceOf(arbitraryDistributor.address)
        expectScaledCloseTo(balanceBefore.sub(balanceAfter), parseTRU(1e5))
      })

      it('moves proper amount of funds from to staking contract', async () => {
        await rater.yes(loanToken.address, stake.mul(2))
        await timeTravel(7 * DAY + 1)
        await lender.fund(loanToken.address)

        const balanceBefore = await trustToken.balanceOf(stakedTrustToken.address)
        await rater.claim(loanToken.address, owner.address, txArgs)
        const balanceAfter = await trustToken.balanceOf(stakedTrustToken.address)
        expectScaledCloseTo(balanceAfter.sub(balanceBefore), parseTRU(6e4))
      })

      it('less funds are available for direct claiming', async () => {
        await rater.yes(loanToken.address, stake.mul(2))
        await timeTravel(7 * DAY + 1)
        await lender.fund(loanToken.address)

        const balanceBefore = await trustToken.balanceOf(owner.address)
        await rater.claim(loanToken.address, owner.address, txArgs)
        const balanceAfter = await trustToken.balanceOf(owner.address)
        expectScaledCloseTo(balanceAfter.sub(balanceBefore), parseTRU(4e4))
      })
    })

    describe('Running', () => {
      const newRewardMultiplier = 50

      beforeEach(async () => {
        await rater.setRewardMultiplier(newRewardMultiplier)
      })

      it('properly saves claimed amount and moves funds (1 rater)', async () => {
        await rater.yes(loanToken.address, stake.mul(2))
        await timeTravel(7 * DAY + 1)
        await lender.fund(loanToken.address)

        const expectedReward = parseTRU(100000).mul(newRewardMultiplier)
        await expectRoughTrustTokenBalanceChangeAfterClaim(expectedReward)
      })

      it('properly saves claimed amount and moves funds (multiple raters)', async () => {
        const totalReward = parseTRU(100000).mul(newRewardMultiplier)
        await rater.yes(loanToken.address, stake.mul(2))

        await rater.connect(otherWallet).yes(loanToken.address, stake.mul(20))
        await timeTravel(7 * DAY + 1)
        await lender.fund(loanToken.address)

        await expectRoughTrustTokenBalanceChangeAfterClaim(totalReward.div(11), owner)
        await expectRoughTrustTokenBalanceChangeAfterClaim(totalReward.mul(10).div(11), otherWallet)
      })

      it('works after distribution ended', async () => {
        await rater.yes(loanToken.address, stake.mul(2))

        await stakedTrustToken.connect(otherWallet).approve(rater.address, 3000)
        await rater.connect(otherWallet).yes(loanToken.address, stake.mul(20))
        await timeTravel(7 * DAY + 1)
        await lender.fund(loanToken.address)

        await arbitraryDistributor.empty()
        await expectRoughTrustTokenBalanceChangeAfterClaim('0', owner)
      })
    })

    describe('Closed', () => {
      beforeEach(async () => {
        await rater.yes(loanToken.address, stake.mul(2))
      })

      it('properly saves claimed amount and moves funds (multiple raters, called multiple times)', async () => {
        await rater.connect(otherWallet).yes(loanToken.address, stake.mul(20))
        await timeTravel(7 * DAY + 1)
        await lender.fund(loanToken.address)

        await timeTravel(yearInSeconds)

        await expectRoughTrustTokenBalanceChangeAfterClaim(parseTRU(1e5).div(11), owner)
        await timeTravel(averageMonthInSeconds * 30)
        await loanToken.enterDefault()
        await expectRoughTrustTokenBalanceChangeAfterClaim(parseTRU(0), owner)
        await expectRoughTrustTokenBalanceChangeAfterClaim(parseTRU(1e5).mul(10).div(11), otherWallet)
      })

      it('does not do anything when called multiple times', async () => {
        await rater.yes(loanToken.address, stake.mul(2))
        await timeTravel(7 * DAY + 1)
        await lender.fund(loanToken.address)
        await timeTravel(yearInSeconds * 2 + 3 * dayInSeconds)
        await loanToken.enterDefault()

        await expectRoughTrustTokenBalanceChangeAfterClaim(parseTRU(1e5), owner)
        await expectRoughTrustTokenBalanceChangeAfterClaim(0, owner)
      })
    })
  })
})
