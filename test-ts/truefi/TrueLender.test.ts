import { expect } from 'chai'
import { Contract, ContractTransaction, Wallet } from 'ethers'
import { AddressZero, MaxUint256 } from 'ethers/constants'

import { beforeEachWithFixture } from '../utils/beforeEachWithFixture'

import { TrueLenderFactory } from '../../build/types/TrueLenderFactory'
import { TrueLender } from '../../build/types/TrueLender'
import { MockTrueCurrency } from '../../build/types/MockTrueCurrency'
import { MockTrueCurrencyFactory } from '../../build/types/MockTrueCurrencyFactory'
import { TrustTokenFactory } from '../../build/types/TrustTokenFactory'
import { TrustToken } from '../../build/types/TrustToken'
import ITruePoolJson from '../../build/ITruePool.json'
import { deployMockContract } from 'ethereum-waffle'
import { parseEther } from 'ethers/utils'
import { parseTT } from '../utils/parseTT'
import { timeTravel } from '../utils/timeTravel'
import { JsonRpcProvider } from 'ethers/providers'

describe('TrueLender', () => {
  let owner: Wallet
  let otherWallet: Wallet
  let lendingPool: TrueLender
  let tusd: MockTrueCurrency
  let trustToken: TrustToken
  let underlyingPool: Contract
  let provider: JsonRpcProvider

  const dayInSeconds = 60 * 60 * 24
  const monthInSeconds = dayInSeconds * 30

  const extractApplicationId = async (submitTransaction: ContractTransaction) => ((await submitTransaction.wait()).events[0].args as any).id

  beforeEachWithFixture(async (_provider, wallets) => {
    [owner, otherWallet] = wallets
    provider = _provider

    tusd = await new MockTrueCurrencyFactory(owner).deploy()
    await tusd.initialize()

    trustToken = await new TrustTokenFactory(owner).deploy()
    await trustToken.initialize()
    await trustToken.mint(owner.address, parseTT(100000000))

    underlyingPool = await deployMockContract(owner, ITruePoolJson.abi)
    await underlyingPool.mock.currencyToken.returns(tusd.address)
    lendingPool = await new TrueLenderFactory(owner).deploy(underlyingPool.address, trustToken.address)

    await trustToken.approve(lendingPool.address, parseTT(100000000))
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

  describe.skip('Submiting/Retracting application', () => {
    beforeEach(async () => {
      await lendingPool.allow(owner.address, true)
    })

    it('creates loan application', async () => {
      const tx = await lendingPool.submit(otherWallet.address, parseEther('2000000'), 1200, monthInSeconds * 12)
      const applicationId = await extractApplicationId(tx)

      const application = await lendingPool.applications(applicationId)
      expect(application.creationBlock).to.equal(11)
      expect(application.timestamp).to.be.gt(0)
      expect(application.borrower).to.equal(owner.address)
      expect(application.beneficiary).to.equal(otherWallet.address)
      expect(application.amount).to.equal(parseEther('2000000'))
      expect(application.apy).to.equal(1200)
      expect(application.duration).to.equal(monthInSeconds * 12)
      expect(application.yeah).to.be.equal(0)
      expect(application.nah).to.be.equal(0)
    })

    it('emits event on creation', async () => {
      await expect(lendingPool.submit(otherWallet.address, parseEther('1000000'), 1300, monthInSeconds * 18))
        .to.emit(lendingPool, 'ApplicationSubmitted').withArgs('0xe4d93541ea22476f', owner.address, otherWallet.address, parseEther('1000000'), 1300, monthInSeconds * 18)
    })

    it('should be allowed to create loan application', async () => {
      await expect(lendingPool.connect(otherWallet).submit(otherWallet.address, parseEther('2000000'), 1200, monthInSeconds * 12))
        .to.be.revertedWith('TrueLender: sender not allowed')
    })

    it('checks loan amount to be within boundaries', async () => {
      await expect(lendingPool.submit(otherWallet.address, parseEther('999999'), 1200, monthInSeconds * 12))
        .to.be.revertedWith('TrueLender: Loan size is out of bounds')
      await expect(lendingPool.submit(otherWallet.address, parseEther('10000001'), 1200, monthInSeconds * 12))
        .to.be.revertedWith('TrueLender: Loan size is out of bounds')
    })

    it('checks APY to be not below minimum', async () => {
      await expect(lendingPool.submit(otherWallet.address, parseEther('1000000'), 900, monthInSeconds * 12))
        .to.be.revertedWith('TrueLender: APY is below minimum')
    })

    it('application can be removed by borrower', async () => {
      const tx = await lendingPool.submit(otherWallet.address, parseEther('2000000'), 1200, monthInSeconds * 12)
      const applicationId = await extractApplicationId(tx)

      await lendingPool.retract(applicationId)

      const application = await lendingPool.applications(applicationId)
      expect(application.creationBlock).to.equal(0)
      expect(application.borrower).to.equal(AddressZero)
      expect(application.beneficiary).to.equal(AddressZero)
      expect(application.amount).to.equal(0)
      expect(application.apy).to.equal(0)
      expect(application.duration).to.equal(0)
    })

    it('throws when removing not existing application', async () => {
      await expect(lendingPool.retract('0xfadedeadbeefface')).to.be.revertedWith('TrueLender: application doesn\'t exist')
    })

    it('cannot remove application created by someone else', async () => {
      await lendingPool.allow(otherWallet.address, true)
      const tx = await lendingPool.connect(otherWallet).submit(otherWallet.address, parseEther('2000000'), 1200, monthInSeconds * 12)
      const applicationId = await extractApplicationId(tx)

      await expect(lendingPool.retract(applicationId)).to.be.revertedWith('TrueLender: not retractor\'s application')
    })

    it('emits event on remove', async () => {
      const tx = await lendingPool.submit(otherWallet.address, parseEther('1000000'), 1300, monthInSeconds * 12)
      const applicationId = await extractApplicationId(tx)

      await expect(lendingPool.retract(applicationId)).to.emit(lendingPool, 'ApplicationRetracted')
    })
  })

  describe.skip('Status', () => {
    enum ApplicationStatus { Pending, Approved, Rejected }
    const loanAmount = '1000000'

    let applicationId: string

    beforeEach(async () => {
      await trustToken.mint(otherWallet.address, parseTT(100000000))
      await trustToken.connect(otherWallet).approve(lendingPool.address, parseTT(100000000))
      await lendingPool.allow(owner.address, true)
      const tx = await lendingPool.submit(otherWallet.address, parseEther(loanAmount), 1000, monthInSeconds * 12)
      applicationId = await extractApplicationId(tx)
    })

    it('returns pending if called during voting period', async () => {
      expect(await lendingPool.status(applicationId)).to.be.equal(ApplicationStatus.Pending)
    })

    it('returns pending not whole voting period passed', async () => {
      await timeTravel(provider, dayInSeconds * 7 - 10)
      expect(await lendingPool.status(applicationId)).to.be.equal(ApplicationStatus.Pending)
    })

    it('returns rejected if voting period passed and noone voted', async () => {
      await timeTravel(provider, dayInSeconds * 7 + 100)
      expect(await lendingPool.status(applicationId)).to.be.equal(ApplicationStatus.Rejected)
    })

    it('returns rejected if not enough yeah votes collected', async () => {
      await lendingPool.yeah(applicationId, parseTT(loanAmount).sub(1))
      await timeTravel(provider, dayInSeconds * 7 + 100)

      expect(await lendingPool.status(applicationId)).to.be.equal(ApplicationStatus.Rejected)
    })

    it('returns rejected if not enough yeah votes collected (bigger participationFactor)', async () => {
      await lendingPool.setParticipationFactor(20000)
      await lendingPool.yeah(applicationId, parseTT(loanAmount).mul(2).sub(1))
      await timeTravel(provider, dayInSeconds * 7 + 100)

      expect(await lendingPool.status(applicationId)).to.be.equal(ApplicationStatus.Rejected)
    })

    it('returns rejected if not enough yeah votes collected (smaller participationFactor)', async () => {
      await lendingPool.setParticipationFactor(5000)
      await lendingPool.yeah(applicationId, parseTT(loanAmount).div(2).sub(1))
      await timeTravel(provider, dayInSeconds * 7 + 100)

      expect(await lendingPool.status(applicationId)).to.be.equal(ApplicationStatus.Rejected)
    })

    it('returns approved if enough yeah votes collected and all votes were yeah', async () => {
      await lendingPool.yeah(applicationId, parseTT(loanAmount))
      await timeTravel(provider, dayInSeconds * 7 + 100)

      expect(await lendingPool.status(applicationId)).to.be.equal(ApplicationStatus.Approved)
    })

    describe('Complex cases', () => {
      interface LoanScenario {
        APY: number,
        duration: number,
        riskAversion: number,
        yeahPercentage: number,
      }

      const scenario = (APY: number, months: number, riskAversion: number, yeahPercentage: number) => ({
        APY: APY * 100,
        duration: monthInSeconds * months,
        riskAversion: riskAversion * 100,
        yeahPercentage,
      })

      const execute = async (loanScenario: LoanScenario) => {
        await lendingPool.setRiskAversion(loanScenario.riskAversion)
        const tx = await lendingPool.submit(otherWallet.address, parseEther(loanAmount), loanScenario.APY, loanScenario.duration)
        applicationId = await extractApplicationId(tx)
        await lendingPool.yeah(applicationId, parseTT(loanAmount).mul(loanScenario.yeahPercentage))
        await lendingPool.connect(otherWallet).nah(applicationId, parseTT(loanAmount).mul(100 - loanScenario.yeahPercentage))
        await timeTravel(provider, dayInSeconds * 7 + 100)
      }

      describe('Approvals', () => {
        const approvedLoanScenarios = [
          scenario(10, 12, 100, 95),
          scenario(25, 12, 100, 80),
          scenario(10, 12, 50, 85),
          scenario(10, 36, 100, 80),
        ]

        approvedLoanScenarios.forEach((loanScenario, index) => {
          it(`approved loan case #${index + 1}`, async () => {
            await execute(loanScenario)
            expect(await lendingPool.status(applicationId)).to.be.equal(ApplicationStatus.Approved)
          })
        })
      })

      describe('Rejections', () => {
        const rejectedLoanScenarios = [
          scenario(10, 12, 100, 85),
          scenario(25, 12, 100, 60),
          scenario(10, 12, 50, 75),
          scenario(10, 36, 100, 70),
        ]

        rejectedLoanScenarios.forEach((loanScenario, index) => {
          it(`rejected loan case #${index + 1}`, async () => {
            await execute(loanScenario)
            expect(await lendingPool.status(applicationId)).to.be.equal(ApplicationStatus.Rejected)
          })
        })
      })
    })
  })
})
