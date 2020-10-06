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
    await trustToken.mint(owner.address, parseTT(1000))

    underlyingPool = await deployMockContract(owner, ITruePoolJson.abi)
    await underlyingPool.mock.currencyToken.returns(tusd.address)
    lendingPool = await new TrueLenderFactory(owner).deploy(underlyingPool.address, trustToken.address)

    await trustToken.approve(lendingPool.address, parseTT(1000))
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
        await expect(lendingPool.setMinApy(1234)).to.emit(lendingPool, 'MinApyChanged').withArgs(1234)
      })

      it('must be called by owner', async () => {
        await expect(lendingPool.connect(otherWallet).setMinApy(1234)).to.be.revertedWith('caller is not the owner')
      })
    })

    describe('setVotingPeriod', () => {
      it('changes votingPeriod', async () => {
        await lendingPool.setVotingPeriod(dayInSeconds * 3)
        expect(await lendingPool.votingPeriod()).to.equal(dayInSeconds * 3)
      })

      it('emits VotingPeriodChanged', async () => {
        await expect(lendingPool.setVotingPeriod(dayInSeconds * 3)).to.emit(lendingPool, 'VotingPeriodChanged').withArgs(dayInSeconds * 3)
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
        await expect(lendingPool.setSizeLimits(7654, 234567)).to.emit(lendingPool, 'SizeLimitsChanged').withArgs(7654, 234567)
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
        await expect(lendingPool.setDurationLimits(7654, 234567)).to.emit(lendingPool, 'DurationLimitsChanged').withArgs(7654, 234567)
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
      expect(await lendingPool.borrowers(otherWallet.address)).to.be.false
      await lendingPool.allow(otherWallet.address, true)
      expect(await lendingPool.borrowers(otherWallet.address)).to.be.true
      await lendingPool.allow(otherWallet.address, false)
      expect(await lendingPool.borrowers(otherWallet.address)).to.be.false
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

  describe('Submiting/Retracting application', () => {
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

  describe('Voting', () => {
    let applicationId: string
    let fakeApplicationId: string

    const stake = 1000
    beforeEach(async () => {
      await lendingPool.allow(owner.address, true)
      await lendingPool.submit(otherWallet.address, parseEther('2000000'), 1200, monthInSeconds * 12)
      applicationId = '0x6fa18b35bc27d09e'
      fakeApplicationId = '0xdeadbeefdadface0'
    })

    describe('Yeah', () => {
      it('transfers funds from voter', async () => {
        const balanceBefore = await trustToken.balanceOf(owner.address)
        await lendingPool.yeah(applicationId, stake)
        const balanceAfter = await trustToken.balanceOf(owner.address)
        expect(balanceAfter.add(stake)).to.equal(balanceBefore)
      })

      it('transfers funds to lender contract', async () => {
        const balanceBefore = await trustToken.balanceOf(lendingPool.address)
        await lendingPool.yeah(applicationId, stake)
        const balanceAfter = await trustToken.balanceOf(lendingPool.address)
        expect(balanceAfter.sub(stake)).to.equal(balanceBefore)
      })

      it('keeps track of votes', async () => {
        await lendingPool.yeah(applicationId, stake)
        await lendingPool.applications(applicationId)
        expect(await lendingPool.getYeahVote(applicationId, owner.address)).to.be.equal(stake)
        expect(await lendingPool.getNahVote(applicationId, owner.address)).to.be.equal(0)
      })

      it('increases applications yeah value', async () => {
        await lendingPool.yeah(applicationId, stake)
        const application = await lendingPool.applications(applicationId)
        expect(application.yeah).to.be.equal(stake)
      })

      it('increases applications yeah value when voted multiple times', async () => {
        await lendingPool.yeah(applicationId, stake)
        await lendingPool.yeah(applicationId, stake)
        const application = await lendingPool.applications(applicationId)
        expect(application.yeah).to.be.equal(stake * 2)
      })

      it('after voting yeah, disallows voting nah', async () => {
        await lendingPool.yeah(applicationId, stake)
        await expect(lendingPool.nah(applicationId, stake)).to.be.revertedWith('TrueLender: can\'t vote both yeah and nah')
      })

      it('is only possible during voting period', async () => {
        await lendingPool.yeah(applicationId, stake)
        timeTravel(provider, dayInSeconds * 8)
        await expect(lendingPool.yeah(applicationId, stake)).to.be.revertedWith('TrueLender: can\'t vote outside the voting period')
      })

      it('is only possible for existing applications', async () => {
        await expect(lendingPool.yeah(fakeApplicationId, stake)).to.be.revertedWith('TrueLender: application doesn\'t exist')
      })
    })

    describe('Nah', () => {
      it('transfers funds from voter', async () => {
        const balanceBefore = await trustToken.balanceOf(owner.address)
        await lendingPool.nah(applicationId, stake)
        const balanceAfter = await trustToken.balanceOf(owner.address)
        expect(balanceAfter.add(stake)).to.equal(balanceBefore)
      })

      it('transfers funds to lender contract', async () => {
        const balanceBefore = await trustToken.balanceOf(lendingPool.address)
        await lendingPool.nah(applicationId, stake)
        const balanceAfter = await trustToken.balanceOf(lendingPool.address)
        expect(balanceAfter.sub(stake)).to.equal(balanceBefore)
      })

      it('keeps track of votes', async () => {
        await lendingPool.nah(applicationId, stake)
        await lendingPool.applications(applicationId)
        expect(await lendingPool.getNahVote(applicationId, owner.address)).to.be.equal(stake)
        expect(await lendingPool.getYeahVote(applicationId, owner.address)).to.be.equal(0)
      })

      it('increases applications nah value', async () => {
        await lendingPool.nah(applicationId, stake)
        const application = await lendingPool.applications(applicationId)
        expect(application.nah).to.be.equal(stake)
      })

      it('increases applications nah value when voted multiple times', async () => {
        await lendingPool.nah(applicationId, stake)
        await lendingPool.nah(applicationId, stake)
        const application = await lendingPool.applications(applicationId)
        expect(application.nah).to.be.equal(stake * 2)
      })

      it('after voting nah, disallows voting nah', async () => {
        await lendingPool.nah(applicationId, stake)
        await expect(lendingPool.yeah(applicationId, stake)).to.be.revertedWith('TrueLender: can\'t vote both yeah and nah')
      })

      it('is only possible during voting period', async () => {
        await lendingPool.nah(applicationId, stake)
        timeTravel(provider, dayInSeconds * 8)
        await expect(lendingPool.nah(applicationId, stake)).to.be.revertedWith('TrueLender: can\'t vote outside the voting period')
      })

      it('is only possible for existing applications', async () => {
        await expect(lendingPool.nah(fakeApplicationId, stake)).to.be.revertedWith('TrueLender: application doesn\'t exist')
      })
    })
  })
})
