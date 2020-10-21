import { expect } from 'chai'
import { Wallet } from 'ethers'
import { AddressZero } from '@ethersproject/constants'

import { beforeEachWithFixture } from '../utils/beforeEachWithFixture'
import { parseTT } from '../utils/parseTT'

import { TrueRatingAgencyFactory } from '../../build/types/TrueRatingAgencyFactory'
import { TrueRatingAgency } from '../../build/types/TrueRatingAgency'
import { TrustTokenFactory } from '../../build/types/TrustTokenFactory'
import { TrustToken } from '../../build/types/TrustToken'
import { LoanTokenFactory } from '../../build/types/LoanTokenFactory'
import { LoanToken } from '../../build/types/LoanToken'
import { MockTrueCurrencyFactory } from '../../build/types/MockTrueCurrencyFactory'
import { MockTrueCurrency } from '../../build/types/MockTrueCurrency'
import { timeTravel } from '../utils/timeTravel'
import { MockProvider } from 'ethereum-waffle'

describe('TrueRatingAgency', () => {
  enum LoanStatus {Void, Pending, Retracted, Running, Settled, Defaulted}

  let provider: MockProvider
  let owner: Wallet
  let otherWallet: Wallet
  let wallets: Wallet[]
  let rater: TrueRatingAgency
  let trustToken: TrustToken
  let loanToken: LoanToken
  let tusd: MockTrueCurrency

  const fakeLoanTokenAddress = '0x156b86b8983CC7865076B179804ACC277a1E78C4'
  const stake = 1000000

  const dayInSeconds = 60 * 60 * 24
  const monthInSeconds = dayInSeconds * 30

  beforeEachWithFixture(async (_wallets, _provider) => {
    [owner, otherWallet, ...wallets] = _wallets

    trustToken = await new TrustTokenFactory(owner).deploy()
    await trustToken.initialize()
    tusd = await new MockTrueCurrencyFactory(owner).deploy()
    await tusd.mint(owner.address, 7_000_000)

    loanToken = await new LoanTokenFactory(owner).deploy(
      tusd.address,
      owner.address,
      5_000_000,
      monthInSeconds * 24,
      1000,
    )
    await tusd.approve(loanToken.address, 5_000_000)

    rater = await new TrueRatingAgencyFactory(owner).deploy(trustToken.address)

    await trustToken.mint(owner.address, parseTT(100000000))
    await trustToken.approve(rater.address, parseTT(100000000))

    provider = _provider
  })

  const submit = async (loanTokenAddress: string, wallet = owner) =>
    rater.connect(wallet).submit(loanTokenAddress, { gasLimit: 4_000_000 })

  describe('Constructor', () => {
    it('sets trust token address', async () => {
      expect(await rater.trustToken()).to.equal(trustToken.address)
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
    })
  })

  describe('Submiting/Retracting loan', () => {
    it('creates loan', async () => {
      await submit(loanToken.address)

      const loan = await rater.loans(loanToken.address)
      expect(loan.timestamp).to.be.gt(0)
      expect(loan.creator).to.equal(owner.address)
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
      await submit(loanToken.address, otherWallet)

      await expect(rater.retract(loanToken.address))
        .to.be.revertedWith('TrueRatingAgency: Not sender\'s loan')
    })
  })

  describe('Voting', () => {
    beforeEach(async () => {
      await submit(loanToken.address)
    })

    describe('Yes', () => {
      it('transfers funds from voter', async () => {
        const balanceBefore = await trustToken.balanceOf(owner.address)
        await rater.yes(loanToken.address, stake)
        const balanceAfter = await trustToken.balanceOf(owner.address)
        expect(balanceAfter.add(stake)).to.equal(balanceBefore)
      })

      it('transfers funds to lender contract', async () => {
        const balanceBefore = await trustToken.balanceOf(rater.address)
        await rater.yes(loanToken.address, stake)
        const balanceAfter = await trustToken.balanceOf(rater.address)
        expect(balanceAfter.sub(stake)).to.equal(balanceBefore)
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
    })

    describe('No', () => {
      it('transfers funds from voter', async () => {
        const balanceBefore = await trustToken.balanceOf(owner.address)
        await rater.no(loanToken.address, stake)
        const balanceAfter = await trustToken.balanceOf(owner.address)
        expect(balanceAfter.add(stake)).to.equal(balanceBefore)
      })

      it('transfers funds to lender contract', async () => {
        const balanceBefore = await trustToken.balanceOf(rater.address)
        await rater.no(loanToken.address, stake)
        const balanceAfter = await trustToken.balanceOf(rater.address)
        expect(balanceAfter.sub(stake)).to.equal(balanceBefore)
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
        await expect(rater.withdraw(loanToken.address, stake))
          .to.be.revertedWith('TrueRatingAgency: Cannot withdraw more than was staked')
      })

      it('properly reduces stakers voting balance (yes)', async () => {
        await rater.yes(loanToken.address, stake * 3)
        await rater.withdraw(loanToken.address, stake)

        expect(await rater.getYesVote(loanToken.address, owner.address))
          .to.be.equal(stake * 2)
        expect(await rater.getNoVote(loanToken.address, owner.address))
          .to.be.equal(0)
      })

      it('properly reduces stakers voting balance (no)', async () => {
        await rater.no(loanToken.address, stake * 3)
        await rater.withdraw(loanToken.address, stake)

        expect(await rater.getNoVote(loanToken.address, owner.address))
          .to.be.equal(stake * 2)
        expect(await rater.getYesVote(loanToken.address, owner.address))
          .to.be.equal(0)
      })

      it('reverts if tried to withdraw more than was voted', async () => {
        await rater.yes(loanToken.address, stake)
        await expect(rater.withdraw(loanToken.address, stake * 2))
          .to.be.revertedWith('TrueRatingAgency: Cannot withdraw more than was staked')
      })

      it('reverts if loan was funded and is currently running', async () => {
        await rater.yes(loanToken.address, stake)
        await loanToken.fund()
        await expect(rater.withdraw(loanToken.address, stake))
          .to.be.revertedWith('TrueRatingAgency: Loan is currently running')
      })

      describe('Retracted', () => {
        beforeEach(async () => {
          await rater.yes(loanToken.address, stake)
          await rater.retract(loanToken.address)
        })

        it('properly sends unchanged amount of tokens', async () => {
          const balanceBefore = await trustToken.balanceOf(owner.address)
          await rater.withdraw(loanToken.address, stake)
          const balanceAfter = await trustToken.balanceOf(owner.address)
          expect(balanceAfter.sub(stake)).to.equal(balanceBefore)
        })

        it('leaves total loan votes at zero', async () => {
          const totalVotedBefore = await rater.getTotalYesVotes(loanToken.address)
          await rater.withdraw(loanToken.address, stake)
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
          const balanceBefore = await trustToken.balanceOf(owner.address)
          await rater.withdraw(loanToken.address, stake)
          const balanceAfter = await trustToken.balanceOf(owner.address)
          expect(balanceAfter.sub(stake)).to.equal(balanceBefore)
        })

        it('reduces total loan votes', async () => {
          const totalVotedBefore = await rater.getTotalYesVotes(loanToken.address)
          await rater.withdraw(loanToken.address, stake)
          const totalVotedAfter = await rater.getTotalYesVotes(loanToken.address)

          expect(totalVotedBefore).to.equal(stake)
          expect(totalVotedAfter).to.equal(0)
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
          await loanToken.withdraw(owner.address)
          await tusd.transfer(loanToken.address, await loanToken.debt())
          await timeTravel(provider, monthInSeconds * 24)
          await loanToken.close()
          expect(await rater.status(loanToken.address)).to.equal(LoanStatus.Settled)
        }

        beforeEach(async () => {
          await vote(stake, true)
        })

        it('nobody voted no: yes-voters do not receive bounty', async () => {
          await settleLoan()
          await expectTrustTokenBalanceChange(() => rater.withdraw(loanToken.address, stake), stake)
        })

        it('no votes = yes votes, yes voters get 75% of 25% of no voters', async () => {
          await vote(stake, false, otherWallet)
          await settleLoan()
          await expectTrustTokenBalanceChange(() => rater.withdraw(loanToken.address, stake), stake * 1.1875) // 1+1*0.25*0.75 = 1.1875
        })

        it('no votes = yes votes, yes voter withdraws in tranches', async () => {
          await vote(stake, false, otherWallet)
          await settleLoan()
          await expectTrustTokenBalanceChange(() => rater.withdraw(loanToken.address, stake * 0.4), stake * 0.4 * 1.1875)
          await expectTrustTokenBalanceChange(() => rater.withdraw(loanToken.address, stake * 0.4), stake * 0.4 * 1.1875)
          await expectTrustTokenBalanceChange(() => rater.withdraw(loanToken.address, stake * 0.2), stake * 0.2 * 1.1875)
        })

        it('2 yes staker, 1 no staker with 1/4 of yes votes', async () => {
          await vote(stake, true, otherWallet)
          await vote(stake / 2, false, wallets[0])
          await settleLoan()
          await expectTrustTokenBalanceChange(() => rater.withdraw(loanToken.address, stake), stake * 1.046875) // 1+0.25*0.25*0.75 = 1.046875
          await expectTrustTokenBalanceChange(() => rater.connect(otherWallet).withdraw(loanToken.address, stake), stake * 1.046875, otherWallet)
        })

        it('no votes = yes votes, no voters get 75%', async () => {
          await vote(stake, false, otherWallet)
          await settleLoan()
          await expectTrustTokenBalanceChange(() => rater.connect(otherWallet).withdraw(loanToken.address, stake), stake * 0.75, otherWallet)
        })

        it('no votes < yes votes, no voters get 75%', async () => {
          await vote(stake / 2, false, otherWallet)
          await settleLoan()
          await expectTrustTokenBalanceChange(() => rater.connect(otherWallet).withdraw(loanToken.address, stake / 2), (stake / 2) * 0.75, otherWallet)
        })

        it('25% of stake lost by no voters is burned', async () => {
          const totalSupplyBefore = await trustToken.totalSupply()
          await vote(stake, false, otherWallet)
          await settleLoan()
          await rater.connect(otherWallet).withdraw(loanToken.address, stake)
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
            await rater.connect(otherWallet).withdraw(loanToken.address, stake)
            const totalSupplyAfter = await trustToken.totalSupply()
  
            expect(totalSupplyBefore.sub(totalSupplyAfter)).to.equal(stake * 0.1 * 0.5)
          })

          it('yes voters receive proper amount', async () => {
            await expectTrustTokenBalanceChange(() => rater.withdraw(loanToken.address, stake), stake * (1 + 0.1 * 0.5))            
          })
          
          it('no voters receive proper amount', async () => {
            await expectTrustTokenBalanceChange(() => rater.connect(otherWallet).withdraw(loanToken.address, stake), stake * (1 - 0.1), otherWallet)            
          })
        })

        it('does not change total loan yes votes', async () => {
          await settleLoan()
          await rater.withdraw(loanToken.address, stake)
          expect(await rater.getTotalYesVotes(loanToken.address)).to.equal(stake)
        })

        it('does not change total loan no votes', async () => {
          await vote(stake / 10, false, otherWallet)
          await settleLoan()
          await rater.withdraw(loanToken.address, stake)
          expect(await rater.getTotalNoVotes(loanToken.address)).to.equal(stake / 10)
        })
      })

      describe('Defaulted', () => {
        const defaultLoan = async () => {
          await loanToken.fund()
          await loanToken.withdraw(owner.address)
          await timeTravel(provider, monthInSeconds * 24)
          await loanToken.close()
          expect(await rater.status(loanToken.address)).to.equal(LoanStatus.Defaulted)
        }

        beforeEach(async () => {
          await vote(stake, false)
        })

        it('nobody voted yes: no-voters do not receive bounty', async () => {
          await defaultLoan()
          await expectTrustTokenBalanceChange(() => rater.withdraw(loanToken.address, stake), stake)
        })

        it('no votes = yes votes, no voters get 75% of 25% of yes voters', async () => {
          await vote(stake, true, otherWallet)
          await defaultLoan()
          await expectTrustTokenBalanceChange(() => rater.withdraw(loanToken.address, stake), stake * 1.1875) // 1+1*0.25*0.75 = 1.1875
        })

        it('no votes = yes votes, no voter withdraws in tranches', async () => {
          await vote(stake, true, otherWallet)
          await defaultLoan()
          await expectTrustTokenBalanceChange(() => rater.withdraw(loanToken.address, stake * 0.4), stake * 0.4 * 1.1875)
          await expectTrustTokenBalanceChange(() => rater.withdraw(loanToken.address, stake * 0.4), stake * 0.4 * 1.1875)
          await expectTrustTokenBalanceChange(() => rater.withdraw(loanToken.address, stake * 0.2), stake * 0.2 * 1.1875)
        })

        it('2 no staker, 1 yes staker with 1/4 of no votes', async () => {
          await vote(stake, false, otherWallet)
          await vote(stake / 2, true, wallets[0])
          await defaultLoan()
          await expectTrustTokenBalanceChange(() => rater.withdraw(loanToken.address, stake), stake * 1.046875) // 1+0.25*0.25*0.75 = 1.046875
          await expectTrustTokenBalanceChange(() => rater.connect(otherWallet).withdraw(loanToken.address, stake), stake * 1.046875, otherWallet)
        })

        it('no votes = yes votes, yes voters get 75%', async () => {
          await vote(stake, true, otherWallet)
          await defaultLoan()
          await expectTrustTokenBalanceChange(() => rater.connect(otherWallet).withdraw(loanToken.address, stake), stake * 0.75, otherWallet)
        })

        it('yes votes < no votes, yes voters get 75%', async () => {
          await vote(stake / 2, true, otherWallet)
          await defaultLoan()
          await expectTrustTokenBalanceChange(() => rater.connect(otherWallet).withdraw(loanToken.address, stake / 2), (stake / 2) * 0.75, otherWallet)
        })

        it('25% of stake lost by yes voters is burned', async () => {
          const totalSupplyBefore = await trustToken.totalSupply()
          await vote(stake, true, otherWallet)
          await defaultLoan()
          await rater.connect(otherWallet).withdraw(loanToken.address, stake)
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
            await rater.connect(otherWallet).withdraw(loanToken.address, stake)
            const totalSupplyAfter = await trustToken.totalSupply()
  
            expect(totalSupplyBefore.sub(totalSupplyAfter)).to.equal(stake * 0.1 * 0.5)
          })

          it('no voters receive proper amount', async () => {
            await expectTrustTokenBalanceChange(() => rater.withdraw(loanToken.address, stake), stake * (1 + 0.1 * 0.5))            
          })
          
          it('yes voters receive proper amount', async () => {
            await expectTrustTokenBalanceChange(() => rater.connect(otherWallet).withdraw(loanToken.address, stake), stake * (1 - 0.1), otherWallet)            
          })
        })

        it('does not change total loan yes votes', async () => {
          await vote(stake * 10, true, otherWallet)
          await defaultLoan()
          await rater.withdraw(loanToken.address, stake)
          expect(await rater.getTotalYesVotes(loanToken.address)).to.equal(stake * 10)
        })

        it('does not change total loan no votes', async () => {
          await defaultLoan()
          await rater.withdraw(loanToken.address, stake)
          expect(await rater.getTotalNoVotes(loanToken.address)).to.equal(stake)
        })
      })
    })
  })
})
