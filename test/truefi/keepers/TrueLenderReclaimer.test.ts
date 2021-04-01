import { expect, use } from 'chai'
import { deployMockContract, solidity } from 'ethereum-waffle'
import { Contract, Wallet } from 'ethers'
import { beforeEachWithFixture } from 'utils'

import {
  ILoanTokenJson,
  TrueLenderJson,
  TrueLenderReclaimer,
  TrueLenderReclaimerFactory,
} from 'contracts'

use(solidity)

describe('TrueLenderReclaimer', () => {
  let owner: Wallet

  let mockLoanToken: Contract
  let mockLender: MockTrueLender

  let reclaimer: TrueLenderReclaimer

  beforeEachWithFixture(async (wallets) => {
    [owner] = wallets

    mockLoanToken = await deployMockContract(owner, ILoanTokenJson.abi)
    await mockLoanToken.mock.isLoanToken.returns(true)
    await mockLoanToken.mock.close.returns()
    await mockLoanToken.mock.start.returns(10)
    await mockLoanToken.mock.term.returns(5)

    mockLender = await deployMockContract(owner, TrueLenderJson.abi)
    await mockLender.mock.loans.returns([mockLoanToken.address])
    await mockLender.mock.reclaim.returns()

    reclaimer = await new TrueLenderReclaimerFactory(owner).deploy(mockLender.address)
  })

  describe('Reclaim all', () => {
    it('rejects non-LoanTokens', async () => {
      await mockLoanToken.mock.isLoanToken.returns(false)
      await expect(reclaimer.reclaimAll())
        .to.be.revertedWith('TrueLenderReclaimer: Only LoanTokens can be reclaimed')
    })

    it('settles fully repaid Withdrawn loans', async () => {
      await mockLoanToken.mock.status.returns(2) // ILoanToken.Status.Withdrawn
      await mockLoanToken.mock.balance.returns(1_000)
      await mockLoanToken.mock.debt.returns(1_000)
      await reclaimer.reclaimAll()
      expect('close').to.be.calledOnContract(mockLoanToken)
    })

    it('reclaims Settled loans', async () => {
      await mockLoanToken.mock.status.returns(3) // ILoanToken.Status.Settled
      await reclaimer.reclaimAll()
      expect('reclaim').to.be.calledOnContractWith(mockLender, [mockLoanToken.address])
    })

    it('skips non-repaid loans', async () => {
      await mockLoanToken.mock.status.returns(2) // ILoanToken.Status.Withdrawn
      await mockLoanToken.mock.balance.returns(999)
      await mockLoanToken.mock.debt.returns(1_000)

      await mockLoanToken.mock.close.reverts()
      await mockLender.mock.reclaim.reverts()
      await reclaimer.reclaimAll()
    })

    it('skips Awaiting loans', async () => {
      await mockLoanToken.mock.status.returns(0) // ILoanToken.Status.Awaiting

      await mockLoanToken.mock.close.reverts()
      await mockLender.mock.reclaim.reverts()
      await reclaimer.reclaimAll()
    })

    it('skips Funded loans', async () => {
      await mockLoanToken.mock.status.returns(1) // ILoanToken.Status.Funded

      await mockLoanToken.mock.close.reverts()
      await mockLender.mock.reclaim.reverts()
      await reclaimer.reclaimAll()
    })

    it('skips Defaulted loans', async () => {
      await mockLoanToken.mock.status.returns(4) // ILoanToken.Status.Defaulted

      await mockLoanToken.mock.close.reverts()
      await mockLender.mock.reclaim.reverts()
      await reclaimer.reclaimAll()
    })

    it('skips Liquidated loans', async () => {
      await mockLoanToken.mock.status.returns(5) // ILoanToken.Status.Liquidated

      await mockLoanToken.mock.close.reverts()
      await mockLender.mock.reclaim.reverts()
      await reclaimer.reclaimAll()
    })

    it('emits Closed event', async () => {
      await mockLoanToken.mock.status.returns(2) // ILoanToken.Status.Withdrawn
      await mockLoanToken.mock.balance.returns(1_000)
      await mockLoanToken.mock.debt.returns(1_000)
      await expect(reclaimer.reclaimAll()).to.emit(reclaimer, 'Closed')
    })

    it('emits Reclaimed event', async () => {
      await mockLoanToken.mock.status.returns(3) // ILoanToken.Status.Settled
      await expect(reclaimer.reclaimAll()).to.emit(reclaimer, 'Reclaimed')
    })
  })
})
