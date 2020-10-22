import { expect } from 'chai'
import { deployMockContract } from 'ethereum-waffle'
import { Contract, Wallet, BigNumber } from 'ethers'
import { AddressZero, MaxUint256 } from '@ethersproject/constants'
import { parseEther } from '@ethersproject/units'

import { beforeEachWithFixture } from '../utils/beforeEachWithFixture'

import { TrueLender } from '../../build/types/TrueLender'
import { TrueLenderFactory } from '../../build/types/TrueLenderFactory'
import { MockTrueCurrency } from '../../build/types/MockTrueCurrency'
import { MockTrueCurrencyFactory } from '../../build/types/MockTrueCurrencyFactory'

import ITruePoolJson from '../../build/ITruePool.json'
import ILoanTokenJson from '../../build/ILoanToken.json'
import ITrueRatingAgencyJson from '../../build/ITrueRatingAgency.json'

describe('TrueLender', () => {
  let owner: Wallet
  let otherWallet: Wallet

  let lender: TrueLender

  let tusd: MockTrueCurrency
  let mockPool: Contract
  let mockLoanToken: Contract
  let mockRatingAgency: Contract

  let amount: BigNumber
  let apy: BigNumber
  let duration: BigNumber

  const dayInSeconds = 60 * 60 * 24
  const monthInSeconds = dayInSeconds * 30

  beforeEachWithFixture(async (wallets) => {
    [owner, otherWallet] = wallets

    tusd = await new MockTrueCurrencyFactory(owner).deploy()
    await tusd.initialize()

    mockPool = await deployMockContract(owner, ITruePoolJson.abi)
    await mockPool.mock.currencyToken.returns(tusd.address)
    await mockPool.mock.borrow.returns()

    mockLoanToken = await deployMockContract(owner, ILoanTokenJson.abi)
    await mockLoanToken.mock.isLoanToken.returns(true)
    await mockLoanToken.mock.fund.returns()

    mockRatingAgency = await deployMockContract(owner, ITrueRatingAgencyJson.abi)
    await mockRatingAgency.mock.getResults.returns(0, 0, 0)

    lender = await new TrueLenderFactory(owner).deploy(mockPool.address, mockRatingAgency.address)

    amount = (await lender.minSize()).mul(2)
    apy = (await lender.minApy()).mul(2)
    duration = (await lender.minDuration()).mul(2)
    await mockLoanToken.mock.getParameters.returns(amount, apy, duration)
  })

  describe('Constructor', () => {
    it('sets the pool address', async () => {
      expect(await lender.pool()).to.equal(mockPool.address)
    })

    it('approves infinite amount to underlying pool', async () => {
      expect(await tusd.allowance(lender.address, mockPool.address)).to.equal(MaxUint256)
    })

    it('default params', async () => {
      expect(await lender.minSize()).to.equal(parseEther('1000000'))
      expect(await lender.maxSize()).to.equal(parseEther('10000000'))
      expect(await lender.minDuration()).to.equal(monthInSeconds * 6)
      expect(await lender.maxDuration()).to.equal(monthInSeconds * 120)
      expect(await lender.minApy()).to.equal('1000')
      expect(await lender.votingPeriod()).to.equal(dayInSeconds * 7)
    })
  })

  describe('Parameters set up', () => {
    describe('setMinApy', () => {
      it('changes minApy', async () => {
        await lender.setMinApy(1234)
        expect(await lender.minApy()).to.equal(1234)
      })

      it('emits MinApyChanged', async () => {
        await expect(lender.setMinApy(1234))
          .to.emit(lender, 'MinApyChanged').withArgs(1234)
      })

      it('must be called by owner', async () => {
        await expect(lender.connect(otherWallet).setMinApy(1234)).to.be.revertedWith('caller is not the owner')
      })
    })

    describe('setParticipationFactor', () => {
      it('changes participationFactor', async () => {
        await lender.setParticipationFactor(1234)
        expect(await lender.participationFactor()).to.equal(1234)
      })

      it('emits ParticipationFactorChanged', async () => {
        await expect(lender.setParticipationFactor(1234))
          .to.emit(lender, 'ParticipationFactorChanged').withArgs(1234)
      })

      it('must be called by owner', async () => {
        await expect(lender.connect(otherWallet).setParticipationFactor(1234)).to.be.revertedWith('caller is not the owner')
      })
    })

    describe('setRiskAversion', () => {
      it('changes riskAversion', async () => {
        await lender.setRiskAversion(1234)
        expect(await lender.riskAversion()).to.equal(1234)
      })

      it('emits RiskAversionChanged', async () => {
        await expect(lender.setRiskAversion(1234))
          .to.emit(lender, 'RiskAversionChanged').withArgs(1234)
      })

      it('must be called by owner', async () => {
        await expect(lender.connect(otherWallet).setRiskAversion(1234)).to.be.revertedWith('caller is not the owner')
      })
    })

    describe('setVotingPeriod', () => {
      it('changes votingPeriod', async () => {
        await lender.setVotingPeriod(dayInSeconds * 3)
        expect(await lender.votingPeriod()).to.equal(dayInSeconds * 3)
      })

      it('emits VotingPeriodChanged', async () => {
        await expect(lender.setVotingPeriod(dayInSeconds * 3))
          .to.emit(lender, 'VotingPeriodChanged').withArgs(dayInSeconds * 3)
      })

      it('must be called by owner', async () => {
        await expect(lender.connect(otherWallet).setVotingPeriod(dayInSeconds * 3)).to.be.revertedWith('caller is not the owner')
      })
    })

    describe('setSizeLimits', () => {
      it('changes minSize and maxSize', async () => {
        await lender.setSizeLimits(7654, 234567)
        expect(await lender.minSize()).to.equal(7654)
        expect(await lender.maxSize()).to.equal(234567)
      })

      it('emits SizeLimitsChanged', async () => {
        await expect(lender.setSizeLimits(7654, 234567))
          .to.emit(lender, 'SizeLimitsChanged').withArgs(7654, 234567)
      })

      it('must be called by owner', async () => {
        await expect(lender.connect(otherWallet).setSizeLimits(7654, 234567)).to.be.revertedWith('caller is not the owner')
      })

      it('cannot set minSize to be bigger than maxSize', async () => {
        await expect(lender.setSizeLimits(2, 1)).to.be.revertedWith('TrueLender: Maximal loan size is smaller than minimal')
      })

      it('can set minSize to same value as maxSize', async () => {
        await expect(lender.setSizeLimits(2, 2)).to.be.not.reverted
      })
    })

    describe('setDurationLimits', () => {
      it('changes minDuration and maxDuration', async () => {
        await lender.setDurationLimits(7654, 234567)
        expect(await lender.minDuration()).to.equal(7654)
        expect(await lender.maxDuration()).to.equal(234567)
      })

      it('emits DurationLimitsChanged', async () => {
        await expect(lender.setDurationLimits(7654, 234567))
          .to.emit(lender, 'DurationLimitsChanged').withArgs(7654, 234567)
      })

      it('must be called by owner', async () => {
        await expect(lender.connect(otherWallet).setDurationLimits(7654, 234567)).to.be.revertedWith('caller is not the owner')
      })

      it('cannot set minDuration to be bigger than maxDuration', async () => {
        await expect(lender.setDurationLimits(2, 1)).to.be.revertedWith('TrueLender: Maximal loan duration is smaller than minimal')
      })

      it('can set minDuration to same value as maxDuration', async () => {
        await expect(lender.setDurationLimits(2, 2)).to.be.not.reverted
      })
    })
  })

  describe('Whitelisting', () => {
    it('changes whitelist status', async () => {
      expect(await lender.allowedBorrowers(otherWallet.address)).to.be.false
      await lender.allow(otherWallet.address, true)
      expect(await lender.allowedBorrowers(otherWallet.address)).to.be.true
      await lender.allow(otherWallet.address, false)
      expect(await lender.allowedBorrowers(otherWallet.address)).to.be.false
    })

    it('emits event', async () => {
      await expect(lender.allow(otherWallet.address, true))
        .to.emit(lender, 'Allowed').withArgs(otherWallet.address, true)
      await expect(lender.allow(otherWallet.address, false))
        .to.emit(lender, 'Allowed').withArgs(otherWallet.address, false)
    })

    it('reverts when performed by non-owner', async () => {
      await expect(lender.connect(otherWallet).allow(otherWallet.address, true))
        .to.be.revertedWith('caller is not the owner')
    })
  })

  describe('Funding', () => {
    beforeEach(async () => {
      await lender.allow(owner.address, true)
    })

    it('reverts if passed address is not a LoanToken', async () => {
      await expect(lender.fund(AddressZero))
        .to.be.reverted
      await expect(lender.fund(otherWallet.address))
        .to.be.reverted
    })

    it('reverts if sender is not an allowed borrower', async () => {
      await expect(lender.connect(otherWallet).fund(mockLoanToken.address))
        .to.be.revertedWith('TrueLender: Sender is not allowed to borrow')
    })

    it('reverts if loan size is out of bounds (too small)', async () => {
      await mockLoanToken.mock.getParameters.returns(amount.div(10), apy, duration)
      await expect(lender.fund(mockLoanToken.address))
        .to.be.revertedWith('TrueLender: Loan size is out of bounds')
    })

    it('reverts if loan size is out of bounds (too big)', async () => {
      await mockLoanToken.mock.getParameters.returns(amount.mul(10000), apy, duration)
      await expect(lender.fund(mockLoanToken.address))
        .to.be.revertedWith('TrueLender: Loan size is out of bounds')
    })

    it('reverts if loan duration is out of bounds (too short)', async () => {
      await mockLoanToken.mock.getParameters.returns(amount, apy, duration.div(10))
      await expect(lender.fund(mockLoanToken.address))
        .to.be.revertedWith('TrueLender: Loan duration is out of bounds')
    })

    it('reverts if loan duration is out of bounds (too long)', async () => {
      await mockLoanToken.mock.getParameters.returns(amount, apy, duration.mul(100))
      await expect(lender.fund(mockLoanToken.address))
        .to.be.revertedWith('TrueLender: Loan duration is out of bounds')
    })

    it('reverts if loan has to small APY', async () => {
      await mockLoanToken.mock.getParameters.returns(amount, apy.div(10), duration)
      await expect(lender.fund(mockLoanToken.address))
        .to.be.revertedWith('TrueLender: APY is below minimum')
    })

    it('reverts if loan was not long enough under voting', async () => {
      const { timestamp } = (await owner.provider.getBlock('latest'))
      await mockRatingAgency.mock.getResults.returns(timestamp, 0, amount.mul(100))
      await expect(lender.fund(mockLoanToken.address))
        .to.be.revertedWith('TrueLender: Voting time is below minimum')
    })

    it('reverts if absolute amount out yes votes is not enough in relation to loan size', async () => {
      await mockRatingAgency.mock.getResults.returns(0, 0, 10)
      await expect(lender.fund(mockLoanToken.address))
        .to.be.revertedWith('TrueLender: Not enough votes given for the loan')
    })

    it('reverts if loan is predicted to be too risky', async () => {
      await mockRatingAgency.mock.getResults.returns(0, amount.mul(10), amount.div(10))
      await expect(lender.fund(mockLoanToken.address))
        .to.be.revertedWith('TrueLender: Loan risk is too high')
    })

    describe('all requirements are met', () => {
      beforeEach(async () => {
        await mockLoanToken.mock.getParameters.returns(amount, apy, duration)
        await mockRatingAgency.mock.getResults.returns(dayInSeconds * 14, 0, amount.mul(10))
      })

      it('borrows tokens from pool', async () => {
        await lender.fund(mockLoanToken.address)
        expect('borrow').to.be.calledOnContractWith(mockPool, [amount])
      })

      it('approves LoanToken to spend funds borrowed from pool', async () => {
        await lender.fund(mockLoanToken.address)
        expect(await tusd.allowance(lender.address, mockLoanToken.address))
          .to.equal(amount)
      })

      it('calls fund function', async () => {
        await lender.fund(mockLoanToken.address)
        expect('fund').to.be.calledOnContractWith(mockLoanToken, [])
      })

      it('emits proper event', async () => {
        await expect(lender.fund(mockLoanToken.address))
          .to.emit(lender, 'Funded')
          .withArgs(mockLoanToken.address, amount)
      })
    })

    describe('complex credibility cases', () => {
      interface LoanScenario {
        APY: number,
        duration: number,
        riskAversion: number,
        yesPercentage: number,
      }

      const scenario = (APY: number, months: number, riskAversion: number, yesPercentage: number) => ({
        APY: APY * 100,
        duration: monthInSeconds * months,
        riskAversion: riskAversion * 100,
        yesPercentage,
      })

      const loanIsCredible = async (loanScenario: LoanScenario) => {
        await lender.setRiskAversion(loanScenario.riskAversion)
        return lender.loanIsCredible(
          loanScenario.APY,
          loanScenario.duration,
          (loanScenario.yesPercentage) * 1000,
          (100 - loanScenario.yesPercentage) * 1000,
        )
      }

      describe('approvals', () => {
        const approvedLoanScenarios = [
          scenario(10, 12, 100, 95),
          scenario(25, 12, 100, 80),
          scenario(10, 12, 50, 85),
          scenario(10, 36, 100, 80),
        ]

        approvedLoanScenarios.forEach((loanScenario, index) => {
          it(`approved loan case #${index + 1}`, async () => {
            expect(await loanIsCredible(loanScenario)).to.be.true
          })
        })
      })

      describe('rejections', () => {
        const rejectedLoanScenarios = [
          scenario(10, 12, 100, 85),
          scenario(25, 12, 100, 60),
          scenario(10, 12, 50, 75),
          scenario(10, 36, 100, 70),
        ]

        rejectedLoanScenarios.forEach((loanScenario, index) => {
          it(`rejected loan case #${index + 1}`, async () => {
            expect(await loanIsCredible(loanScenario)).to.be.false
          })
        })
      })
    })
  })

  describe('Reclaiming', () => {
      it('works only for loan tokens')

      it('works only for closed loans')

      it('reclaims funds from loan token')
      
      it('repays funds from the pool')
      
      it('emits a proper event')
  })
})
