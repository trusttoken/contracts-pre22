import { expect } from 'chai'
import { Wallet } from 'ethers'
import { AddressZero } from 'ethers/constants'

import { beforeEachWithFixture } from '../utils/beforeEachWithFixture'

import { TrueRaterFactory } from '../../build/types/TrueRaterFactory'
import { TrueRater } from '../../build/types/TrueRater'
import { TrustTokenFactory } from '../../build/types/TrustTokenFactory'
import { TrustToken } from '../../build/types/TrustToken'
import { parseTT } from '../utils/parseTT'

describe('TrueRater', () => {
  let owner: Wallet
  let otherWallet: Wallet
  let rater: TrueRater
  let trustToken: TrustToken

  const exampleLoanTokenAddress = '0x7dd5a4Eaf5dB6842aB539Cf506CFc6f9C70bb85E'
  const fakeLoanTokenAddress = '0x156b86b8983CC7865076B179804ACC277a1E78C4'
  const stake = 1000

  beforeEachWithFixture(async (_provider, wallets) => {
    [owner, otherWallet] = wallets

    trustToken = await new TrustTokenFactory(owner).deploy()
    await trustToken.initialize()

    rater = await new TrueRaterFactory(owner).deploy(trustToken.address)

    await trustToken.mint(owner.address, parseTT(100000000))
    await trustToken.approve(rater.address, parseTT(100000000))
  })

  describe('Constructor', () => {
    it('sets trust token address', async () => {
      expect(await rater.trustToken()).to.equal(trustToken.address)
    })
  })

  describe('Whitelisting', () => {
    it('changes whitelist status', async () => {
      expect(await rater.borrowers(otherWallet.address)).to.be.false
      await rater.allow(otherWallet.address, true)
      expect(await rater.borrowers(otherWallet.address)).to.be.true
      await rater.allow(otherWallet.address, false)
      expect(await rater.borrowers(otherWallet.address)).to.be.false
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

  describe('Submiting/Retracting loan', () => {
    beforeEach(async () => {
      await rater.allow(owner.address, true)
    })

    it('creates loan loan', async () => {
      await rater.submit(exampleLoanTokenAddress)

      const loan = await rater.loans(exampleLoanTokenAddress)
      expect(loan.timestamp).to.be.gt(0)
      expect(loan.borrower).to.equal(owner.address)
      expect(await rater.getTotalYesVotes(exampleLoanTokenAddress)).to.be.equal(0)
      expect(await rater.getTotalNoVotes(exampleLoanTokenAddress)).to.be.equal(0)
    })

    it('emits event on creation', async () => {
      await expect(rater.submit(exampleLoanTokenAddress))
        .to.emit(rater, 'LoanSubmitted').withArgs(exampleLoanTokenAddress)
    })

    it('emits event on removal', async () => {
      await rater.submit(exampleLoanTokenAddress)

      await expect(rater.retract(exampleLoanTokenAddress))
        .to.emit(rater, 'LoanRetracted').withArgs(exampleLoanTokenAddress)
    })

    it('loan can be removed by borrower', async () => {
      await rater.submit(exampleLoanTokenAddress)
      await rater.retract(exampleLoanTokenAddress)

      const loan = await rater.loans(exampleLoanTokenAddress)
      expect(loan.timestamp).to.gt(0)
      expect(loan.borrower).to.equal(AddressZero)
      expect(await rater.getTotalYesVotes(exampleLoanTokenAddress)).to.be.equal(0)
      expect(await rater.getTotalNoVotes(exampleLoanTokenAddress)).to.be.equal(0)
    })

    it('retracting does not remove information about votes', async () => {
      await rater.submit(exampleLoanTokenAddress)
      await rater.yes(exampleLoanTokenAddress, stake)
      await rater.retract(exampleLoanTokenAddress)
      expect(await rater.getYesVote(exampleLoanTokenAddress, owner.address)).to.be.equal(stake)
    })

    it('if loan is retracted, stakers total vote-based prediction is lost', async () => {
      await rater.submit(exampleLoanTokenAddress)
      await rater.yes(exampleLoanTokenAddress, stake)
      await rater.retract(exampleLoanTokenAddress)
      expect(await rater.getTotalYesVotes(exampleLoanTokenAddress)).to.be.equal(0)
      expect(await rater.getTotalNoVotes(exampleLoanTokenAddress)).to.be.equal(0)
    })

    it('sender should be allowed by owner to create loan', async () => {
      await expect(rater.connect(otherWallet).submit(exampleLoanTokenAddress))
        .to.be.revertedWith('TrueRater: sender not allowed')
    })

    it('reverts on attempt of creating the same loan twice', async () => {
      await rater.submit(exampleLoanTokenAddress)
      await expect(rater.submit(exampleLoanTokenAddress))
        .to.be.revertedWith('TrueRater: loan was already created')
    })

    it('does not allow to resubmit retracted loan', async () => {
      await rater.submit(exampleLoanTokenAddress)
      await rater.retract(exampleLoanTokenAddress)
      await expect(rater.submit(exampleLoanTokenAddress))
        .to.be.revertedWith('TrueRater: loan was already created')
    })

    it('retracting is only possible until loan is funded (only pending phase)')

    it('throws when removing not pending loan', async () => {
      await expect(rater.retract(fakeLoanTokenAddress))
        .to.be.revertedWith('TrueRater: loan is not currently pending')
    })

    it('cannot remove loan created by someone else', async () => {
      await rater.allow(otherWallet.address, true)
      await rater.connect(otherWallet).submit(exampleLoanTokenAddress)

      await expect(rater.retract(exampleLoanTokenAddress))
        .to.be.revertedWith('TrueRater: not retractor\'s loan')
    })
  })

  describe('Voting', () => {
    beforeEach(async () => {
      await rater.allow(owner.address, true)
      await rater.submit(exampleLoanTokenAddress)
    })

    describe('Yes', () => {
      it('transfers funds from voter', async () => {
        const balanceBefore = await trustToken.balanceOf(owner.address)
        await rater.yes(exampleLoanTokenAddress, stake)
        const balanceAfter = await trustToken.balanceOf(owner.address)
        expect(balanceAfter.add(stake)).to.equal(balanceBefore)
      })

      it('transfers funds to lender contract', async () => {
        const balanceBefore = await trustToken.balanceOf(rater.address)
        await rater.yes(exampleLoanTokenAddress, stake)
        const balanceAfter = await trustToken.balanceOf(rater.address)
        expect(balanceAfter.sub(stake)).to.equal(balanceBefore)
      })

      it('keeps track of votes', async () => {
        await rater.yes(exampleLoanTokenAddress, stake)
        await rater.loans(exampleLoanTokenAddress)
        expect(await rater.getYesVote(exampleLoanTokenAddress, owner.address)).to.be.equal(stake)
        expect(await rater.getNoVote(exampleLoanTokenAddress, owner.address)).to.be.equal(0)
      })

      it('increases loans yes value', async () => {
        await rater.yes(exampleLoanTokenAddress, stake)
        expect(await rater.getTotalYesVotes(exampleLoanTokenAddress)).to.be.equal(stake)
      })

      it('increases loans yes value when voted multiple times', async () => {
        await rater.yes(exampleLoanTokenAddress, stake)
        await rater.yes(exampleLoanTokenAddress, stake)
        expect(await rater.getTotalYesVotes(exampleLoanTokenAddress)).to.be.equal(stake * 2)
      })

      it('after voting yes, disallows voting no', async () => {
        await rater.yes(exampleLoanTokenAddress, stake)
        await expect(rater.no(exampleLoanTokenAddress, stake))
          .to.be.revertedWith('TrueRater: can\'t vote both yes and no')
      })

      it('is only possible until loan is funded (only pending phase)')

      it('is only possible for existing loans', async () => {
        await expect(rater.yes(fakeLoanTokenAddress, stake))
          .to.be.revertedWith('TrueRater: loan is not currently pending')
      })
    })

    describe('No', () => {
      it('transfers funds from voter', async () => {
        const balanceBefore = await trustToken.balanceOf(owner.address)
        await rater.no(exampleLoanTokenAddress, stake)
        const balanceAfter = await trustToken.balanceOf(owner.address)
        expect(balanceAfter.add(stake)).to.equal(balanceBefore)
      })

      it('transfers funds to lender contract', async () => {
        const balanceBefore = await trustToken.balanceOf(rater.address)
        await rater.no(exampleLoanTokenAddress, stake)
        const balanceAfter = await trustToken.balanceOf(rater.address)
        expect(balanceAfter.sub(stake)).to.equal(balanceBefore)
      })

      it('keeps track of votes', async () => {
        await rater.no(exampleLoanTokenAddress, stake)
        await rater.loans(exampleLoanTokenAddress)
        expect(await rater.getNoVote(exampleLoanTokenAddress, owner.address)).to.be.equal(stake)
        expect(await rater.getYesVote(exampleLoanTokenAddress, owner.address)).to.be.equal(0)
      })

      it('increases loans no value', async () => {
        await rater.no(exampleLoanTokenAddress, stake)
        expect(await rater.getTotalNoVotes(exampleLoanTokenAddress)).to.be.equal(stake)
      })

      it('increases loans no value when voted multiple times', async () => {
        await rater.no(exampleLoanTokenAddress, stake)
        await rater.no(exampleLoanTokenAddress, stake)
        expect(await rater.getTotalNoVotes(exampleLoanTokenAddress)).to.be.equal(stake * 2)
      })

      it('after voting no, disallows voting no', async () => {
        await rater.no(exampleLoanTokenAddress, stake)
        await expect(rater.yes(exampleLoanTokenAddress, stake))
          .to.be.revertedWith('TrueRater: can\'t vote both yes and no')
      })

      it('is only possible until loan is funded (only pending phase)')

      it('is only possible for existing loans', async () => {
        await expect(rater.no(fakeLoanTokenAddress, stake))
          .to.be.revertedWith('TrueRater: loan is not currently pending')
      })
    })

    describe('Withdraw', () => {
      it('reverts if no vote was placed at all', async () => {
        await expect(rater.withdraw(exampleLoanTokenAddress, stake))
          .to.be.reverted
      })

      it('properly reduces stakers voting balance (yes)', async () => {
        await rater.yes(exampleLoanTokenAddress, stake * 3)
        await rater.withdraw(exampleLoanTokenAddress, stake)

        expect(await rater.getYesVote(exampleLoanTokenAddress, owner.address))
          .to.be.equal(stake * 2)
        expect(await rater.getNoVote(exampleLoanTokenAddress, owner.address))
          .to.be.equal(0)
      })

      it('properly reduces stakers voting balance (no)', async () => {
        await rater.no(exampleLoanTokenAddress, stake * 3)
        await rater.withdraw(exampleLoanTokenAddress, stake)

        expect(await rater.getNoVote(exampleLoanTokenAddress, owner.address))
          .to.be.equal(stake * 2)
        expect(await rater.getYesVote(exampleLoanTokenAddress, owner.address))
          .to.be.equal(0)
      })

      it('reverts if tried to withdraw more than was voted', async () => {
        await rater.yes(exampleLoanTokenAddress, stake)
        await expect(rater.withdraw(exampleLoanTokenAddress, stake * 2))
          .to.be.reverted
      })

      it('reverts if loan was funded and is currently running')

      describe('Retracted', () => {
        beforeEach(async () => {
          await rater.yes(exampleLoanTokenAddress, stake)
          await rater.retract(exampleLoanTokenAddress)
        })

        it('properly sends unchanged amount of tokens', async () => {
          const balanceBefore = await trustToken.balanceOf(owner.address)
          await rater.withdraw(exampleLoanTokenAddress, stake)
          const balanceAfter = await trustToken.balanceOf(owner.address)
          expect(balanceAfter.sub(stake)).to.equal(balanceBefore)
        })

        it('leaves total loan votes at zero', async () => {
          const totalVotedBefore = await rater.getTotalYesVotes(exampleLoanTokenAddress)
          await rater.withdraw(exampleLoanTokenAddress, stake)
          const totalVotedAfter = await rater.getTotalYesVotes(exampleLoanTokenAddress)

          expect(totalVotedBefore).to.equal(0)
          expect(totalVotedAfter).to.equal(0)
        })
      })

      describe('Pending', () => {
        beforeEach(async () => {
          await rater.yes(exampleLoanTokenAddress, stake)
        })

        it('properly sends unchanged amount of tokens', async () => {
          const balanceBefore = await trustToken.balanceOf(owner.address)
          await rater.withdraw(exampleLoanTokenAddress, stake)
          const balanceAfter = await trustToken.balanceOf(owner.address)
          expect(balanceAfter.sub(stake)).to.equal(balanceBefore)
        })

        it('reduces total loan votes', async () => {
          const totalVotedBefore = await rater.getTotalYesVotes(exampleLoanTokenAddress)
          await rater.withdraw(exampleLoanTokenAddress, stake)
          const totalVotedAfter = await rater.getTotalYesVotes(exampleLoanTokenAddress)

          expect(totalVotedBefore).to.equal(stake)
          expect(totalVotedAfter).to.equal(0)
        })
      })

      describe('Running', () => {
        it('reverts')
      })

      describe('Settled', () => {
        it('properly sends tokens with bonus to yes voters')

        it('properly sends tokens with penalty to no voters')

        it('does not change total loan yes votes')

        it('does not change total loan no votes')
      })

      describe('Defaulted', () => {
        it('properly sends tokens with bonus to no voters')

        it('properly sends tokens with penalty to yes voters')

        it('does not change total loan yes votes')

        it('does not change total loan no votes')
      })
    })
  })
})
