import { expect, use } from 'chai'
import { deployMockContract, solidity } from 'ethereum-waffle'
import { Contract, Wallet } from 'ethers'
import { beforeEachWithFixture } from 'utils'

import {
  TrueLenderReclaimer,
  TrueLenderReclaimer__factory,
} from 'contracts'

import {
  ILoanTokenJson,
  TrueLenderJson,
} from 'build'

use(solidity)

describe('TrueLenderReclaimer', () => {
  let owner: Wallet

  let awaitingLoanToken: Contract
  let fundedLoanToken: Contract
  let withdrawnLoanToken: Contract
  let settledLoanToken: Contract
  let defaultedLoanToken: Contract
  let liquidatedLoanToken: Contract

  let mockLender: Contract

  let reclaimer: TrueLenderReclaimer

  const deployMockLoanToken = async (status) => {
    const mockLoanToken = await deployMockContract(owner, ILoanTokenJson.abi)
    await mockLoanToken.mock.isLoanToken.returns(true)
    await mockLoanToken.mock.status.returns(status)
    await mockLoanToken.mock.isRepaid.returns(false)
    await mockLoanToken.mock.settle.reverts()
    return mockLoanToken
  }

  beforeEachWithFixture(async (wallets) => {
    [owner] = wallets

    awaitingLoanToken = await deployMockLoanToken(0) // ILoanToken.Status.Awaiting
    fundedLoanToken = await deployMockLoanToken(1) // ILoanToken.Status.Funded
    withdrawnLoanToken = await deployMockLoanToken(2) // ILoanToken.Status.Withdrawn
    settledLoanToken = await deployMockLoanToken(3) // ILoanToken.Status.Settled
    defaultedLoanToken = await deployMockLoanToken(4) // ILoanToken.Status.Defaulted
    liquidatedLoanToken = await deployMockLoanToken(5) // ILoanToken.Status.Liquidated

    mockLender = await deployMockContract(owner, TrueLenderJson.abi)
    await mockLender.mock.loans.returns([
      awaitingLoanToken.address,
      fundedLoanToken.address,
      withdrawnLoanToken.address,
      settledLoanToken.address,
      defaultedLoanToken.address,
      liquidatedLoanToken.address,
    ])
    await mockLender.mock.reclaim.reverts()

    reclaimer = await new TrueLenderReclaimer__factory(owner).deploy(mockLender.address)
  })

  describe('Has settleable loans', () => {
    it('rejects non-LoanTokens', async () => {
      await withdrawnLoanToken.mock.isLoanToken.returns(false)
      await expect(reclaimer.hasSettleableLoans())
        .to.be.revertedWith('TrueLenderReclaimer: Only LoanTokens can be settled')
    })

    it('returns true for fully repaid Withdrawn loans', async () => {
      await withdrawnLoanToken.mock.isRepaid.returns(true)
      expect(await reclaimer.hasSettleableLoans()).to.be.equal(true)
    })

    it('returns false for non-repaid Withdrawn loans', async () => {
      await withdrawnLoanToken.mock.isRepaid.returns(false)
      expect(await reclaimer.hasSettleableLoans()).to.be.equal(false)
    })
  })

  describe('Settle all', () => {
    it('rejects non-LoanTokens', async () => {
      await withdrawnLoanToken.mock.isLoanToken.returns(false)
      await expect(reclaimer.settleAll())
        .to.be.revertedWith('TrueLenderReclaimer: Only LoanTokens can be settled')
    })

    it('settles fully repaid Withdrawn loans', async () => {
      await withdrawnLoanToken.mock.isRepaid.returns(true)
      await withdrawnLoanToken.mock.settle.returns()
      await reclaimer.settleAll()
      expect('settle').to.be.calledOnContract(withdrawnLoanToken)
    })

    it('skips non-repaid Withdrawn loans', async () => {
      await withdrawnLoanToken.mock.isRepaid.returns(false)
      await withdrawnLoanToken.mock.settle.reverts()
      await reclaimer.settleAll()
    })

    it('emits Settled event', async () => {
      await withdrawnLoanToken.mock.isRepaid.returns(true)
      await withdrawnLoanToken.mock.settle.returns()
      await expect(reclaimer.settleAll()).to.emit(reclaimer, 'Settled')
    })
  })

  describe('Has reclaimable loans', () => {
    it('rejects non-LoanTokens', async () => {
      await settledLoanToken.mock.isLoanToken.returns(false)
      await expect(reclaimer.hasReclaimableLoans())
        .to.be.revertedWith('TrueLenderReclaimer: Only LoanTokens can be reclaimed')
    })

    it('returns true for reclaimable loans', async () => {
      await settledLoanToken.mock.status.returns(3) // ILoanToken.Status.Settled
      expect(await reclaimer.hasReclaimableLoans()).to.be.equal(true)
    })

    it('returns false for non-reclaimable loans', async () => {
      await settledLoanToken.mock.status.returns(2) // ILoanToken.Status.Withdrawn
      expect(await reclaimer.hasReclaimableLoans()).to.be.equal(false)
    })
  })

  describe('Reclaim all', () => {
    it('rejects non-LoanTokens', async () => {
      await settledLoanToken.mock.isLoanToken.returns(false)
      await expect(reclaimer.reclaimAll())
        .to.be.revertedWith('TrueLenderReclaimer: Only LoanTokens can be reclaimed')
    })

    it('reclaims Settled loans', async () => {
      await settledLoanToken.mock.status.returns(3) // ILoanToken.Status.Settled
      await mockLender.mock.reclaim.returns()
      await reclaimer.reclaimAll()
      expect('reclaim').to.be.calledOnContractWith(mockLender, [settledLoanToken.address])
    })

    it('skips non-Settled loans', async () => {
      await settledLoanToken.mock.status.returns(2) // ILoanToken.Status.Withdrawn
      await mockLender.mock.reclaim.reverts()
      await reclaimer.settleAll()
    })

    it('emits Reclaimed event', async () => {
      await settledLoanToken.mock.status.returns(3) // ILoanToken.Status.Settled
      await mockLender.mock.reclaim.returns()
      await expect(reclaimer.reclaimAll()).to.emit(reclaimer, 'Reclaimed')
    })
  })
})
