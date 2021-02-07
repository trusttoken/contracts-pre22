import { expect } from 'chai'
import { BigNumber, BigNumberish, constants, utils, Wallet } from 'ethers'
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

import {
  TrueRatingAgencyFactory,
  TrueRatingAgency,
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
  TrueRatingAgencyJson,
} from 'contracts'

describe('TrueRatingAgency', () => {
  enum LoanStatus { Void, Pending, Retracted, Running, Settled, Defaulted }

  let owner: Wallet
  let otherWallet: Wallet
  let wallets: Wallet[]

  let rater: TrueRatingAgency
  let trustToken: TrustToken
  let loanToken: LoanToken
  let distributor: ArbitraryDistributor
  let tusd: MockTrueCurrency
  let mockFactory: MockContract

  const fakeLoanTokenAddress = '0x156b86b8983CC7865076B179804ACC277a1E78C4'
  const stake = 1e6

  const dayInSeconds = 60 * 60 * 24
  const yearInSeconds = dayInSeconds * 365
  const averageMonthInSeconds = yearInSeconds / 12

  const txArgs = {
    gasLimit: 6_000_000,
  }

  let timeTravel: (time: number) => void

  beforeEachWithFixture(async (_wallets, _provider) => {
    [owner, otherWallet, ...wallets] = _wallets

    trustToken = await new TrustTokenFactory(owner).deploy()
    await trustToken.initialize()
    tusd = await new MockTrueCurrencyFactory(owner).deploy()
    await tusd.mint(owner.address, parseEth(1e7))

    loanToken = await new LoanTokenFactory(owner).deploy(
      tusd.address,
      owner.address,
      owner.address,
      owner.address,
      5_000_000,
      yearInSeconds * 2,
      1000,
    )
    await tusd.approve(loanToken.address, 5_000_000)

    distributor = await new ArbitraryDistributorFactory(owner).deploy()
    mockFactory = await deployMockContract(owner, ILoanFactoryJson.abi)
    rater = await new TrueRatingAgencyFactory(owner).deploy()

    await mockFactory.mock.isLoanToken.returns(true)
    await distributor.initialize(rater.address, trustToken.address, parseTRU(1e7))
    await rater.initialize(trustToken.address, distributor.address, mockFactory.address)

    await trustToken.mint(owner.address, parseTRU(1e7))
    await trustToken.mint(distributor.address, parseTRU(1e7))
    await trustToken.approve(rater.address, parseTRU(1e7))

    timeTravel = (time: number) => _timeTravel(_provider, time)
  })

  const submit = async (loanTokenAddress: string, wallet = owner) =>
    rater.connect(wallet).submit(loanTokenAddress, { gasLimit: 4_000_000 })

  describe('Initializer', () => {
    it('sets trust token address', async () => {
      expect(await rater.trustToken()).to.equal(trustToken.address)
    })

    it('checks distributor beneficiary address', async () => {
      const mockDistributor = await deployMockContract(owner, ArbitraryDistributorJson.abi)
      await mockDistributor.mock.beneficiary.returns(owner.address)
      const newRater = await new TrueRatingAgencyFactory(owner).deploy()
      await expect(newRater.initialize(trustToken.address, mockDistributor.address, mockFactory.address)).to.be.revertedWith('TrueRatingAgency: Invalid distributor beneficiary')
    })
  })

  describe('Parameters set up', () => {
    describe('setLossFactor', () => {
      it('changes lossFactor', async () => {
        await rater.setLossFactor(1234)
        expect(await rater.lossFactor())
          .to.equal(1234)
      })

      it('emits LossFactorChanged', async () => {
        await expect(rater.setLossFactor(1234))
          .to.emit(rater, 'LossFactorChanged').withArgs(1234)
      })

      it('must be called by owner', async () => {
        await expect(rater.connect(otherWallet).setLossFactor(1234))
          .to.be.revertedWith('caller is not the owner')
      })

      it('must be less than or equal 100%', async () => {
        await expect(rater.setLossFactor(100 * 101))
          .to.be.revertedWith('TrueRatingAgency: Loss factor cannot be greater than 100%')
      })
    })

    describe('setBurnFactor', () => {
      it('changes burnFactor', async () => {
        await rater.setBurnFactor(1234)
        expect(await rater.burnFactor())
          .to.equal(1234)
      })

      it('emits BurnFactorChanged', async () => {
        await expect(rater.setBurnFactor(1234))
          .to.emit(rater, 'BurnFactorChanged').withArgs(1234)
      })

      it('must be called by owner', async () => {
        await expect(rater.connect(otherWallet).setBurnFactor(1234))
          .to.be.revertedWith('caller is not the owner')
      })

      it('must be less than or equal 100%', async () => {
        await expect(rater.setBurnFactor(100 * 101))
          .to.be.revertedWith('TrueRatingAgency: Burn factor cannot be greater than 100%')
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
        .to.be.revertedWith('TrueRatingAgency: Sender is not allowed to submit')
    })

    it('reverts when creator is not a borrower', async () => {
      await rater.allow(otherWallet.address, true)
      await expect(submit(loanToken.address, otherWallet))
        .to.be.revertedWith('TrueRatingAgency: Sender is not borrower')
    })

    it('reverts when submissions are paused', async () => {
      await rater.pauseSubmissions(true)
      await expect(submit(loanToken.address, owner))
        .to.be.revertedWith('TrueRatingAgency: New submissions are paused')
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
      await rater.yes(loanToken.address, stake)
      await rater.retract(loanToken.address)
      expect(await rater.getYesVote(loanToken.address, owner.address)).to.be.equal(stake)
    })

    it('if loan is retracted, stakers total vote-based prediction is lost', async () => {
      await submit(loanToken.address)
      await rater.yes(loanToken.address, stake)
      await rater.retract(loanToken.address)
      expect(await rater.getTotalYesVotes(loanToken.address)).to.be.equal(0)
      expect(await rater.getTotalNoVotes(loanToken.address)).to.be.equal(0)
    })

    it('reverts if token was not created with LoanFactory', async () => {
      await mockFactory.mock.isLoanToken.returns(false)
      await expect(submit(loanToken.address)).to.be.revertedWith('TrueRatingAgency: Only LoanTokens created via LoanFactory are supported')
    })

    it('reverts on attempt of creating the same loan twice', async () => {
      await submit(loanToken.address)
      await expect(submit(loanToken.address))
        .to.be.revertedWith('TrueRatingAgency: Loan was already created')
    })

    it('does not allow to resubmit retracted loan', async () => {
      await submit(loanToken.address)
      await rater.retract(loanToken.address)
      await expect(submit(loanToken.address))
        .to.be.revertedWith('TrueRatingAgency: Loan was already created')
    })

    it('retracting is only possible until loan is funded (only pending phase)', async () => {
      await loanToken.fund()
      await expect(rater.retract(loanToken.address))
        .to.be.revertedWith('TrueRatingAgency: Loan is not currently pending')
    })

    it('throws when removing not pending loan', async () => {
      await expect(rater.retract(loanToken.address))
        .to.be.revertedWith('TrueRatingAgency: Loan is not currently pending')
    })

    it('cannot remove loan created by someone else', async () => {
      await rater.allow(otherWallet.address, true)
      await submit(loanToken.address)

      await expect(rater.connect(otherWallet).retract(loanToken.address))
        .to.be.revertedWith('TrueRatingAgency: Not sender\'s loan')
    })
  })

  describe('Voting', () => {
    beforeEach(async () => {
      await rater.allow(owner.address, true)
      await submit(loanToken.address)
    })

    describe('Yes', () => {
      it('transfers funds from voter', async () => {
        await expect(() => rater.yes(loanToken.address, stake))
          .to.changeTokenBalance(trustToken, owner, -stake)
      })

      it('transfers funds to lender contract', async () => {
        await expect(() => rater.yes(loanToken.address, stake))
          .to.changeTokenBalance(trustToken, rater, stake)
      })

      it('keeps track of votes', async () => {
        await rater.yes(loanToken.address, stake)
        await rater.loans(loanToken.address)
        expect(await rater.getYesVote(loanToken.address, owner.address)).to.be.equal(stake)
        expect(await rater.getNoVote(loanToken.address, owner.address)).to.be.equal(0)
      })

      it('increases loans yes value', async () => {
        await rater.yes(loanToken.address, stake)
        expect(await rater.getTotalYesVotes(loanToken.address)).to.be.equal(stake)
      })

      it('increases loans yes value when voted multiple times', async () => {
        await rater.yes(loanToken.address, stake)
        await rater.yes(loanToken.address, stake)
        expect(await rater.getTotalYesVotes(loanToken.address)).to.be.equal(stake * 2)
      })

      it('after voting yes, disallows voting no', async () => {
        await rater.yes(loanToken.address, stake)
        await expect(rater.no(loanToken.address, stake))
          .to.be.revertedWith('TrueRatingAgency: Cannot vote both yes and no')
      })

      it('is only possible until loan is funded (only pending phase)', async () => {
        await loanToken.fund()
        await expect(rater.yes(loanToken.address, stake))
          .to.be.revertedWith('TrueRatingAgency: Loan is not currently pending')
      })

      it('is only possible for existing loans', async () => {
        await expect(rater.yes(fakeLoanTokenAddress, stake))
          .to.be.revertedWith('TrueRatingAgency: Loan is not currently pending')
      })

      it('emits proper event', async () => {
        await expect(rater.yes(loanToken.address, stake))
          .to.emit(rater, 'Voted').withArgs(loanToken.address, owner.address, true, stake)
      })
    })

    describe('No', () => {
      it('transfers funds from voter', async () => {
        await expect(() => rater.no(loanToken.address, stake))
          .to.changeTokenBalance(trustToken, owner, -stake)
      })

      it('transfers funds to lender contract', async () => {
        await expect(() => rater.no(loanToken.address, stake))
          .to.changeTokenBalance(trustToken, rater, stake)
      })

      it('keeps track of votes', async () => {
        await rater.no(loanToken.address, stake)
        await rater.loans(loanToken.address)
        expect(await rater.getNoVote(loanToken.address, owner.address)).to.be.equal(stake)
        expect(await rater.getYesVote(loanToken.address, owner.address)).to.be.equal(0)
      })

      it('increases loans no value', async () => {
        await rater.no(loanToken.address, stake)
        expect(await rater.getTotalNoVotes(loanToken.address)).to.be.equal(stake)
      })

      it('increases loans no value when voted multiple times', async () => {
        await rater.no(loanToken.address, stake)
        await rater.no(loanToken.address, stake)
        expect(await rater.getTotalNoVotes(loanToken.address)).to.be.equal(stake * 2)
      })

      it('after voting no, disallows voting no', async () => {
        await rater.no(loanToken.address, stake)
        await expect(rater.yes(loanToken.address, stake))
          .to.be.revertedWith('TrueRatingAgency: Cannot vote both yes and no')
      })

      it('is only possible until loan is funded (only pending phase)', async () => {
        await loanToken.fund()
        await expect(rater.no(loanToken.address, stake))
          .to.be.revertedWith('TrueRatingAgency: Loan is not currently pending')
      })

      it('is only possible for existing loans', async () => {
        await expect(rater.no(fakeLoanTokenAddress, stake))
          .to.be.revertedWith('TrueRatingAgency: Loan is not currently pending')
      })

      it('emits proper event', async () => {
        await expect(rater.no(loanToken.address, stake))
          .to.emit(rater, 'Voted').withArgs(loanToken.address, owner.address, false, stake)
      })
    })

    describe('Withdraw', () => {
      const vote = async (amount: string | number, yes: boolean, wallet = owner) => {
        if (wallet !== owner) {
          await trustToken.transfer(wallet.address, amount)
          await trustToken.connect(wallet).approve(rater.address, amount)
        }
        if (yes) {
          await rater.connect(wallet).yes(loanToken.address, amount)
        } else {
          await rater.connect(wallet).no(loanToken.address, amount)
        }
      }

      it('reverts if no vote was placed at all', async () => {
        await expect(rater.withdraw(loanToken.address, stake, txArgs))
          .to.be.revertedWith('TrueRatingAgency: Cannot withdraw more than was staked')
      })

      it('properly reduces stakers voting balance (yes)', async () => {
        await rater.yes(loanToken.address, stake * 3)
        await rater.withdraw(loanToken.address, stake, txArgs)

        expect(await rater.getYesVote(loanToken.address, owner.address))
          .to.be.equal(stake * 2)
        expect(await rater.getNoVote(loanToken.address, owner.address))
          .to.be.equal(0)
      })

      it('properly reduces stakers voting balance (no)', async () => {
        await rater.no(loanToken.address, stake * 3)
        await rater.withdraw(loanToken.address, stake, txArgs)

        expect(await rater.getNoVote(loanToken.address, owner.address))
          .to.be.equal(stake * 2)
        expect(await rater.getYesVote(loanToken.address, owner.address))
          .to.be.equal(0)
      })

      it('reverts if tried to withdraw more than was voted', async () => {
        await rater.yes(loanToken.address, stake)
        await expect(rater.withdraw(loanToken.address, stake * 2, txArgs))
          .to.be.revertedWith('TrueRatingAgency: Cannot withdraw more than was staked')
      })

      it('reverts if loan was funded and is currently running', async () => {
        await rater.yes(loanToken.address, stake)
        await loanToken.fund()
        await expect(rater.withdraw(loanToken.address, stake, txArgs))
          .to.be.revertedWith('TrueRatingAgency: Loan is currently running')
      })

      describe('Retracted', () => {
        beforeEach(async () => {
          await rater.yes(loanToken.address, stake)
          await rater.retract(loanToken.address)
        })

        it('properly sends unchanged amount of tokens', async () => {
          await expect(() => rater.withdraw(loanToken.address, stake, txArgs))
            .to.changeTokenBalance(trustToken, owner, stake)
        })

        it('leaves total loan votes at zero', async () => {
          const totalVotedBefore = await rater.getTotalYesVotes(loanToken.address)
          await rater.withdraw(loanToken.address, stake, txArgs)
          const totalVotedAfter = await rater.getTotalYesVotes(loanToken.address)

          expect(totalVotedBefore).to.equal(0)
          expect(totalVotedAfter).to.equal(0)
        })
      })

      describe('Pending', () => {
        beforeEach(async () => {
          await rater.yes(loanToken.address, stake)
        })

        it('properly sends unchanged amount of tokens', async () => {
          await expect(() => rater.withdraw(loanToken.address, stake, txArgs))
            .to.changeTokenBalance(trustToken, owner, stake)
        })

        it('reduces total loan votes', async () => {
          const totalVotedBefore = await rater.getTotalYesVotes(loanToken.address)
          await rater.withdraw(loanToken.address, stake, txArgs)
          const totalVotedAfter = await rater.getTotalYesVotes(loanToken.address)

          expect(totalVotedBefore).to.equal(stake)
          expect(totalVotedAfter).to.equal(0)
        })

        it('emits proper event', async () => {
          await expect(rater.withdraw(loanToken.address, stake, txArgs))
            .to.emit(rater, 'Withdrawn').withArgs(loanToken.address, owner.address, stake, stake, 0)
        })
      })

      const expectTrustTokenBalanceChange = async (action: () => Promise<any>, expectedChange: string | number, wallet = owner) => {
        const balanceBefore = await trustToken.balanceOf(wallet.address)
        await action()
        expect((await trustToken.balanceOf(wallet.address)).sub(balanceBefore)).to.equal(expectedChange)
      }

      describe('Settled', () => {
        const settleLoan = async () => {
          await loanToken.fund()
          await loanToken.withdraw(owner.address, txArgs)
          await tusd.transfer(loanToken.address, await loanToken.debt())
          await timeTravel(yearInSeconds * 2)
          await loanToken.close()
          expect(await rater.status(loanToken.address)).to.equal(LoanStatus.Settled)
        }

        beforeEach(async () => {
          await vote(stake, true)
        })

        it('nobody voted no: yes-voters do not receive bounty', async () => {
          await settleLoan()
          await expectTrustTokenBalanceChange(() => rater.withdraw(loanToken.address, stake, txArgs), stake)
        })

        it('no votes = yes votes, yes voters get 75% of 25% of no voters', async () => {
          await vote(stake, false, otherWallet)
          await settleLoan()
          await expectTrustTokenBalanceChange(() => rater.withdraw(loanToken.address, stake, txArgs), stake * 1.1875) // 1+1*0.25*0.75 = 1.1875
        })

        it('no votes = yes votes, yes voter withdraws in tranches', async () => {
          await vote(stake, false, otherWallet)
          await settleLoan()
          await expectTrustTokenBalanceChange(() => rater.withdraw(loanToken.address, stake * 0.4, txArgs), stake * 0.4 * 1.1875)
          await expectTrustTokenBalanceChange(() => rater.withdraw(loanToken.address, stake * 0.4, txArgs), stake * 0.4 * 1.1875)
          await expectTrustTokenBalanceChange(() => rater.withdraw(loanToken.address, stake * 0.2, txArgs), stake * 0.2 * 1.1875)
        })

        it('2 yes staker, 1 no staker with 1/4 of yes votes', async () => {
          await vote(stake, true, otherWallet)
          await vote(stake / 2, false, wallets[0])
          await settleLoan()
          await expectTrustTokenBalanceChange(() => rater.withdraw(loanToken.address, stake, txArgs), stake * 1.046875) // 1+0.25*0.25*0.75 = 1.046875
          await expectTrustTokenBalanceChange(() => rater.connect(otherWallet).withdraw(loanToken.address, stake, txArgs), stake * 1.046875, otherWallet)
        })

        it('no votes = yes votes, no voters get 75%', async () => {
          await vote(stake, false, otherWallet)
          await settleLoan()
          await expectTrustTokenBalanceChange(() => rater.connect(otherWallet).withdraw(loanToken.address, stake, txArgs), stake * 0.75, otherWallet)
        })

        it('no votes < yes votes, no voters get 75%', async () => {
          await vote(stake / 2, false, otherWallet)
          await settleLoan()
          await expectTrustTokenBalanceChange(() => rater.connect(otherWallet).withdraw(loanToken.address, stake / 2, txArgs), (stake / 2) * 0.75, otherWallet)
        })

        it('25% of stake lost by no voters is burned', async () => {
          const totalSupplyBefore = await trustToken.totalSupply()
          await vote(stake, false, otherWallet)
          await settleLoan()
          await rater.connect(otherWallet).withdraw(loanToken.address, stake, txArgs)
          const totalSupplyAfter = await trustToken.totalSupply()

          expect(totalSupplyBefore.sub(totalSupplyAfter)).to.equal(stake * 0.25 * 0.25)
        })

        describe('works for different lossFactor and burnFactor', () => {
          beforeEach(async () => {
            await rater.setLossFactor(1000)
            await rater.setBurnFactor(5000)
            await vote(stake, false, otherWallet)
            await settleLoan()
          })

          it('correct amount is burned', async () => {
            const totalSupplyBefore = await trustToken.totalSupply()
            await rater.connect(otherWallet).withdraw(loanToken.address, stake, txArgs)
            const totalSupplyAfter = await trustToken.totalSupply()

            expect(totalSupplyBefore.sub(totalSupplyAfter)).to.equal(stake * 0.1 * 0.5)
          })

          it('yes voters receive proper amount', async () => {
            await expectTrustTokenBalanceChange(() => rater.withdraw(loanToken.address, stake, txArgs), stake * (1 + 0.1 * 0.5))
          })

          it('no voters receive proper amount', async () => {
            await expectTrustTokenBalanceChange(() => rater.connect(otherWallet).withdraw(loanToken.address, stake, txArgs), stake * (1 - 0.1), otherWallet)
          })
        })

        it('does not change total loan yes votes', async () => {
          await settleLoan()
          await rater.withdraw(loanToken.address, stake, txArgs)
          expect(await rater.getTotalYesVotes(loanToken.address)).to.equal(stake)
        })

        it('does not change total loan no votes', async () => {
          await vote(stake / 10, false, otherWallet)
          await settleLoan()
          await rater.withdraw(loanToken.address, stake, txArgs)
          expect(await rater.getTotalNoVotes(loanToken.address)).to.equal(stake / 10)
        })
      })

      describe('Defaulted', () => {
        const defaultLoan = async () => {
          await loanToken.fund()
          await loanToken.withdraw(owner.address, txArgs)
          await timeTravel(yearInSeconds * 2 + dayInSeconds)
          await loanToken.close()
          expect(await rater.status(loanToken.address)).to.equal(LoanStatus.Defaulted)
        }

        beforeEach(async () => {
          await vote(stake, false)
        })

        it('nobody voted yes: no-voters do not receive bounty', async () => {
          await defaultLoan()
          await expectTrustTokenBalanceChange(() => rater.withdraw(loanToken.address, stake, txArgs), stake)
        })

        it('no votes = yes votes, no voters get 75% of 25% of yes voters', async () => {
          await vote(stake, true, otherWallet)
          await defaultLoan()
          await expectTrustTokenBalanceChange(() => rater.withdraw(loanToken.address, stake, txArgs), stake * 1.1875) // 1+1*0.25*0.75 = 1.1875
        })

        it('no votes = yes votes, no voter withdraws in tranches', async () => {
          await vote(stake, true, otherWallet)
          await defaultLoan()
          await expectTrustTokenBalanceChange(() => rater.withdraw(loanToken.address, stake * 0.4, txArgs), stake * 0.4 * 1.1875)
          await expectTrustTokenBalanceChange(() => rater.withdraw(loanToken.address, stake * 0.4, txArgs), stake * 0.4 * 1.1875)
          await expectTrustTokenBalanceChange(() => rater.withdraw(loanToken.address, stake * 0.2, txArgs), stake * 0.2 * 1.1875)
        })

        it('2 no staker, 1 yes staker with 1/4 of no votes', async () => {
          await vote(stake, false, otherWallet)
          await vote(stake / 2, true, wallets[0])
          await defaultLoan()
          await expectTrustTokenBalanceChange(() => rater.withdraw(loanToken.address, stake, txArgs), stake * 1.046875) // 1+0.25*0.25*0.75 = 1.046875
          await expectTrustTokenBalanceChange(() => rater.connect(otherWallet).withdraw(loanToken.address, stake, txArgs), stake * 1.046875, otherWallet)
        })

        it('no votes = yes votes, yes voters get 75%', async () => {
          await vote(stake, true, otherWallet)
          await defaultLoan()
          await expectTrustTokenBalanceChange(() => rater.connect(otherWallet).withdraw(loanToken.address, stake, txArgs), stake * 0.75, otherWallet)
        })

        it('yes votes < no votes, yes voters get 75%', async () => {
          await vote(stake / 2, true, otherWallet)
          await defaultLoan()
          await expectTrustTokenBalanceChange(() => rater.connect(otherWallet).withdraw(loanToken.address, stake / 2, txArgs), (stake / 2) * 0.75, otherWallet)
        })

        it('25% of stake lost by yes voters is burned', async () => {
          const totalSupplyBefore = await trustToken.totalSupply()
          await vote(stake, true, otherWallet)
          await defaultLoan()
          await rater.connect(otherWallet).withdraw(loanToken.address, stake, txArgs)
          const totalSupplyAfter = await trustToken.totalSupply()

          expect(totalSupplyBefore.sub(totalSupplyAfter)).to.equal(stake * 0.25 * 0.25)
        })

        describe('works for different lossFactor and burnFactor', () => {
          beforeEach(async () => {
            await rater.setLossFactor(1000)
            await rater.setBurnFactor(5000)
            await vote(stake, true, otherWallet)
            await defaultLoan()
          })

          it('correct amount is burned', async () => {
            const totalSupplyBefore = await trustToken.totalSupply()
            await rater.connect(otherWallet).withdraw(loanToken.address, stake, txArgs)
            const totalSupplyAfter = await trustToken.totalSupply()

            expect(totalSupplyBefore.sub(totalSupplyAfter)).to.equal(stake * 0.1 * 0.5)
          })

          it('no voters receive proper amount', async () => {
            await expectTrustTokenBalanceChange(() => rater.withdraw(loanToken.address, stake, txArgs), stake * (1 + 0.1 * 0.5))
          })

          it('yes voters receive proper amount', async () => {
            await expectTrustTokenBalanceChange(() => rater.connect(otherWallet).withdraw(loanToken.address, stake, txArgs), stake * (1 - 0.1), otherWallet)
          })
        })

        it('does not change total loan yes votes', async () => {
          await vote(stake * 10, true, otherWallet)
          await defaultLoan()
          await rater.withdraw(loanToken.address, stake, txArgs)
          expect(await rater.getTotalYesVotes(loanToken.address)).to.equal(stake * 10)
        })

        it('does not change total loan no votes', async () => {
          await defaultLoan()
          await rater.withdraw(loanToken.address, stake, txArgs)
          expect(await rater.getTotalNoVotes(loanToken.address)).to.equal(stake)
        })
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
        owner.address,
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
      await rater.yes(loanToken.address, 1000)
      await expect(rater.claim(loanToken.address, owner.address))
        .to.be.revertedWith('TrueRatingAgency: Loan was not funded')
    })

    it('when called for the first time, moves funds from distributor to rater', async () => {
      await rater.yes(loanToken.address, 1000)
      await loanToken.fund()
      const balanceBefore = await trustToken.balanceOf(rater.address)
      await rater.claim(loanToken.address, owner.address, txArgs)
      const balanceAfter = await trustToken.balanceOf(rater.address)
      expectScaledCloseTo(balanceAfter.sub(balanceBefore), parseTRU(1e5))
    })

    it('when called for the first time, moves funds from distributor to rater (different reward multiplier)', async () => {
      await rater.setRewardMultiplier(50)
      await rater.yes(loanToken.address, 1000)
      await loanToken.fund()
      const balanceBefore = await trustToken.balanceOf(rater.address)
      await rater.claim(loanToken.address, owner.address, txArgs)
      const balanceAfter = await trustToken.balanceOf(rater.address)
      expectScaledCloseTo(balanceAfter.sub(balanceBefore), parseTRU(5e6))
    })

    it('when called for the second time, does not interact with distributor anymore', async () => {
      await rater.yes(loanToken.address, 1000)
      await loanToken.fund()

      await rater.claim(loanToken.address, owner.address, txArgs)
      await expectBalanceChangeCloseTo(() => rater.claim(loanToken.address, owner.address, txArgs), trustToken, rater, 0)
    })

    it('emits event', async () => {
      await rater.yes(loanToken.address, 1000)
      await loanToken.fund()
      await timeTravel(averageMonthInSeconds * 6)

      const tx = await rater.claim(loanToken.address, owner.address, txArgs)
      const receipt = await tx.wait()
      const event = new utils.Interface(TrueRatingAgencyJson.abi).parseLog(receipt.events[3])

      expect(event.args[0]).eq(loanToken.address)
      expect(event.args[1]).eq(owner.address)
      expectScaledCloseTo(BigNumber.from(event.args[2]), parseTRU(25000))
    })

    describe('Running', () => {
      const newRewardMultiplier = 50

      beforeEach(async () => {
        await rater.setRewardMultiplier(newRewardMultiplier)
      })

      it('properly saves claimed amount and moves funds (1 voter, called once)', async () => {
        await rater.yes(loanToken.address, 1000)
        await loanToken.fund()
        const expectedReward = parseTRU(50000).mul(newRewardMultiplier)
        await timeTravel(yearInSeconds)
        await expectRoughTrustTokenBalanceChangeAfterClaim(expectedReward)
      })

      it('properly saves claimed amount and moves funds (1 voter, called multiple times)', async () => {
        await rater.yes(loanToken.address, 1000)
        await loanToken.fund()
        let totalReward = constants.Zero

        const testNext = async (expectedReward: BigNumber) => {
          totalReward = totalReward.add(expectedReward)
          await expectRoughTrustTokenBalanceChangeAfterClaim(expectedReward)
          expectScaledCloseTo(await rater.claimed(loanToken.address, owner.address), totalReward)
        }

        await timeTravel(averageMonthInSeconds * 6)
        await testNext(parseTRU('25000').mul(newRewardMultiplier))
        await timeTravel(yearInSeconds)
        await testNext(parseTRU('50000').mul(newRewardMultiplier))
        await timeTravel(averageMonthInSeconds * 3)
        await testNext(parseTRU('12500').mul(newRewardMultiplier))
        await timeTravel(averageMonthInSeconds * 10)
        await testNext(parseTRU('12500').mul(newRewardMultiplier))
      })

      it('properly saves claimed amount and moves funds (multiple voters, called once)', async () => {
        const totalReward = parseTRU(50000).mul(newRewardMultiplier)
        await rater.yes(loanToken.address, 2000)
        await trustToken.mint(otherWallet.address, parseTRU(1e8))
        await trustToken.connect(otherWallet).approve(rater.address, 3000)
        await rater.connect(otherWallet).yes(loanToken.address, 3000)
        await loanToken.fund()

        await timeTravel(yearInSeconds)
        await expectRoughTrustTokenBalanceChangeAfterClaim(totalReward.mul(2).div(5), owner)
        await expectRoughTrustTokenBalanceChangeAfterClaim(totalReward.mul(3).div(5), otherWallet)
      })

      it('properly saves claimed amount and moves funds (multiple voters, called multiple times)', async () => {
        await rater.yes(loanToken.address, 2000)
        await trustToken.mint(otherWallet.address, parseTRU(1e8))
        await trustToken.connect(otherWallet).approve(rater.address, 3000)
        await rater.connect(otherWallet).yes(loanToken.address, 3000)
        await loanToken.fund()

        await timeTravel(yearInSeconds)
        await expectRoughTrustTokenBalanceChangeAfterClaim(parseTRU(2e4).mul(newRewardMultiplier), owner)
        await expectRoughTrustTokenBalanceChangeAfterClaim(parseTRU(3e4).mul(newRewardMultiplier), otherWallet)
        await timeTravel(averageMonthInSeconds * 6)
        await expectRoughTrustTokenBalanceChangeAfterClaim(parseTRU(1e4).mul(newRewardMultiplier), owner)
        await timeTravel(averageMonthInSeconds * 6)
        await expectRoughTrustTokenBalanceChangeAfterClaim(parseTRU(1e4).mul(newRewardMultiplier), owner)
        await expectRoughTrustTokenBalanceChangeAfterClaim(parseTRU(3e4).mul(newRewardMultiplier), otherWallet)
      })

      it('works after distribution ended', async () => {
        await rater.yes(loanToken.address, 2000)
        await trustToken.mint(otherWallet.address, parseTRU(1e8))
        await trustToken.connect(otherWallet).approve(rater.address, 3000)
        await rater.connect(otherWallet).yes(loanToken.address, 3000)
        await loanToken.fund()

        await timeTravel(yearInSeconds)
        await distributor.empty()
        await expectRoughTrustTokenBalanceChangeAfterClaim('0', owner)
      })
    })

    describe('Closed', () => {
      beforeEach(async () => {
        await rater.yes(loanToken.address, 2000)
      })

      it('properly saves claimed amount and moves funds (multiple voters, called multiple times)', async () => {
        await trustToken.mint(otherWallet.address, parseTRU(1e7))
        await trustToken.connect(otherWallet).approve(rater.address, 3000)
        await rater.connect(otherWallet).yes(loanToken.address, 3000)
        await loanToken.fund()

        await timeTravel(yearInSeconds)
        await expectRoughTrustTokenBalanceChangeAfterClaim(parseTRU(2e4), owner)
        await timeTravel(averageMonthInSeconds * 30)
        await loanToken.close()
        await expectRoughTrustTokenBalanceChangeAfterClaim(parseTRU(2e4), owner)
        await rater.withdraw(loanToken.address, await rater.getYesVote(loanToken.address, owner.address), txArgs)
        await expectRoughTrustTokenBalanceChangeAfterClaim(parseTRU(6e4), otherWallet)
      })

      it('does not do anything when called multiple times', async () => {
        await loanToken.fund()
        await timeTravel(yearInSeconds * 2 + dayInSeconds)
        await loanToken.close()

        await expectRoughTrustTokenBalanceChangeAfterClaim(parseTRU(1e5), owner)
        await expectRoughTrustTokenBalanceChangeAfterClaim(0, owner)
      })

      it('does claim with withdraw', async () => {
        await loanToken.fund()
        await timeTravel(yearInSeconds * 2)
        await tusd.mint(loanToken.address, parseEth(1312312312321))
        await loanToken.close()
        const staked = await rater.getYesVote(loanToken.address, owner.address)

        await expect(async () => rater.withdraw(loanToken.address, staked, txArgs))
          .to.changeTokenBalance(trustToken, owner, staked.add(parseTRU(1e5)))
      })

      it('does claim with partial withdraws', async () => {
        await loanToken.fund()
        await timeTravel(yearInSeconds * 2)
        await tusd.mint(loanToken.address, parseEth(1312312312321))
        await loanToken.close()
        const staked = await rater.getYesVote(loanToken.address, owner.address)

        await expect(async () => rater.withdraw(loanToken.address, staked.div(2), txArgs))
          .to.changeTokenBalance(trustToken, owner, staked.div(2).add(parseTRU(1e5)))
        await expect(async () => rater.withdraw(loanToken.address, staked.div(2), txArgs))
          .to.changeTokenBalance(trustToken, owner, staked.div(2))
      })
    })
  })
})
