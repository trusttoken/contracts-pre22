import { expect } from 'chai'
import { deployMockContract } from 'ethereum-waffle'
import { Contract, Wallet } from 'ethers'
import { MaxUint256, AddressZero } from 'ethers/constants'
import { BigNumber, parseEther } from 'ethers/utils'

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

  let lendingPool: TrueLender

  let tusd: MockTrueCurrency
  let underlyingPool: Contract
  let ratingAgency: Contract

  const dayInSeconds = 60 * 60 * 24
  const monthInSeconds = dayInSeconds * 30

  beforeEachWithFixture(async (_provider, wallets) => {
    [owner, otherWallet] = wallets

    tusd = await new MockTrueCurrencyFactory(owner).deploy()
    await tusd.initialize()

    underlyingPool = await deployMockContract(owner, ITruePoolJson.abi)
    await underlyingPool.mock.currencyToken.returns(tusd.address)

    ratingAgency = await deployMockContract(owner, ITrueRatingAgencyJson.abi)
    await ratingAgency.mock.getResults.returns(0, 0, 0)

    lendingPool = await new TrueLenderFactory(owner).deploy(underlyingPool.address, ratingAgency.address)
  })

  describe('Constructor', () => {
    it('sets the pool address', async () => {
      expect(await lendingPool.pool()).to.equal(underlyingPool.address)
    })

    it('approves infinite amount to underlying pool', async () => {
      expect(await tusd.allowance(lendingPool.address, underlyingPool.address)).to.equal(MaxUint256)
    })

    it('default params', async () => {
      expect(await lendingPool.minSize()).to.equal(parseEther('1000000'))
      expect(await lendingPool.maxSize()).to.equal(parseEther('10000000'))
      expect(await lendingPool.minDuration()).to.equal(monthInSeconds * 6)
      expect(await lendingPool.maxDuration()).to.equal(monthInSeconds * 120)
      expect(await lendingPool.minApy()).to.equal('1000')
      expect(await lendingPool.votingPeriod()).to.equal(dayInSeconds * 7)
    })
  })

  describe('Parameters set up', () => {
    describe('setMinApy', () => {
      it('changes minApy', async () => {
        await lendingPool.setMinApy(1234)
        expect(await lendingPool.minApy()).to.equal(1234)
      })

      it('emits MinApyChanged', async () => {
        await expect(lendingPool.setMinApy(1234))
          .to.emit(lendingPool, 'MinApyChanged').withArgs(1234)
      })

      it('must be called by owner', async () => {
        await expect(lendingPool.connect(otherWallet).setMinApy(1234)).to.be.revertedWith('caller is not the owner')
      })
    })

    describe('setParticipationFactor', () => {
      it('changes participationFactor', async () => {
        await lendingPool.setParticipationFactor(1234)
        expect(await lendingPool.participationFactor()).to.equal(1234)
      })

      it('emits ParticipationFactorChanged', async () => {
        await expect(lendingPool.setParticipationFactor(1234))
          .to.emit(lendingPool, 'ParticipationFactorChanged').withArgs(1234)
      })

      it('must be called by owner', async () => {
        await expect(lendingPool.connect(otherWallet).setParticipationFactor(1234)).to.be.revertedWith('caller is not the owner')
      })
    })

    describe('setRiskAversion', () => {
      it('changes riskAversion', async () => {
        await lendingPool.setRiskAversion(1234)
        expect(await lendingPool.riskAversion()).to.equal(1234)
      })

      it('emits RiskAversionChanged', async () => {
        await expect(lendingPool.setRiskAversion(1234))
          .to.emit(lendingPool, 'RiskAversionChanged').withArgs(1234)
      })

      it('must be called by owner', async () => {
        await expect(lendingPool.connect(otherWallet).setRiskAversion(1234)).to.be.revertedWith('caller is not the owner')
      })
    })

    describe('setVotingPeriod', () => {
      it('changes votingPeriod', async () => {
        await lendingPool.setVotingPeriod(dayInSeconds * 3)
        expect(await lendingPool.votingPeriod()).to.equal(dayInSeconds * 3)
      })

      it('emits VotingPeriodChanged', async () => {
        await expect(lendingPool.setVotingPeriod(dayInSeconds * 3))
          .to.emit(lendingPool, 'VotingPeriodChanged').withArgs(dayInSeconds * 3)
      })

      it('must be called by owner', async () => {
        await expect(lendingPool.connect(otherWallet).setVotingPeriod(dayInSeconds * 3)).to.be.revertedWith('caller is not the owner')
      })
    })

    describe('setSizeLimits', () => {
      it('changes minSize and maxSize', async () => {
        await lendingPool.setSizeLimits(7654, 234567)
        expect(await lendingPool.minSize()).to.equal(7654)
        expect(await lendingPool.maxSize()).to.equal(234567)
      })

      it('emits SizeLimitsChanged', async () => {
        await expect(lendingPool.setSizeLimits(7654, 234567))
          .to.emit(lendingPool, 'SizeLimitsChanged').withArgs(7654, 234567)
      })

      it('must be called by owner', async () => {
        await expect(lendingPool.connect(otherWallet).setSizeLimits(7654, 234567)).to.be.revertedWith('caller is not the owner')
      })

      it('cannot set minSize to be bigger than maxSize', async () => {
        await expect(lendingPool.setSizeLimits(2, 1)).to.be.revertedWith('TrueLender: Maximal loan size is smaller than minimal')
      })

      it('can set minSize to same value as maxSize', async () => {
        await expect(lendingPool.setSizeLimits(2, 2)).to.be.not.reverted
      })
    })

    describe('setDurationLimits', () => {
      it('changes minDuration and maxDuration', async () => {
        await lendingPool.setDurationLimits(7654, 234567)
        expect(await lendingPool.minDuration()).to.equal(7654)
        expect(await lendingPool.maxDuration()).to.equal(234567)
      })

      it('emits DurationLimitsChanged', async () => {
        await expect(lendingPool.setDurationLimits(7654, 234567))
          .to.emit(lendingPool, 'DurationLimitsChanged').withArgs(7654, 234567)
      })

      it('must be called by owner', async () => {
        await expect(lendingPool.connect(otherWallet).setDurationLimits(7654, 234567)).to.be.revertedWith('caller is not the owner')
      })

      it('cannot set minDuration to be bigger than maxDuration', async () => {
        await expect(lendingPool.setDurationLimits(2, 1)).to.be.revertedWith('TrueLender: Maximal loan duration is smaller than minimal')
      })

      it('can set minDuration to same value as maxDuration', async () => {
        await expect(lendingPool.setDurationLimits(2, 2)).to.be.not.reverted
      })
    })
  })

  describe('Whitelisting', () => {
    it('changes whitelist status', async () => {
      expect(await lendingPool.allowedBorrowers(otherWallet.address)).to.be.false
      await lendingPool.allow(otherWallet.address, true)
      expect(await lendingPool.allowedBorrowers(otherWallet.address)).to.be.true
      await lendingPool.allow(otherWallet.address, false)
      expect(await lendingPool.allowedBorrowers(otherWallet.address)).to.be.false
    })

    it('emits event', async () => {
      await expect(lendingPool.allow(otherWallet.address, true))
        .to.emit(lendingPool, 'Allowed').withArgs(otherWallet.address, true)
      await expect(lendingPool.allow(otherWallet.address, false))
        .to.emit(lendingPool, 'Allowed').withArgs(otherWallet.address, false)
    })

    it('reverts when performed by non-owner', async () => {
      await expect(lendingPool.connect(otherWallet).allow(otherWallet.address, true))
        .to.be.revertedWith('caller is not the owner')
    })
  })

  describe('Funding', () => {
    let mockLoanToken: Contract
    let amount: BigNumber
    let apy: BigNumber
    let duration: BigNumber

    beforeEach(async () => {
      mockLoanToken = await deployMockContract(owner, ILoanTokenJson.abi)
      await mockLoanToken.mock.isLoanToken.returns(true)

      await lendingPool.allow(owner.address, true)

      amount = (await lendingPool.minSize()).mul(2)
      apy = (await lendingPool.minApy()).mul(2)
      duration = (await lendingPool.minDuration()).mul(2)
    })

    it('reverts if passed address is not a LoanToken', async () => {
      await expect(lendingPool.fund(AddressZero))
        .to.be.reverted
      await expect(lendingPool.fund(otherWallet.address))
        .to.be.reverted
    })

    it('reverts if loan size is out of bounds (too small)', async () => {
      await mockLoanToken.mock.getParameters.returns(amount.div(10), apy, duration)
      await expect(lendingPool.fund(mockLoanToken.address))
        .to.be.revertedWith('TrueLender: Loan size is out of bounds')
    })

    it('reverts if loan size is out of bounds (too big)', async () => {
      await mockLoanToken.mock.getParameters.returns(amount.mul(10000), apy, duration)
      await expect(lendingPool.fund(mockLoanToken.address))
        .to.be.revertedWith('TrueLender: Loan size is out of bounds')
    })

    it('reverts if loan duration is out of bounds (too short)', async () => {
      await mockLoanToken.mock.getParameters.returns(amount, apy, duration.div(10))
      await expect(lendingPool.fund(mockLoanToken.address))
        .to.be.revertedWith('TrueLender: Loan duration is out of bounds')
    })

    it('reverts if loan duration is out of bounds (too long)', async () => {
      await mockLoanToken.mock.getParameters.returns(amount, apy, duration.mul(100))
      await expect(lendingPool.fund(mockLoanToken.address))
        .to.be.revertedWith('TrueLender: Loan duration is out of bounds')
    })

    it('reverts if loan has to small APY', async () => {
      await mockLoanToken.mock.getParameters.returns(amount, apy.div(10), duration)
      await expect(lendingPool.fund(mockLoanToken.address))
        .to.be.revertedWith('TrueLender: APY is below minimum')
    })

    it('reverts if loan was not long enough under voting')

    it('reverts if absolute amount out yes votes is not enough in relation to loan size')

    it('reverts if loan is predicted to be too risky')

    describe('all requirements are met', () => {
      it('borrows tokens from pool')

      it('approves LoanToken to spend funds borrowed from pool')

      it('calls fund function')

      it('emits proper event')
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
        await lendingPool.setRiskAversion(loanScenario.riskAversion)
        return lendingPool.loanIsCredible(
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
})
