import { expect } from 'chai'
import { BigNumber, BigNumberish, Wallet } from 'ethers'
import { MockContract, deployMockContract } from 'ethereum-waffle'
import { AddressZero } from '@ethersproject/constants'

import {
  beforeEachWithFixture,
  parseTRU,
  timeTravel as _timeTravel,
  expectScaledCloseTo,
  expectBalanceChangeCloseTo,
  parseEth,
} from 'utils'

import { TrueRatingAgencyV2Factory, TrueRatingAgencyV2,
  TrustTokenFactory,
  TrustToken,
  LoanTokenFactory,
  LoanToken,
  MockTrueCurrencyFactory,
  MockTrueCurrency,
  ArbitraryDistributorFactory,
  ArbitraryDistributor,
  ILoanFactoryJson,
  ArbitraryDistributorJson,
} from 'contracts'

describe('TrueRatingAgencyV2', () => {
  let owner: Wallet
  let otherWallet: Wallet

  let rater:TrueRatingAgencyV2
  let trustToken: TrustToken
  let stakedTrustToken: TrustToken
  let loanToken: LoanToken
  let distributor: ArbitraryDistributor
  let tusd: MockTrueCurrency
  let mockFactory: MockContract

  const fakeLoanTokenAddress = '0x156b86b8983CC7865076B179804ACC277a1E78C4'
  const stake = parseTRU(1e7)

  const dayInSeconds = 60 * 60 * 24
  const yearInSeconds = dayInSeconds * 365
  const averageMonthInSeconds = yearInSeconds / 12

  const txArgs = {
    gasLimit: 6_000_000,
  }

  let timeTravel: (time: number) => void

  beforeEachWithFixture(async (_wallets, _provider) => {
    [owner, otherWallet] = _wallets

    trustToken = await new TrustTokenFactory(owner).deploy()
    await trustToken.initialize()
    stakedTrustToken = await new TrustTokenFactory(owner).deploy()
    await stakedTrustToken.initialize()
    tusd = await new MockTrueCurrencyFactory(owner).deploy()
    await tusd.mint(owner.address, parseEth(1e7))

    loanToken = await new LoanTokenFactory(owner).deploy(
      tusd.address,
      owner.address,
      owner.address,
      AddressZero,
      5_000_000,
      yearInSeconds * 2,
      1000,
    )
    await tusd.approve(loanToken.address, 5_000_000)

    distributor = await new ArbitraryDistributorFactory(owner).deploy()
    mockFactory = await deployMockContract(owner, ILoanFactoryJson.abi)
    rater = await new TrueRatingAgencyV2Factory(owner).deploy()

    await mockFactory.mock.isLoanToken.returns(true)
    await distributor.initialize(rater.address, trustToken.address, stake)
    await rater.initialize(trustToken.address, stakedTrustToken.address, distributor.address, mockFactory.address)
    await rater.setRatersRewardFactor(10000)

    await stakedTrustToken.mint(owner.address, stake)

    await trustToken.mint(owner.address, stake)
    await trustToken.mint(distributor.address, stake)

    timeTravel = (time: number) => _timeTravel(_provider, time)
  })

  const submit = async (loanTokenAddress: string, wallet = owner) =>
    rater.connect(wallet).submit(loanTokenAddress, { gasLimit: 4_000_000 })

  describe('Initializer', () => {
    it('sets trust token address', async () => {
      expect(await rater.TRU()).to.equal(trustToken.address)
    })

    it('checks distributor beneficiary address', async () => {
      const mockDistributor = await deployMockContract(owner, ArbitraryDistributorJson.abi)
      await mockDistributor.mock.beneficiary.returns(owner.address)
      const newRater = await new TrueRatingAgencyV2Factory(owner).deploy()
      await expect(newRater.initialize(trustToken.address, stakedTrustToken.address, mockDistributor.address, mockFactory.address)).to.be.revertedWith('TrueRatingAgencyV2: Invalid distributor beneficiary')
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
          .to.be.revertedWith('caller is not the owner')
      })
    })
  })

  describe('Whitelisting', () => {
    it('changes whitelist status', async () => {
      expect(await rater.allowedSubmitters(otherWallet.address)).to.be.false
      await rater.allow(otherWallet.address, true)
      expect(await rater.allowedSubmitters(otherWallet.address)).to.be.true
      await rater.allow(otherWallet.address, false)
      expect(await rater.allowedSubmitters(otherWallet.address)).to.be.false
    })

    it('emits event', async () => {
      await expect(rater.allow(otherWallet.address, true))
        .to.emit(rater, 'Allowed').withArgs(otherWallet.address, true)
      await expect(rater.allow(otherWallet.address, false))
        .to.emit(rater, 'Allowed').withArgs(otherWallet.address, false)
    })

    it('reverts when performed by non-owner', async () => {
      await expect(rater.connect(otherWallet).allow(otherWallet.address, true))
        .to.be.revertedWith('caller is not the owner')
    })
  })

  describe('Submitting/Retracting loan', () => {
    beforeEach(async () => {
      await rater.allow(owner.address, true)
    })

    it('reverts when creator is not whitelisted', async () => {
      await expect(submit(loanToken.address, otherWallet))
        .to.be.revertedWith('TrueRatingAgencyV2: Sender is not allowed to submit')
    })

    it('reverts when creator is not a borrower', async () => {
      await rater.allow(otherWallet.address, true)
      await expect(submit(loanToken.address, otherWallet))
        .to.be.revertedWith('TrueRatingAgencyV2: Sender is not borrower')
    })

    it('reverts when submissions are paused', async () => {
      await rater.pauseSubmissions(true)
      await expect(submit(loanToken.address, owner))
        .to.be.revertedWith('TrueRatingAgencyV2: New submissions are paused')
      await rater.pauseSubmissions(false)
      await expect(submit(loanToken.address, owner))
        .not.to.be.reverted
    })

    it('creates loan', async () => {
      await submit(loanToken.address)

      const loan = await rater.loans(loanToken.address)
      expect(loan.timestamp).to.be.gt(0)
      expect(loan.reward).to.be.equal(0)
      expect(loan.creator).to.equal(owner.address)
      expect(await rater.claimable(loanToken.address, owner.address)).to.equal(0)
      expect(await rater.getTotalYesVotes(loanToken.address)).to.be.equal(0)
      expect(await rater.getTotalNoVotes(loanToken.address)).to.be.equal(0)
    })

    it('emits event on creation', async () => {
      await expect(submit(loanToken.address))
        .to.emit(rater, 'LoanSubmitted').withArgs(loanToken.address)
    })

    it('emits event on removal', async () => {
      await submit(loanToken.address)

      await expect(rater.retract(loanToken.address))
        .to.emit(rater, 'LoanRetracted').withArgs(loanToken.address)
    })

    it('loan can be removed by borrower', async () => {
      await submit(loanToken.address)
      await rater.retract(loanToken.address)

      const loan = await rater.loans(loanToken.address)
      expect(loan.timestamp).to.gt(0)
      expect(loan.creator).to.equal(AddressZero)
      expect(await rater.getTotalYesVotes(loanToken.address)).to.be.equal(0)
      expect(await rater.getTotalNoVotes(loanToken.address)).to.be.equal(0)
    })

    it('retracting does not remove information about votes', async () => {
      await submit(loanToken.address)
      await rater.yes(loanToken.address)
      await rater.retract(loanToken.address)
      expect(await rater.getYesVote(loanToken.address, owner.address)).to.be.equal(stake)
    })

    it('if loan is retracted, stakers total vote-based prediction is lost', async () => {
      await submit(loanToken.address)
      await rater.yes(loanToken.address)
      await rater.retract(loanToken.address)
      expect(await rater.getTotalYesVotes(loanToken.address)).to.be.equal(0)
      expect(await rater.getTotalNoVotes(loanToken.address)).to.be.equal(0)
    })

    it('reverts if token was not created with LoanFactory', async () => {
      await mockFactory.mock.isLoanToken.returns(false)
      await expect(submit(loanToken.address)).to.be.revertedWith('TrueRatingAgencyV2: Only LoanTokens created via LoanFactory are supported')
    })

    it('reverts on attempt of creating the same loan twice', async () => {
      await submit(loanToken.address)
      await expect(submit(loanToken.address))
        .to.be.revertedWith('TrueRatingAgencyV2: Loan was already created')
    })

    it('does not allow to resubmit retracted loan', async () => {
      await submit(loanToken.address)
      await rater.retract(loanToken.address)
      await expect(submit(loanToken.address))
        .to.be.revertedWith('TrueRatingAgencyV2: Loan was already created')
    })

    it('retracting is only possible until loan is funded (only pending phase)', async () => {
      await loanToken.fund()
      await expect(rater.retract(loanToken.address))
        .to.be.revertedWith('TrueRatingAgencyV2: Loan is not currently pending')
    })

    it('throws when removing not pending loan', async () => {
      await expect(rater.retract(loanToken.address))
        .to.be.revertedWith('TrueRatingAgencyV2: Loan is not currently pending')
    })

    it('cannot remove loan created by someone else', async () => {
      await rater.allow(otherWallet.address, true)
      await submit(loanToken.address)

      await expect(rater.connect(otherWallet).retract(loanToken.address))
        .to.be.revertedWith('TrueRatingAgencyV2: Not sender\'s loan')
    })
  })

  describe('Voting', () => {
    beforeEach(async () => {
      await rater.allow(owner.address, true)
      await submit(loanToken.address)
    })

    describe('Yes', () => {
      it('does not transfer funds', async () => {
        await expect(() => rater.yes(loanToken.address))
          .to.changeTokenBalance(stakedTrustToken, owner, 0)
      })

      it('keeps track of votes', async () => {
        await rater.yes(loanToken.address)
        await rater.loans(loanToken.address)
        expect(await rater.getYesVote(loanToken.address, owner.address)).to.be.equal(stake)
        expect(await rater.getNoVote(loanToken.address, owner.address)).to.be.equal(0)
      })

      it('increases loans yes value', async () => {
        await rater.yes(loanToken.address)
        expect(await rater.getTotalYesVotes(loanToken.address)).to.be.equal(stake)
      })

      it('does not change yes value when voted multiple times', async () => {
        await rater.yes(loanToken.address)
        expect(await rater.getTotalYesVotes(loanToken.address)).to.be.equal(stake)
        expect(await rater.getYesVote(loanToken.address, owner.address)).to.be.equal(stake)

        await rater.yes(loanToken.address)
        expect(await rater.getTotalYesVotes(loanToken.address)).to.be.equal(stake)
        expect(await rater.getYesVote(loanToken.address, owner.address)).to.be.equal(stake)
      })

      it('voting yes, after voting no changes choice', async () => {
        await rater.no(loanToken.address)
        await rater.yes(loanToken.address)

        expect(await rater.getTotalYesVotes(loanToken.address)).to.be.equal(stake)
        expect(await rater.getTotalNoVotes(loanToken.address)).to.be.equal(0)

        expect(await rater.getYesVote(loanToken.address, owner.address)).to.be.equal(stake)
        expect(await rater.getNoVote(loanToken.address, owner.address)).to.be.equal(0)
      })

      it('is only possible until loan is funded (only pending phase)', async () => {
        await loanToken.fund()
        await expect(rater.yes(loanToken.address))
          .to.be.revertedWith('TrueRatingAgencyV2: Loan is not currently pending')
      })

      it('is only possible for existing loans', async () => {
        await expect(rater.yes(fakeLoanTokenAddress))
          .to.be.revertedWith('TrueRatingAgencyV2: Loan is not currently pending')
      })

      it('emits proper event', async () => {
        await expect(rater.yes(loanToken.address))
          .to.emit(rater, 'Voted').withArgs(loanToken.address, owner.address, true, stake)
      })
    })

    describe('No', () => {
      it('does transfers funds', async () => {
        await expect(() => rater.no(loanToken.address))
          .to.changeTokenBalance(stakedTrustToken, owner, 0)
      })

      it('keeps track of votes', async () => {
        await rater.no(loanToken.address)
        await rater.loans(loanToken.address)
        expect(await rater.getNoVote(loanToken.address, owner.address)).to.be.equal(stake)
        expect(await rater.getYesVote(loanToken.address, owner.address)).to.be.equal(0)
      })

      it('increases loans no value', async () => {
        await rater.no(loanToken.address)
        expect(await rater.getTotalNoVotes(loanToken.address)).to.be.equal(stake)
      })

      it('does not change no value when voted multiple times', async () => {
        await rater.no(loanToken.address)
        expect(await rater.getTotalNoVotes(loanToken.address)).to.be.equal(stake)
        expect(await rater.getNoVote(loanToken.address, owner.address)).to.be.equal(stake)

        await rater.no(loanToken.address)
        expect(await rater.getTotalNoVotes(loanToken.address)).to.be.equal(stake)
        expect(await rater.getNoVote(loanToken.address, owner.address)).to.be.equal(stake)
      })

      it('voting no, after voting yes changes choice', async () => {
        await rater.yes(loanToken.address)
        await rater.no(loanToken.address)

        expect(await rater.getTotalYesVotes(loanToken.address)).to.be.equal(0)
        expect(await rater.getTotalNoVotes(loanToken.address)).to.be.equal(stake)

        expect(await rater.getYesVote(loanToken.address, owner.address)).to.be.equal(0)
        expect(await rater.getNoVote(loanToken.address, owner.address)).to.be.equal(stake)
      })

      it('is only possible until loan is funded (only pending phase)', async () => {
        await loanToken.fund()
        await expect(rater.no(loanToken.address))
          .to.be.revertedWith('TrueRatingAgencyV2: Loan is not currently pending')
      })

      it('is only possible for existing loans', async () => {
        await expect(rater.no(fakeLoanTokenAddress))
          .to.be.revertedWith('TrueRatingAgencyV2: Loan is not currently pending')
      })

      it('emits proper event', async () => {
        await expect(rater.no(loanToken.address))
          .to.emit(rater, 'Voted').withArgs(loanToken.address, owner.address, false, stake)
      })
    })

    describe('Cancel', () => {
      it('reverts when Loan status is greater than pending', async () => {
        await rater.yes(loanToken.address)
        await loanToken.fund()
        await expect(rater.cancel(loanToken.address))
          .to.be.revertedWith('TrueRatingAgencyV2: Loan is not currently pending')
      })

      it('cancels yes votes', async () => {
        await rater.yes(loanToken.address)
        await rater.cancel(loanToken.address)
        expect(await rater.getTotalYesVotes(loanToken.address)).to.be.equal(0)
        expect(await rater.getYesVote(loanToken.address, owner.address)).to.be.equal(0)
      })

      it('cancels no votes', async () => {
        await rater.no(loanToken.address)
        await rater.cancel(loanToken.address)
        expect(await rater.getTotalNoVotes(loanToken.address)).to.be.equal(0)
        expect(await rater.getNoVote(loanToken.address, owner.address)).to.be.equal(0)
      })

      it('does not change anything when nothing staked', async () => {
        expect(await rater.getTotalYesVotes(loanToken.address)).to.be.equal(0)
        expect(await rater.getYesVote(loanToken.address, owner.address)).to.be.equal(0)
        expect(await rater.getTotalNoVotes(loanToken.address)).to.be.equal(0)
        expect(await rater.getNoVote(loanToken.address, owner.address)).to.be.equal(0)
        await rater.cancel(loanToken.address)
        expect(await rater.getTotalYesVotes(loanToken.address)).to.be.equal(0)
        expect(await rater.getYesVote(loanToken.address, owner.address)).to.be.equal(0)
        expect(await rater.getTotalNoVotes(loanToken.address)).to.be.equal(0)
        expect(await rater.getNoVote(loanToken.address, owner.address)).to.be.equal(0)
      })
    })
  })

  describe('Claim', () => {
    const rewardMultiplier = 1
    beforeEach(async () => {
      loanToken = await new LoanTokenFactory(owner).deploy(
        tusd.address,
        owner.address,
        owner.address,
        AddressZero,
        parseEth(5e6),
        yearInSeconds * 2,
        100,
      )

      await rater.setRewardMultiplier(rewardMultiplier)
      await tusd.approve(loanToken.address, parseEth(5e6))
      await rater.allow(owner.address, true)
      await submit(loanToken.address)
    })

    const expectRoughTrustTokenBalanceChangeAfterClaim = async (expectedChange: BigNumberish, wallet: Wallet = owner) => {
      const balanceBefore = await trustToken.balanceOf(wallet.address)
      await rater.claim(loanToken.address, wallet.address, txArgs)
      const balanceAfter = await trustToken.balanceOf(wallet.address)
      expectScaledCloseTo(balanceAfter.sub(balanceBefore), BigNumber.from(expectedChange))
    }

    it('can only be called after loan is funded', async () => {
      await rater.yes(loanToken.address)
      await expect(rater.claim(loanToken.address, owner.address))
        .to.be.revertedWith('TrueRatingAgencyV2: Loan was not funded')
    })

    it('when called for the first time, moves funds from distributor to rater and then are distributed to caller', async () => {
      await rater.yes(loanToken.address)
      await loanToken.fund()
      const balanceBefore = await trustToken.balanceOf(owner.address)
      await rater.claim(loanToken.address, owner.address, txArgs)
      const balanceAfter = await trustToken.balanceOf(owner.address)
      expectScaledCloseTo(balanceAfter.sub(balanceBefore), parseTRU(1e5))
    })

    it('when called for the first time, moves funds from distributor to rater (different reward multiplier)', async () => {
      await rater.setRewardMultiplier(50)
      await rater.yes(loanToken.address)
      await loanToken.fund()
      const balanceBefore = await trustToken.balanceOf(owner.address)
      await rater.claim(loanToken.address, owner.address, txArgs)
      const balanceAfter = await trustToken.balanceOf(owner.address)
      expectScaledCloseTo(balanceAfter.sub(balanceBefore), parseTRU(5e6))
    })

    it('when called for the second time, does not interact with distributor anymore', async () => {
      await rater.yes(loanToken.address)
      await loanToken.fund()

      await rater.claim(loanToken.address, owner.address, txArgs)
      await expectBalanceChangeCloseTo(() => rater.claim(loanToken.address, owner.address, txArgs), trustToken, rater, 0)
    })

    it('emits event', async () => {
      await rater.yes(loanToken.address)
      await loanToken.fund()
      await expect(rater.claim(loanToken.address, owner.address, txArgs))
        .to.emit(rater, 'Claimed')
        .withArgs(loanToken.address, owner.address, parseTRU(100000))
    })

    describe('with different ratersRewardFactor value', () => {
      beforeEach(async () => {
        await rater.setRatersRewardFactor(4000)
      })

      it('moves proper amount of funds from distributor', async () => {
        await rater.yes(loanToken.address)
        await loanToken.fund()
        const balanceBefore = await trustToken.balanceOf(distributor.address)
        await rater.claim(loanToken.address, owner.address, txArgs)
        const balanceAfter = await trustToken.balanceOf(distributor.address)
        expectScaledCloseTo(balanceBefore.sub(balanceAfter), parseTRU(1e5))
      })

      it('moves proper amount of funds from to staking contract', async () => {
        await rater.yes(loanToken.address)
        await loanToken.fund()
        const balanceBefore = await trustToken.balanceOf(stakedTrustToken.address)
        await rater.claim(loanToken.address, owner.address, txArgs)
        const balanceAfter = await trustToken.balanceOf(stakedTrustToken.address)
        expectScaledCloseTo(balanceAfter.sub(balanceBefore), parseTRU(6e4))
      })

      it('less funds are available for direct claiming', async () => {
        await rater.yes(loanToken.address)
        await loanToken.fund()
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

      it('properly saves claimed amount and moves funds (1 voter)', async () => {
        await rater.yes(loanToken.address)
        await loanToken.fund()
        const expectedReward = parseTRU(100000).mul(newRewardMultiplier)
        await expectRoughTrustTokenBalanceChangeAfterClaim(expectedReward)
      })

      it('properly saves claimed amount and moves funds (multiple voters)', async () => {
        const totalReward = parseTRU(100000).mul(newRewardMultiplier)
        await rater.yes(loanToken.address)
        await stakedTrustToken.mint(otherWallet.address, parseTRU(1e8))
        await rater.connect(otherWallet).yes(loanToken.address)
        await loanToken.fund()

        await expectRoughTrustTokenBalanceChangeAfterClaim(totalReward.div(11), owner)
        await expectRoughTrustTokenBalanceChangeAfterClaim(totalReward.mul(10).div(11), otherWallet)
      })

      it('works after distribution ended', async () => {
        await rater.yes(loanToken.address)
        await stakedTrustToken.mint(otherWallet.address, parseTRU(1e8))
        await stakedTrustToken.connect(otherWallet).approve(rater.address, 3000)
        await rater.connect(otherWallet).yes(loanToken.address)
        await loanToken.fund()

        await distributor.empty()
        await expectRoughTrustTokenBalanceChangeAfterClaim('0', owner)
      })
    })

    describe('Closed', () => {
      beforeEach(async () => {
        await rater.yes(loanToken.address)
      })

      it('properly saves claimed amount and moves funds (multiple voters, called multiple times)', async () => {
        await stakedTrustToken.mint(otherWallet.address, stake.mul(3).div(2))
        await stakedTrustToken.connect(otherWallet).approve(rater.address, 3000)
        await rater.connect(otherWallet).yes(loanToken.address)
        await loanToken.fund()

        await timeTravel(yearInSeconds)
        await expectRoughTrustTokenBalanceChangeAfterClaim(parseTRU(4e4), owner)
        await timeTravel(averageMonthInSeconds * 30)
        await loanToken.close()
        await expectRoughTrustTokenBalanceChangeAfterClaim(parseTRU(0), owner)
        await expectRoughTrustTokenBalanceChangeAfterClaim(parseTRU(6e4), otherWallet)
      })

      it('does not do anything when called multiple times', async () => {
        await loanToken.fund()
        await timeTravel(yearInSeconds * 2 + dayInSeconds)
        await loanToken.close()

        await expectRoughTrustTokenBalanceChangeAfterClaim(parseTRU(1e5), owner)
        await expectRoughTrustTokenBalanceChangeAfterClaim(0, owner)
      })
    })
  })
})
