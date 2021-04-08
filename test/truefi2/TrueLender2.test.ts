import { expect, use } from 'chai'
import { beforeEachWithFixture, DAY, parseEth, parseTRU, timeTravel } from 'utils'
import { deployContract } from 'scripts/utils/deployContract'
import {
  ImplementationReferenceFactory,
  LoanToken2,
  LoanToken2Factory,
  LoanToken2Json,
  MockErc20Token,
  MockErc20TokenFactory,
  PoolFactoryFactory,
  StkTruTokenJson,
  TrueFiPool2,
  TrueFiPool2Factory,
  TestTrueLender,
  TestTrueLenderFactory,
  TrueRatingAgencyV2,
  TrueRatingAgencyV2Factory,
  PoolFactory,
} from 'contracts'
import { deployMockContract, MockContract, MockProvider, solidity } from 'ethereum-waffle'
import { AddressZero } from '@ethersproject/constants'
import { Wallet } from 'ethers'

use(solidity)

describe('TrueLender2', () => {
  let provider: MockProvider
  let owner: Wallet
  let borrower: Wallet

  let loan1: LoanToken2
  let loan2: LoanToken2
  let pool1: TrueFiPool2
  let pool2: TrueFiPool2

  let rater: TrueRatingAgencyV2
  let lender: TestTrueLender

  let counterfeitPool: TrueFiPool2
  let token1: MockErc20Token

  let poolFactory: PoolFactory

  let mockStake: MockContract
  let tru: MockErc20Token

  const dayInSeconds = 60 * 60 * 24

  beforeEachWithFixture(async (wallets, _provider) => {
    ([owner, borrower] = wallets)
    poolFactory = await deployContract(owner, PoolFactoryFactory)
    const poolImplementation = await deployContract(owner, TrueFiPool2Factory)
    const implementationReference = await deployContract(owner, ImplementationReferenceFactory, [poolImplementation.address])

    mockStake = await deployMockContract(owner, StkTruTokenJson.abi)
    await mockStake.mock.payFee.returns()

    tru = await deployContract(owner, MockErc20TokenFactory)

    lender = await deployContract(owner, TestTrueLenderFactory)
    await poolFactory.initialize(implementationReference.address, AddressZero, lender.address)
    rater = await deployContract(owner, TrueRatingAgencyV2Factory)
    await lender.initialize(mockStake.address, poolFactory.address, rater.address)
    //initialize rater

    token1 = await deployContract(owner, MockErc20TokenFactory)
    const token2 = await deployContract(owner, MockErc20TokenFactory)
    await poolFactory.whitelist(token1.address, true)
    await poolFactory.whitelist(token2.address, true)

    await poolFactory.createPool(token1.address)
    await poolFactory.createPool(token2.address)

    pool1 = TrueFiPool2Factory.connect(await poolFactory.pool(token1.address), owner)
    pool2 = TrueFiPool2Factory.connect(await poolFactory.pool(token2.address), owner)
    counterfeitPool = await deployContract(owner, TrueFiPool2Factory)
    await counterfeitPool.initialize(token1.address, AddressZero, lender.address, owner.address)
    await token1.mint(owner.address, parseEth(1e7))
    await token2.mint(owner.address, parseEth(1e7))
    await token1.approve(pool1.address, parseEth(1e7))
    await token2.approve(pool2.address, parseEth(1e7))
    await pool1.join(parseEth(1e7))
    await pool2.join(parseEth(1e7))

    loan1 = await deployContract(owner, LoanToken2Factory, [
      pool1.address,
      borrower.address,
      lender.address,
      AddressZero,
      100000,
      DAY,
      100,
    ])

    loan2 = await deployContract(owner, LoanToken2Factory, [
      pool2.address,
      borrower.address,
      lender.address,
      AddressZero,
      500000,
      DAY,
      1000,
    ])

    provider = _provider
  })

  describe('Initializer', () => {
    it('sets the staking pool address', async () => {
      expect(await lender.stakingPool()).to.equal(mockStake.address)
    })

    it('sets the pool factory address', async () => {
      expect(await lender.factory()).to.equal(poolFactory.address)
    })

    it('sets the rating agency address', async () => {
      expect(await lender.ratingAgency()).to.equal(rater.address)
    })

    it('default params', async () => {
      expect(await lender.minVotes()).to.equal(parseTRU(15e6))
      expect(await lender.minRatio()).to.equal(8000)
      expect(await lender.votingPeriod()).to.equal(dayInSeconds * 7)
      expect(await lender.maxLoans()).to.equal(100)
    })
  })

  describe('Parameters set up', () => {
    describe('setMinVotes', () => {
      it('changes minVotes', async () => {
        await lender.setMinVotes(1234)
        expect(await lender.minVotes()).to.equal(1234)
      })

      it('emits MinVotesChanged', async () => {
        await expect(lender.setMinVotes(1234))
          .to.emit(lender, 'MinVotesChanged').withArgs(1234)
      })

      it('must be called by owner', async () => {
        await expect(lender.connect(borrower).setMinVotes(1234)).to.be.revertedWith('caller is not the owner')
      })
    })

    describe('setMinRatio', () => {
      it('changes minRatio', async () => {
        await lender.setMinRatio(1234)
        expect(await lender.minRatio()).to.equal(1234)
      })

      it('forbids setting above 100%', async () => {
        await expect(lender.setMinRatio(10001))
          .to.be.revertedWith('TrueLender: minRatio cannot be more than 100%')
      })

      it('emits MinRatioChanged', async () => {
        await expect(lender.setMinRatio(1234))
          .to.emit(lender, 'MinRatioChanged').withArgs(1234)
      })

      it('must be called by owner', async () => {
        await expect(lender.connect(borrower).setMinRatio(1234)).to.be.revertedWith('caller is not the owner')
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
        await expect(lender.connect(borrower).setVotingPeriod(dayInSeconds * 3)).to.be.revertedWith('caller is not the owner')
      })
    })
  })

  describe('Funding', () => {
    describe('reverts if', () => {
      it('transaction not called by the borrower', async () => {
        await expect(lender.fund(loan1.address)).to.be.revertedWith('TrueLender: Sender is not borrower')
      })

      it('loan was created for unknown pool', async () => {
        const badLoan = await deployContract(owner, LoanToken2Factory, [
          counterfeitPool.address,
          borrower.address,
          lender.address,
          AddressZero,
          100000,
          DAY,
          100,
        ])
        await expect(lender.connect(borrower).fund(badLoan.address)).to.be.revertedWith('TrueLender: Pool not created by the factory')
      })

      it('there are too many loans for given pool', async () => {
        await lender.setLoansLimit(1)
        await lender.connect(borrower).fund(loan1.address)
        await expect(lender.connect(borrower).fund(loan1.address)).to.be.revertedWith('TrueLender: Loans number has reached the limit')
      })
    })

    it('borrows receivedAmount from pool and transfers to the loan', async () => {
      await expect(lender.connect(borrower).fund(loan1.address))
        .to.emit(token1, 'Transfer')
        .withArgs(pool1.address, lender.address, 99750)
        .and.to.emit(token1, 'Transfer')
        .withArgs(lender.address, loan1.address, 99750)
      expect(await loan1.balance()).to.equal(99750)
    })

    it('pays fee to stakers', async () => {
      await lender.connect(borrower).fund(loan1.address)
      expect('payFee').to.have.been.calledOnContract(mockStake)
    })

    it('emits event', async () => {
      await expect(lender.connect(borrower).fund(loan1.address))
        .to.emit(lender, 'Funded')
        .withArgs(pool1.address, loan1.address, 99750)
    })
  })

  describe('value', () => {
    beforeEach(async () => {
      await lender.connect(borrower).fund(loan1.address)
      const newLoan1 = await deployContract(owner, LoanToken2Factory, [
        pool1.address,
        borrower.address,
        lender.address,
        AddressZero,
        100000,
        DAY,
        100,
      ])
      await lender.connect(borrower).fund(newLoan1.address)
      await lender.connect(borrower).fund(loan2.address)
    })

    it('shows correct value for a newly added loan', async () => {
      expect(await lender.value(pool1.address)).to.equal(200000)
      expect(await lender.value(pool2.address)).to.equal(500000)
    })

    it('value should increase with time', async () => {
      await timeTravel(provider, DAY / 2)
      expect(await lender.value(pool1.address)).to.equal(200002)
      expect(await lender.value(pool2.address)).to.equal(500068)
    })

    it('value stops increasing after term passes', async () => {
      await timeTravel(provider, DAY)
      expect(await lender.value(pool1.address)).to.equal(200004)
      expect(await lender.value(pool2.address)).to.equal(500136)
      await timeTravel(provider, DAY * 10)
      expect(await lender.value(pool1.address)).to.equal(200004)
      expect(await lender.value(pool2.address)).to.equal(500136)
    })
  })

  describe('Reclaiming', () => {
    const payBack = async (token: MockErc20Token, loan: LoanToken2) => {
      const balance = await loan.balance()
      const debt = await loan.debt()
      await token.mint(loan.address, debt.sub(balance))
    }

    beforeEach(async () => {
      await lender.connect(borrower).fund(loan1.address)
    })

    it('works only for closed loans', async () => {
      await expect(lender.reclaim(loan1.address))
        .to.be.revertedWith('TrueLender: LoanToken is not closed yet')
    })

    it('reverts if loan has not been previously funded', async () => {
      const mockLoanToken = await deployMockContract(owner, LoanToken2Json.abi)
      await mockLoanToken.mock.status.returns(3)
      await mockLoanToken.mock.pool.returns(pool1.address)
      await expect(lender.reclaim(mockLoanToken.address))
        .to.be.revertedWith('TrueLender: This loan has not been funded by the lender')
    })

    it('redeems funds from loan token', async () => {
      await payBack(token1, loan1)
      await loan1.settle()
      await expect(lender.reclaim(loan1.address))
        .to.emit(token1, 'Transfer')
        .withArgs(loan1.address, lender.address, 100002)
    })

    it('repays funds from the pool', async () => {
      await payBack(token1, loan1)
      await loan1.settle()
      await expect(lender.reclaim(loan1.address))
        .to.emit(token1, 'Transfer')
        .withArgs(lender.address, pool1.address, 100002)
    })

    it('defaulted loans can only be reclaimed by owner', async () => {
      await timeTravel(provider, DAY * 3)
      await loan1.enterDefault()
      await expect(lender.connect(borrower).reclaim(loan1.address))
        .to.be.revertedWith('TrueLender: Only owner can reclaim from defaulted loan')
    })

    it('emits a proper event', async () => {
      await payBack(token1, loan1)
      await loan1.settle()
      await expect(lender.reclaim(loan1.address))
        .to.emit(lender, 'Reclaimed')
        .withArgs(pool1.address, loan1.address, 100002)
    })

    describe('Removes loan from array', () => {
      let newLoan1: LoanToken2
      beforeEach(async () => {
        await payBack(token1, loan1)
        await loan1.settle()
        newLoan1 = await deployContract(owner, LoanToken2Factory, [
          pool1.address,
          borrower.address,
          lender.address,
          AddressZero,
          100000,
          DAY,
          100,
        ])
        await lender.connect(borrower).fund(newLoan1.address)
        await lender.connect(borrower).fund(loan2.address)
      })

      it('removes oldest loan from the array', async () => {
        expect(await lender.loans(pool1.address)).to.deep.equal([loan1.address, newLoan1.address])
        await lender.reclaim(loan1.address)
        expect(await lender.loans(pool1.address)).to.deep.equal([newLoan1.address])
      })

      it('removes newest loan from the array', async () => {
        await payBack(token1, newLoan1)
        await newLoan1.settle()

        expect(await lender.loans(pool1.address)).to.deep.equal([loan1.address, newLoan1.address])
        await lender.reclaim(newLoan1.address)
        expect(await lender.loans(pool1.address)).to.deep.equal([loan1.address])
      })

      it('preserves loans for other pools', async () => {
        await lender.reclaim(loan1.address)
        expect(await lender.loans(pool2.address)).to.deep.equal([loan2.address])
      })
    })
  })

  describe('Distribute', () => {
    const loanTokens: LoanToken2[] = []

    beforeEach(async () => {
      for (let i = 0; i < 5; i++) {
        const newLoan1 = await deployContract(owner, LoanToken2Factory, [
          pool1.address,
          borrower.address,
          lender.address,
          AddressZero,
          100000,
          DAY,
          100,
        ])

        loanTokens.push(newLoan1)
        await lender.connect(borrower).fund(newLoan1.address)
      }
    })

    it('sends all loan tokens in the same proportion as numerator/denominator', async () => {
      await expect(lender.testDistribute(borrower.address, 2, 5, pool1.address))
        .to.emit(loanTokens[0], 'Transfer')
        .withArgs(lender.address, borrower.address, Math.floor(100002 * 2 / 5))
        .and.to.emit(loanTokens[1], 'Transfer')
        .withArgs(lender.address, borrower.address, Math.floor(100002 * 2 / 5))
        .and.to.emit(loanTokens[2], 'Transfer')
        .withArgs(lender.address, borrower.address, Math.floor(100002 * 2 / 5))
        .and.to.emit(loanTokens[3], 'Transfer')
        .withArgs(lender.address, borrower.address, Math.floor(100002 * 2 / 5))
        .and.to.emit(loanTokens[4], 'Transfer')
        .withArgs(lender.address, borrower.address, Math.floor(100002 * 2 / 5))
    })
  })
})
