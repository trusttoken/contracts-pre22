import { expect } from 'chai'
import { deployMockContract, MockContract } from 'ethereum-waffle'
import { Contract, Wallet, BigNumber, providers } from 'ethers'
import { AddressZero, MaxUint256 } from '@ethersproject/constants'
import { parseEther } from '@ethersproject/units'

import {
  beforeEachWithFixture,
  timeTravel,
  expectCloseTo,
} from 'utils'

import {
  MockTrueLender,
  MockTrueLenderFactory,
  LoanToken,
  LoanTokenFactory,
  MockTrueCurrency,
  MockTrueCurrencyFactory,
  ITrueFiPoolJson,
  ILoanTokenJson,
  ITrueRatingAgencyJson,
} from 'contracts'

describe('TrueLender', () => {
  let owner: Wallet
  let otherWallet: Wallet
  let provider: providers.JsonRpcProvider

  let lender: MockTrueLender

  let tusd: MockTrueCurrency
  let mockPool: Contract
  let mockLoanToken: Contract
  let mockRatingAgency: Contract

  let amount: BigNumber
  let apy: BigNumber
  let term: BigNumber

  const dayInSeconds = 60 * 60 * 24
  const monthInSeconds = dayInSeconds * 30

  const deployMockLoanToken = async () => {
    const mock = await deployMockContract(owner, ILoanTokenJson.abi)
    await mock.mock.isLoanToken.returns(true)
    await mock.mock.fund.returns()
    await mock.mock.redeem.returns()
    await mock.mock.transfer.returns(true)
    await mock.mock.receivedAmount.returns(0)
    return mock
  }

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner, otherWallet] = wallets
    provider = _provider

    tusd = await new MockTrueCurrencyFactory(owner).deploy()
    await tusd.initialize()

    mockPool = await deployMockContract(owner, ITrueFiPoolJson.abi)
    await mockPool.mock.currencyToken.returns(tusd.address)
    await mockPool.mock.borrow.returns()
    await mockPool.mock.repay.returns()

    mockLoanToken = await deployMockLoanToken()
    await mockLoanToken.mock.borrowerFee.returns(25)
    await mockLoanToken.mock.currencyToken.returns(tusd.address)

    mockRatingAgency = await deployMockContract(owner, ITrueRatingAgencyJson.abi)
    await mockRatingAgency.mock.getResults.returns(0, 0, 0)

    lender = await new MockTrueLenderFactory(owner).deploy()
    await lender.initialize(mockPool.address, mockRatingAgency.address)

    amount = (await lender.minSize()).mul(2)
    apy = (await lender.minApy()).mul(2)
    term = (await lender.minTerm()).mul(2)
    await mockLoanToken.mock.getParameters.returns(amount, apy, term)
  })

  describe('Initializer', () => {
    it('sets the pool address', async () => {
      expect(await lender.pool()).to.equal(mockPool.address)
    })

    it('approves infinite amount to underlying pool', async () => {
      expect(await tusd.allowance(lender.address, mockPool.address)).to.equal(MaxUint256)
    })

    it('default params', async () => {
      expect(await lender.minSize()).to.equal(parseEther('1000000'))
      expect(await lender.maxSize()).to.equal(parseEther('10000000'))
      expect(await lender.minTerm()).to.equal(monthInSeconds * 6)
      expect(await lender.maxTerm()).to.equal(monthInSeconds * 120)
      expect(await lender.minApy()).to.equal('1000')
      expect(await lender.votingPeriod()).to.equal(dayInSeconds * 7)
    })
  })

  describe('Parameters set up', () => {
    describe('setApyLimits', () => {
      it('changes minApy', async () => {
        await lender.setApyLimits(1234, 3456)
        expect(await lender.minApy()).to.equal(1234)
        expect(await lender.maxApy()).to.equal(3456)
      })

      it('emits ApyLimitsChanged', async () => {
        await expect(lender.setApyLimits(1234, 3456))
          .to.emit(lender, 'ApyLimitsChanged').withArgs(1234, 3456)
      })

      it('must be called by owner', async () => {
        await expect(lender.connect(otherWallet).setApyLimits(1234, 3456)).to.be.revertedWith('caller is not the owner')
      })

      it('cannot set minApy to be bigger than maxApy', async () => {
        await expect(lender.setApyLimits(2, 1)).to.be.revertedWith('TrueLender: Maximal APY is smaller than minimal')
      })

      it('can set minApy to same value as maxApy', async () => {
        await expect(lender.setApyLimits(2, 2)).to.be.not.reverted
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

    describe('setTermLimits', () => {
      it('changes minTerm and maxTerm', async () => {
        await lender.setTermLimits(7654, 234567)
        expect(await lender.minTerm()).to.equal(7654)
        expect(await lender.maxTerm()).to.equal(234567)
      })

      it('emits TermLimitsChanged', async () => {
        await expect(lender.setTermLimits(7654, 234567))
          .to.emit(lender, 'TermLimitsChanged').withArgs(7654, 234567)
      })

      it('must be called by owner', async () => {
        await expect(lender.connect(otherWallet).setTermLimits(7654, 234567)).to.be.revertedWith('caller is not the owner')
      })

      it('cannot set minTerm to be bigger than maxTerm', async () => {
        await expect(lender.setTermLimits(2, 1)).to.be.revertedWith('TrueLender: Maximal loan term is smaller than minimal')
      })

      it('can set minTerm to same value as maxTerm', async () => {
        await expect(lender.setTermLimits(2, 2)).to.be.not.reverted
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
      await mockLoanToken.mock.getParameters.returns(amount.div(10), apy, term)
      await expect(lender.fund(mockLoanToken.address))
        .to.be.revertedWith('TrueLender: Loan size is out of bounds')
    })

    it('reverts if loan size is out of bounds (too big)', async () => {
      await mockLoanToken.mock.getParameters.returns(amount.mul(10000), apy, term)
      await expect(lender.fund(mockLoanToken.address))
        .to.be.revertedWith('TrueLender: Loan size is out of bounds')
    })

    it('reverts if loan term is out of bounds (too short)', async () => {
      await mockLoanToken.mock.getParameters.returns(amount, apy, term.div(10))
      await expect(lender.fund(mockLoanToken.address))
        .to.be.revertedWith('TrueLender: Loan term is out of bounds')
    })

    it('reverts if loan term is out of bounds (too long)', async () => {
      await mockLoanToken.mock.getParameters.returns(amount, apy, term.mul(100))
      await expect(lender.fund(mockLoanToken.address))
        .to.be.revertedWith('TrueLender: Loan term is out of bounds')
    })

    it('reverts if loan has too small APY', async () => {
      await mockLoanToken.mock.getParameters.returns(amount, apy.div(10), term)
      await expect(lender.fund(mockLoanToken.address))
        .to.be.revertedWith('TrueLender: APY is out of bounds')
    })

    it('reverts if loan has too big APY', async () => {
      await mockLoanToken.mock.getParameters.returns(amount, 5000, term)
      await expect(lender.fund(mockLoanToken.address))
        .to.be.revertedWith('TrueLender: APY is out of bounds')
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
        await mockLoanToken.mock.getParameters.returns(amount, apy, term)
        await mockLoanToken.mock.receivedAmount.returns(amount.sub(10))
        await mockRatingAgency.mock.getResults.returns(dayInSeconds * 14, 0, amount.mul(10))
      })

      it('borrows tokens from pool', async () => {
        await lender.fund(mockLoanToken.address)
        expect('borrow').to.be.calledOnContractWith(mockPool, [amount, amount.sub(10)])
      })

      it('approves LoanToken to spend funds borrowed from pool', async () => {
        await lender.fund(mockLoanToken.address)
        expect(await tusd.allowance(lender.address, mockLoanToken.address))
          .to.equal(amount.sub(10))
      })

      it('calls fund function', async () => {
        await lender.fund(mockLoanToken.address)
        expect('fund').to.be.calledOnContractWith(mockLoanToken, [])
      })

      it('emits proper event', async () => {
        await expect(lender.fund(mockLoanToken.address))
          .to.emit(lender, 'Funded')
          .withArgs(mockLoanToken.address, amount.sub(10))
      })

      it('adds funded loan to an array', async () => {
        await lender.fund(mockLoanToken.address)
        expect(await lender.loans()).to.deep.equal([mockLoanToken.address])
        await lender.fund(mockLoanToken.address)
        expect(await lender.loans()).to.deep.equal([mockLoanToken.address, mockLoanToken.address])
      })
    })

    describe('complex credibility cases', () => {
      interface LoanScenario {
        APY: number,
        term: number,
        riskAversion: number,
        yesPercentage: number,
      }

      const scenario = (APY: number, months: number, riskAversion: number, yesPercentage: number) => ({
        APY: APY * 100,
        term: monthInSeconds * months,
        riskAversion: riskAversion * 100,
        yesPercentage,
      })

      const loanIsCredible = async (loanScenario: LoanScenario) => {
        await lender.setRiskAversion(loanScenario.riskAversion)
        return lender.loanIsCredible(
          loanScenario.APY,
          loanScenario.term,
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
    const fakeLoanTokenAddress = '0x156b86b8983CC7865076B179804ACC277a1E78C4'
    const availableLoanTokens = 1500

    beforeEach(async () => {
      await mockLoanToken.mock.status.returns(3)
      await mockLoanToken.mock.balanceOf.returns(availableLoanTokens)
    })

    it('works only for loan tokens', async () => {
      await mockLoanToken.mock.isLoanToken.returns(false)
      await expect(lender.reclaim(mockLoanToken.address))
        .to.be.revertedWith('TrueLender: Only LoanTokens can be used to reclaimed')
      await expect(lender.reclaim(fakeLoanTokenAddress))
        .to.be.reverted
    })

    it('works only for closed loans', async () => {
      await mockLoanToken.mock.status.returns(2)
      await expect(lender.reclaim(mockLoanToken.address))
        .to.be.revertedWith('TrueLender: LoanToken is not closed yet')
    })

    it('redeems funds from loan token', async () => {
      await lender.reclaim(mockLoanToken.address)
      await expect('redeem').to.be.calledOnContractWith(mockLoanToken, [availableLoanTokens])
    })

    it('repays funds from the pool', async () => {
      await lender.reclaim(mockLoanToken.address)
      await expect('repay').to.be.calledOnContract(mockPool)
    })

    it('emits a proper event', async () => {
      await expect(lender.reclaim(mockLoanToken.address))
        .to.emit(lender, 'Reclaimed')
    })

    it('removes loan from the array', async () => {
      await lender.allow(owner.address, true)
      await mockLoanToken.mock.getParameters.returns(amount, apy, term)
      await mockRatingAgency.mock.getResults.returns(dayInSeconds * 14, 0, amount.mul(10))

      await lender.fund(mockLoanToken.address)
      await lender.fund(mockLoanToken.address)
      expect(await lender.loans()).to.deep.equal([mockLoanToken.address, mockLoanToken.address])
      await lender.reclaim(mockLoanToken.address)
      expect(await lender.loans()).to.deep.equal([mockLoanToken.address])
    })
  })

  describe('Value', () => {
    let firstLoanToken: LoanToken
    let secondLoanToken: LoanToken

    beforeEach(async () => {
      firstLoanToken = await new LoanTokenFactory(owner).deploy(
        tusd.address,
        owner.address,
        lender.address,
        parseEther('1000000'),
        monthInSeconds * 12,
        2000,
      )
      secondLoanToken = await new LoanTokenFactory(owner).deploy(
        tusd.address,
        owner.address,
        lender.address,
        parseEther('2000000'),
        monthInSeconds * 36,
        1000,
      )
      await lender.allow(owner.address, true)
      await tusd.mint(lender.address, parseEther('3000000'))
      await mockRatingAgency.mock.getResults.returns(0, 0, parseEther('10000000'))
    })
    it('returns correct value for one closed loan', async () => {
      await lender.fund(firstLoanToken.address)
      await timeTravel(provider, (monthInSeconds * 12) + 1)
      expectCloseTo(await lender.value(), parseEther('1200000'))
    })

    it('returns correct value for one running loan', async () => {
      await lender.fund(firstLoanToken.address)
      await timeTravel(provider, monthInSeconds * 6)
      expectCloseTo(await lender.value(), parseEther('1100000'))
    })

    it('returns correct value for multiple closed loans', async () => {
      await lender.fund(firstLoanToken.address)
      await lender.fund(secondLoanToken.address)
      await timeTravel(provider, (monthInSeconds * 36) + 1)
      expectCloseTo(await lender.value(), parseEther('3800000'))
    })

    it('returns correct value for multiple opened loans', async () => {
      await lender.fund(firstLoanToken.address)
      await lender.fund(secondLoanToken.address)
      await timeTravel(provider, monthInSeconds * 6)
      expectCloseTo(await lender.value(), parseEther('3200000'))
    })

    it('returns correct value for multiple opened and closed loans', async () => {
      await lender.fund(firstLoanToken.address)
      await lender.fund(secondLoanToken.address)
      await timeTravel(provider, monthInSeconds * 18)
      expectCloseTo(await lender.value(), parseEther('3500000'))
    })

    it('returns correct value after some loans were distributed', async () => {
      await lender.fund(firstLoanToken.address)
      await lender.fund(secondLoanToken.address)
      await lender.setPool(owner.address)
      await timeTravel(provider, monthInSeconds * 18)
      await lender.distribute(otherWallet.address, 4, 5)
      expectCloseTo(await lender.value(), parseEther('700000'))
    })

    it('returns correct value after some loans were distributed 2', async () => {
      await lender.fund(firstLoanToken.address)
      await lender.fund(secondLoanToken.address)
      await lender.setPool(owner.address)
      await timeTravel(provider, monthInSeconds * 18)
      await lender.distribute(otherWallet.address, 1, 2)
      expectCloseTo(await lender.value(), parseEther('1750000'))
    })

    it('returns 0 after all were distributed', async () => {
      await lender.fund(firstLoanToken.address)
      await lender.fund(secondLoanToken.address)
      await lender.setPool(owner.address)
      await timeTravel(provider, monthInSeconds * 18)
      await lender.distribute(otherWallet.address, 2, 2)
      expect(await lender.value()).to.equal(0)
    })
  })

  describe('Distribute', () => {
    const loanTokens: MockContract[] = []

    beforeEach(async () => {
      await lender.allow(owner.address, true)
      await mockRatingAgency.mock.getResults.returns(dayInSeconds * 14, 0, amount.mul(10))

      for (let i = 0; i < 5; i++) {
        loanTokens.push(await deployMockLoanToken())
        await loanTokens[i].mock.balanceOf.returns(parseEther(((i + 1) * 10).toString()))
        await loanTokens[i].mock.getParameters.returns(amount, apy, term)
        await loanTokens[i].mock.borrowerFee.returns(25)
        await loanTokens[i].mock.currencyToken.returns(tusd.address)
        await lender.fund(loanTokens[i].address)
      }
      await lender.setPool(owner.address)
    })

    it('sends all loan tokens in the same proportion as numerator/denominator', async () => {
      await lender.distribute(otherWallet.address, 2, 5)
      for (let i = 0; i < 5; i++) {
        expect('transfer').to.be.calledOnContractWith(loanTokens[i], [otherWallet.address, parseEther(((i + 1) * 10).toString()).mul(2).div(5)])
      }
    })

    it('reverts if not called by pool', async () => {
      await expect(lender.connect(otherWallet).distribute(otherWallet.address, 2, 5)).to.be.revertedWith('TrueLender: Sender is not a pool')
    })
  })
})
