import { expect, use } from 'chai'
import {
  TrueLender2,
  MockTrueCurrency,
  LoanToken2,
  TrueRatingAgencyV2,
  StkTruToken,
  LoanFactory2,
  TrueFiPool2,
  BorrowerDistributor,
  BorrowerDistributor__factory,
} from 'contracts'

import { solidity } from 'ethereum-waffle'
import { Wallet } from 'ethers'
import { setupDeploy } from 'scripts/utils'
import { beforeEachWithFixture, createApprovedLoan, DAY, parseTRU, setupTruefi2 } from 'utils'

use(solidity)

describe('BorrowerDistributor', () => {
  let owner: Wallet, borrower: Wallet, voter: Wallet
  let lender: TrueLender2
  let rater: TrueRatingAgencyV2
  let tru: MockTrueCurrency
  let stkTru: StkTruToken
  let loanFactory: LoanFactory2
  let pool: TrueFiPool2
  let loan: LoanToken2
  let borrowerDistributor: BorrowerDistributor
  const REWARD_RATE = 100
  const YEAR = DAY * 365

  beforeEachWithFixture(async (_wallets, _provider) => {
    [owner, borrower, voter] = _wallets
    ;({ pool, lender, loanFactory, tru, stkTru, rater } = await setupTruefi2(owner))

    loan = await createApprovedLoan(rater, tru, stkTru, loanFactory, borrower, pool, parseTRU(1e6), YEAR, 1000, voter, _provider)

    const deployContract = setupDeploy(owner)
    borrowerDistributor = await deployContract(BorrowerDistributor__factory)

    await tru.mint(borrowerDistributor.address, parseTRU(1e7))

    await borrowerDistributor.initialize(tru.address, lender.address, REWARD_RATE)
  })

  describe('Initializer', () => {
    it('sets the reward currency address', async () => {
      expect(await borrowerDistributor.rewardCurrency()).to.equal(tru.address)
    })

    it('sets the lender address', async () => {
      expect(await borrowerDistributor.lender()).to.equal(lender.address)
    })

    it('default params', async () => {
      expect(await borrowerDistributor.rewardRate()).to.equal(REWARD_RATE)
    })
  })

  describe('setRewardRate', () => {
    it('must be called by owner', async () => {
      await expect(borrowerDistributor.connect(borrower).setRewardRate(REWARD_RATE * 2)).to.be.revertedWith('caller is not the owner')
    })

    it('changes reward rate', async () => {
      await borrowerDistributor.setRewardRate(REWARD_RATE * 2)
      expect(await borrowerDistributor.rewardRate()).to.equal(REWARD_RATE * 2)
    })
  })

  describe('distribute', () => {
    it('must be called by lender', async () => {
      await expect(borrowerDistributor.distribute(loan.address)).to.be.revertedWith('Only lender can call this')
    })
  })
})
