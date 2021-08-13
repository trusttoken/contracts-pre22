import { expect, use } from 'chai'
import { beforeEachWithFixture, DAY, timeTravel } from 'utils'
import {
  TrueFiCreditOracle__factory,
  TrueFiCreditOracle,
} from 'contracts'
import { MockProvider, solidity } from 'ethereum-waffle'
import { BigNumber, Wallet } from 'ethers'

use(solidity)

describe('TrueFiCreditOracle', () => {
  let owner: Wallet
  let manager: Wallet
  let borrower: Wallet
  let provider: MockProvider
  let oracle: TrueFiCreditOracle

  enum Status {Eligible, OnHold, Ineligible}

  beforeEachWithFixture(async (wallets, _provider) => {
    ([owner, manager, borrower] = wallets)
    provider = _provider

    oracle = await new TrueFiCreditOracle__factory(owner).deploy()
    await oracle.initialize()
    await oracle.setManager(manager.address)
  })

  describe('setManager', () => {
    it('only owner can set manager', async () => {
      await expect(oracle.connect(manager).setManager(manager.address))
        .to.be.revertedWith('Ownable: caller is not the owner')
      await expect(oracle.connect(borrower).setManager(borrower.address))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('manager is properly set', async () => {
      await oracle.setManager(manager.address)
      expect(await oracle.manager()).to.equal(manager.address)
    })

    it('emits a proper event', async () => {
      await expect(oracle.setManager(manager.address))
        .to.emit(oracle, 'ManagerChanged')
        .withArgs(manager.address)
    })
  })

  describe('setCreditUpdatePeriod', () => {
    it('only owner can set credit update period', async () => {
      await expect(oracle.connect(manager).setCreditUpdatePeriod(0))
        .to.be.revertedWith('Ownable: caller is not the owner')
      await expect(oracle.connect(borrower).setCreditUpdatePeriod(0))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('period is properly set', async () => {
      await oracle.setCreditUpdatePeriod(DAY)
      expect(await oracle.creditUpdatePeriod()).to.equal(DAY)
    })

    it('emits a proper event', async () => {
      await expect(oracle.setCreditUpdatePeriod(DAY))
        .to.emit(oracle, 'CreditUpdatePeriodChanged')
        .withArgs(DAY)
    })
  })

  describe('setGracePeriod', () => {
    it('only owner can set grace period', async () => {
      await expect(oracle.connect(manager).setGracePeriod(0))
        .to.be.revertedWith('Ownable: caller is not the owner')
      await expect(oracle.connect(borrower).setGracePeriod(0))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('period is properly set', async () => {
      await oracle.setGracePeriod(DAY)
      expect(await oracle.gracePeriod()).to.equal(DAY)
    })

    it('emits a proper event', async () => {
      await expect(oracle.setGracePeriod(DAY))
        .to.emit(oracle, 'GracePeriodChanged')
        .withArgs(DAY)
    })
  })

  describe('Status', () => {
    it('returns Ineligible for borrowers who have never interacted', async () => {
      expect(await oracle.status(borrower.address)).to.equal(Status.Ineligible)
    })

    it('returns Eligible for borrowers before expiry', async () => {
      await oracle.setEligibleForDuration(borrower.address, 10 * DAY)
      expect(await oracle.status(borrower.address)).to.equal(Status.Eligible)
      timeTravel(provider, 10 * DAY - 1)
      expect(await oracle.status(borrower.address)).to.equal(Status.Eligible)
    })

    it('returns OnHold for borrowers after expiry but before grace period', async () => {
      await oracle.setEligibleForDuration(borrower.address, 10 * DAY)
      timeTravel(provider, 10 * DAY)
      expect(await oracle.status(borrower.address)).to.equal(Status.OnHold)
      timeTravel(provider, 3 * DAY - 1)
      expect(await oracle.status(borrower.address)).to.equal(Status.OnHold)
    })

    it('returns Ineligible for borrowers after grace period', async () => {
      await oracle.setEligibleForDuration(borrower.address, 10 * DAY)
      timeTravel(provider, 10 * DAY + 3 * DAY)
      expect(await oracle.status(borrower.address)).to.equal(Status.Ineligible)
      timeTravel(provider, 1_000 * DAY)
      expect(await oracle.status(borrower.address)).to.equal(Status.Ineligible)
    })
  })

  describe('set credit scores', () => {
    it('only manager can set credit scores', async () => {
      await expect(oracle.connect(borrower).setScore(borrower.address, 1))
        .to.be.revertedWith('TrueFiCreditOracle: Caller is not the manager')
      await expect(oracle.connect(owner).setScore(borrower.address, 1))
        .to.be.revertedWith('TrueFiCreditOracle: Caller is not the manager')
    })

    it('credit score is properly set', async () => {
      await oracle.connect(manager).setScore(borrower.address, 100)
      expect(await oracle.score(borrower.address)).to.equal(100)
    })

    it('updates eligible until time', async () => {
      const tx = await oracle.connect(manager).setScore(borrower.address, 100)
      const timestamp = BigNumber.from((await provider.getBlock(tx.blockNumber)).timestamp)
      expect(await oracle.eligibleUntilTime(borrower.address)).to.equal(timestamp.add(31 * DAY))
    })

    it('emits a proper event', async () => {
      await expect(oracle.connect(manager).setScore(borrower.address, 100))
        .to.emit(oracle, 'ScoreChanged')
        .withArgs(borrower.address, 100)
    })
  })

  describe('set max borrower limits', () => {
    it('only manager can set max borrower limits', async () => {
      await expect(oracle.connect(borrower).setMaxBorrowerLimit(borrower.address, 1))
        .to.be.revertedWith('TrueFiCreditOracle: Caller is not the manager')
      await expect(oracle.connect(owner).setMaxBorrowerLimit(borrower.address, 1))
        .to.be.revertedWith('TrueFiCreditOracle: Caller is not the manager')
    })

    it('max borrower limit is properly set', async () => {
      await oracle.connect(manager).setMaxBorrowerLimit(borrower.address, 1_000_000)
      expect(await oracle.maxBorrowerLimit(borrower.address)).to.equal(1_000_000)
    })

    it('updates eligible until time', async () => {
      const tx = await oracle.connect(manager).setMaxBorrowerLimit(borrower.address, 1_000_000)
      const timestamp = BigNumber.from((await provider.getBlock(tx.blockNumber)).timestamp)
      expect(await oracle.eligibleUntilTime(borrower.address)).to.equal(timestamp.add(31 * DAY))
    })

    it('emits a proper event', async () => {
      await expect(oracle.connect(manager).setMaxBorrowerLimit(borrower.address, 1_000_000))
        .to.emit(oracle, 'MaxBorrowerLimitChanged')
        .withArgs(borrower.address, 1_000_000)
    })
  })

  describe('setEligibleForDuration', () => {
    it('only owner can set eligible for duration', async () => {
      await expect(oracle.connect(manager).setEligibleForDuration(borrower.address, 10 * DAY))
        .to.be.revertedWith('Ownable: caller is not the owner')
      await expect(oracle.connect(borrower).setEligibleForDuration(borrower.address, 10 * DAY))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('eligibility is properly set', async () => {
      const tx = await oracle.setEligibleForDuration(borrower.address, 10 * DAY)
      const timestamp = BigNumber.from((await provider.getBlock(tx.blockNumber)).timestamp)
      expect(await oracle.eligibleUntilTime(borrower.address)).to.equal(timestamp.add(10 * DAY))
      expect(await oracle.status(borrower.address)).to.equal(Status.Eligible)
    })

    it('emits a proper event', async () => {
      const tx = await oracle.setEligibleForDuration(borrower.address, 10 * DAY)
      const timestamp = BigNumber.from((await provider.getBlock(tx.blockNumber)).timestamp)
      expect(tx).to.emit(oracle, 'EligibleUntilTimeChanged')
        .withArgs(borrower.address, timestamp.add(10 * DAY))
    })
  })

  describe('setOnHold', () => {
    it('only owner can set on hold', async () => {
      await expect(oracle.connect(manager).setOnHold(borrower.address))
        .to.be.revertedWith('Ownable: caller is not the owner')
      await expect(oracle.connect(borrower).setOnHold(borrower.address))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('eligibility is properly set', async () => {
      const tx = await oracle.setOnHold(borrower.address)
      const timestamp = BigNumber.from((await provider.getBlock(tx.blockNumber)).timestamp)
      expect(await oracle.eligibleUntilTime(borrower.address)).to.equal(timestamp)
      expect(await oracle.status(borrower.address)).to.equal(Status.OnHold)
    })

    it('emits a proper event', async () => {
      const tx = await oracle.setOnHold(borrower.address)
      const timestamp = BigNumber.from((await provider.getBlock(tx.blockNumber)).timestamp)
      expect(tx).to.emit(oracle, 'EligibleUntilTimeChanged')
        .withArgs(borrower.address, timestamp)
    })
  })

  describe('setIneligible', () => {
    it('only owner can set ineligible', async () => {
      await expect(oracle.connect(manager).setIneligible(borrower.address))
        .to.be.revertedWith('Ownable: caller is not the owner')
      await expect(oracle.connect(borrower).setIneligible(borrower.address))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('eligibility is properly set', async () => {
      const tx = await oracle.setIneligible(borrower.address)
      const timestamp = BigNumber.from((await provider.getBlock(tx.blockNumber)).timestamp)
      expect(await oracle.eligibleUntilTime(borrower.address)).to.equal(timestamp.sub(3 * DAY))
      expect(await oracle.status(borrower.address)).to.equal(Status.Ineligible)
    })

    it('emits a proper event', async () => {
      const tx = await oracle.setIneligible(borrower.address)
      const timestamp = BigNumber.from((await provider.getBlock(tx.blockNumber)).timestamp)
      expect(tx).to.emit(oracle, 'EligibleUntilTimeChanged')
        .withArgs(borrower.address, timestamp.sub(3 * DAY))
    })
  })
})
