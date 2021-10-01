import { expect, use } from 'chai'
import {
  beforeEachWithFixture,
  createLoan,
  DAY,
  parseEth,
  parseTRU,
  parseUSDC,
  setupTruefi2,
  timeTravel as _timeTravel,
} from 'utils'
import { deployContract } from 'scripts/utils/deployContract'
import {
  BorrowingMutex,
  LoanFactory2,
  LoanToken2,
  Mock1InchV3,
  Mock1InchV3__factory,
  MockErc20Token,
  MockErc20Token__factory,
  MockTrueCurrency,
  MockTrueFiPoolOracle,
  MockUsdc,
  PoolFactory,
  StkTruToken,
  TestTrueLender,
  TestTrueLender__factory,
  TrueFiCreditOracle,
  TrueFiPool2,
  TrueFiPool2__factory,
  TrueRatingAgencyV2,
} from 'contracts'

import { BorrowingMutexJson, LoanToken2Json, Mock1InchV3Json } from 'build'

import { deployMockContract, solidity } from 'ethereum-waffle'
import { AddressZero } from '@ethersproject/constants'
import { BigNumber, BigNumberish, utils, Wallet } from 'ethers'

use(solidity)

describe('TrueLender2', () => {
  let owner: Wallet
  let borrower: Wallet

  let loanFactory: LoanFactory2
  let loan1: LoanToken2
  let loan2: LoanToken2
  let pool1: TrueFiPool2
  let pool2: TrueFiPool2
  let feePool: TrueFiPool2
  let poolOracle: MockTrueFiPoolOracle

  let rater: TrueRatingAgencyV2
  let lender: TestTrueLender
  let creditOracle: TrueFiCreditOracle

  let counterfeitPool: TrueFiPool2
  let token1: MockErc20Token
  let token2: MockErc20Token

  let poolFactory: PoolFactory

  let stkTru: StkTruToken
  let tru: MockTrueCurrency
  let usdc: MockUsdc
  let oneInch: Mock1InchV3
  let borrowingMutex: BorrowingMutex

  const YEAR = DAY * 365

  let timeTravel: (time: number) => void

  beforeEachWithFixture(async (wallets, _provider) => {
    ([owner, borrower] = wallets)
    timeTravel = (time: number) => _timeTravel(_provider, time)

    lender = await deployContract(owner, TestTrueLender__factory)
    oneInch = await new Mock1InchV3__factory(owner).deploy()

    ; ({
      loanFactory,
      feePool,
      standardTokenOracle: poolOracle,
      rater,
      poolFactory,
      stkTru,
      tru,
      feeToken: usdc,
      lender,
      creditOracle,
      borrowingMutex,
    } = await setupTruefi2(owner, _provider, { lender: lender, oneInch: oneInch }))

    await loanFactory.setFixedTermLoanAgency(lender.address)

    token1 = await deployContract(owner, MockErc20Token__factory)
    token2 = await deployContract(owner, MockErc20Token__factory)

    await poolFactory.allowToken(token1.address, true)
    await poolFactory.allowToken(token2.address, true)

    await poolFactory.createPool(token1.address)
    await poolFactory.createPool(token2.address)

    pool1 = TrueFiPool2__factory.connect(await poolFactory.pool(token1.address), owner)
    pool2 = TrueFiPool2__factory.connect(await poolFactory.pool(token2.address), owner)

    await poolFactory.supportPool(pool1.address)
    await poolFactory.supportPool(pool2.address)

    counterfeitPool = await deployContract(owner, TrueFiPool2__factory)
    await counterfeitPool.initialize(token1.address, lender.address, AddressZero, AddressZero, loanFactory.address, owner.address)

    await pool1.setOracle(poolOracle.address)
    await pool2.setOracle(poolOracle.address)

    await lender.setFeePool(feePool.address)

    await token1.mint(owner.address, parseEth(1e7))
    await token2.mint(owner.address, parseEth(1e7))
    await token1.approve(pool1.address, parseEth(1e7))
    await token2.approve(pool2.address, parseEth(1e7))
    await pool1.join(parseEth(1e7))
    await pool2.join(parseEth(1e7))

    await rater.allow(borrower.address, true)
    await tru.mint(owner.address, parseTRU(15e6))

    await tru.approve(stkTru.address, parseTRU(15e6))
    await stkTru.stake(parseTRU(15e6))
    await timeTravel(1)
    loan1 = await createLoan(loanFactory, borrower, pool1, 100000, YEAR, 100)

    loan2 = await createLoan(loanFactory, borrower, pool2, 500000, YEAR, 1000)

    await creditOracle.setCreditUpdatePeriod(YEAR)
    await creditOracle.setScore(borrower.address, 255)
    await creditOracle.setMaxBorrowerLimit(borrower.address, parseEth(1e8))
  })

  const approveLoanRating = async function (loan: LoanToken2) {
    await rater.connect(borrower).submit(loan.address)
    await rater.yes(loan.address)

    await timeTravel(7 * DAY + 1)
  }

  describe('Initializer', () => {
    it('sets the staking pool address', async () => {
      expect(await lender.stakingPool()).to.equal(stkTru.address)
    })

    it('sets the pool factory address', async () => {
      expect(await lender.factory()).to.equal(poolFactory.address)
    })
  })

  describe('Parameters set up', () => {
    describe('setFee', () => {
      it('changes fee', async () => {
        await lender.setFee(1234)
        expect(await lender.fee()).to.equal(1234)
      })

      it('forbids setting above 100%', async () => {
        await expect(lender.setFee(10001))
          .to.be.revertedWith('TrueLender: fee cannot be more than 100%')
      })

      it('emits FeeChanged', async () => {
        await expect(lender.setFee(1234))
          .to.emit(lender, 'FeeChanged').withArgs(1234)
      })

      it('must be called by owner', async () => {
        await expect(lender.connect(borrower).setFee(1234))
          .to.be.revertedWith('Ownable: caller is not the owner')
      })
    })

    describe('setFeePool', () => {
      it('changes feePool', async () => {
        await lender.setFeePool(pool2.address)
        expect(await lender.feePool()).to.equal(pool2.address)
      })

      it('changes feeToken', async () => {
        await lender.setFeePool(pool2.address)
        expect(await lender.feeToken()).to.equal(token2.address)
      })

      it('emits FeePoolChanged', async () => {
        await expect(lender.setFeePool(pool2.address))
          .to.emit(lender, 'FeePoolChanged').withArgs(pool2.address)
      })

      it('must be called by owner', async () => {
        await expect(lender.connect(borrower).setFeePool(pool2.address))
          .to.be.revertedWith('Ownable: caller is not the owner')
      })
    })
  })

  describe('value', () => {
    beforeEach(async () => {
      const newLoan1 = await createLoan(loanFactory, borrower, pool1, 100000, DAY, 100)

      await approveLoanRating(newLoan1)
      await approveLoanRating(loan1)
      await approveLoanRating(loan2)
      await lender.connect(borrower).fund(loan1.address)
      await lender.connect(borrower).fund(newLoan1.address)
      await lender.connect(borrower).fund(loan2.address)
    })

    it('shows correct value for a newly added loan', async () => {
      expect(await lender.value(pool1.address)).to.equal(200000)
      expect(await lender.value(pool2.address)).to.equal(500000)
    })

    it('value should increase with time', async () => {
      await timeTravel(DAY / 2)
      expect(await lender.value(pool1.address)).to.equal(200002)
      expect(await lender.value(pool2.address)).to.equal(500068)
    })

    it('value stops increasing after term passes', async () => {
      await timeTravel(YEAR)
      expect(await lender.value(pool1.address)).to.equal(201002)
      expect(await lender.value(pool2.address)).to.equal(550000)
      await timeTravel(YEAR * 10)
      expect(await lender.value(pool1.address)).to.equal(201002)
      expect(await lender.value(pool2.address)).to.equal(550000)
    })
  })

  describe('Reclaiming', () => {
    const payBack = async (token: MockErc20Token, loan: LoanToken2) => {
      const balance = await loan.balance()
      const debt = await loan.debt()
      await token.mint(loan.address, debt.sub(balance))
      await borrowingMutex.allowLocker(owner.address, true)
      await borrowingMutex.lock(borrower.address, loan1.address)
    }

    beforeEach(async () => {
      await approveLoanRating(loan1)
      await lender.connect(borrower).fund(loan1.address)
      await lender.setFee(0)
    })

    it('works only for closed loans', async () => {
      await expect(lender.reclaim(loan1.address, '0x'))
        .to.be.revertedWith('TrueLender: LoanToken is not closed yet')
    })

    it('reverts if loan has not been previously funded', async () => {
      const mockLoanToken = await deployMockContract(owner, LoanToken2Json.abi)
      await mockLoanToken.mock.status.returns(3)
      await mockLoanToken.mock.pool.returns(pool1.address)
      await expect(lender.reclaim(mockLoanToken.address, '0x'))
        .to.be.revertedWith('TrueLender: This loan has not been funded by the lender')
    })

    it('redeems funds from loan token', async () => {
      await payBack(token1, loan1)
      await loan1.settle()
      await expect(lender.reclaim(loan1.address, '0x'))
        .to.emit(token1, 'Transfer')
        .withArgs(loan1.address, lender.address, 101000)
    })

    it('repays funds from the pool', async () => {
      await payBack(token1, loan1)
      await loan1.settle()
      await expect(lender.reclaim(loan1.address, '0x'))
        .to.emit(token1, 'Transfer')
        .withArgs(lender.address, pool1.address, 101000)
    })

    it('defaulted loans can only be reclaimed by owner', async () => {
      await timeTravel(YEAR * 2)
      await loan1.enterDefault()
      await expect(lender.connect(borrower).reclaim(loan1.address, '0x'))
        .to.be.revertedWith('TrueLender: Only owner can reclaim from defaulted loan')
    })

    it('emits a proper event', async () => {
      await payBack(token1, loan1)
      await loan1.settle()
      await expect(lender.reclaim(loan1.address, '0x'))
        .to.emit(lender, 'Reclaimed')
        .withArgs(pool1.address, loan1.address, 101000)
    })

    describe('Removes loan from array', () => {
      let newLoan1: LoanToken2
      beforeEach(async () => {
        const mockMutex = await deployMockContract(owner, BorrowingMutexJson.abi)
        await loanFactory.setBorrowingMutex(mockMutex.address)
        await mockMutex.mock.isUnlocked.returns(true)
        await mockMutex.mock.lock.returns()
        await mockMutex.mock.unlock.returns()

        await payBack(token1, loan1)
        await loan1.settle()

        newLoan1 = await createLoan(loanFactory, borrower, pool1, 100000, DAY, 100)

        await approveLoanRating(newLoan1)
        await approveLoanRating(loan2)

        await lender.connect(borrower).fund(newLoan1.address)
        await lender.connect(borrower).fund(loan2.address)
      })

      it('removes oldest loan from the array', async () => {
        expect(await lender.loans(pool1.address)).to.deep.equal([loan1.address, newLoan1.address])
        await lender.reclaim(loan1.address, '0x')
        expect(await lender.loans(pool1.address)).to.deep.equal([newLoan1.address])
      })

      it('removes newest loan from the array', async () => {
        await payBack(token1, newLoan1)
        await newLoan1.settle()

        expect(await lender.loans(pool1.address)).to.deep.equal([loan1.address, newLoan1.address])
        await lender.reclaim(newLoan1.address, '0x')
        expect(await lender.loans(pool1.address)).to.deep.equal([loan1.address])
      })

      it('preserves loans for other pools', async () => {
        await lender.reclaim(loan1.address, '0x')
        expect(await lender.loans(pool2.address)).to.deep.equal([loan2.address])
      })
    })

    describe('With fees', () => {
      let fee: BigNumber
      let newLoan1: LoanToken2
      beforeEach(async () => {
        const mockMutex = await deployMockContract(owner, BorrowingMutexJson.abi)
        await loanFactory.setBorrowingMutex(mockMutex.address)
        await mockMutex.mock.isUnlocked.returns(true)
        await mockMutex.mock.lock.returns()
        await mockMutex.mock.unlock.returns()

        newLoan1 = await createLoan(loanFactory, borrower, pool1, parseEth(100000), YEAR, 100)
        await approveLoanRating(newLoan1)
        await lender.connect(borrower).fund(newLoan1.address)

        await lender.setFee(1000)
        await oneInch.setOutputAmount(parseEth(25))
        await payBack(token1, newLoan1)
        await newLoan1.settle()
        fee = (await newLoan1.debt()).sub(await newLoan1.amount()).div(10)
      })

      const encodeData = (fromToken: string, toToken: string, sender: string, receiver: string, amount: BigNumberish, flags = 0) => {
        const iface = new utils.Interface(Mock1InchV3Json.abi)
        return iface.encodeFunctionData('swap', [AddressZero, {
          srcToken: fromToken,
          dstToken: toToken,
          srcReceiver: sender,
          dstReceiver: receiver,
          amount: amount,
          minReturnAmount: 0,
          flags: flags,
          permit: '0x',
        }, '0x'])
      }

      it('swaps token for usdc', async () => {
        const data = encodeData(token1.address, usdc.address, lender.address, lender.address, fee)
        await lender.reclaim(newLoan1.address, data)
      })

      it('fee is not sent to the pool', async () => {
        const data = encodeData(token1.address, usdc.address, lender.address, lender.address, fee)
        await expect(lender.reclaim(newLoan1.address, data))
          .to.emit(token1, 'Transfer')
          .withArgs(lender.address, pool1.address, parseEth(101000).sub(fee))
      })

      it('reverts on wrong destination token', async () => {
        await token2.mint(lender.address, fee)
        const data = encodeData(token2.address, usdc.address, lender.address, lender.address, fee)
        await expect(lender.reclaim(newLoan1.address, data)).to.be.revertedWith('TrueLender: Source token is not same as pool\'s token')
      })

      it('reverts when receiver is not lender', async () => {
        const data = encodeData(token1.address, usdc.address, lender.address, pool1.address, fee)
        await expect(lender.reclaim(newLoan1.address, data)).to.be.revertedWith('TrueLender: Receiver is not lender')
      })

      it('reverts on wrong amount', async () => {
        const data = encodeData(token1.address, usdc.address, lender.address, lender.address, fee.sub(1))
        await expect(lender.reclaim(newLoan1.address, data)).to.be.revertedWith('TrueLender: Incorrect fee swap amount')
      })

      it('reverts if partial fill is allowed', async () => {
        const data = encodeData(token1.address, usdc.address, lender.address, lender.address, fee, 1)
        await expect(lender.reclaim(newLoan1.address, data)).to.be.revertedWith('TrueLender: Partial fill is not allowed')
      })

      it('reverts if small USDC amount is returned', async () => {
        await oneInch.setOutputAmount(parseUSDC(24))
        const data = encodeData(token1.address, usdc.address, lender.address, lender.address, fee)
        await expect(lender.reclaim(newLoan1.address, data)).to.be.revertedWith('TrueLender: Fee returned from swap is too small')
      })

      it('puts fee into USDC pool and transfers LP tokens to stakers', async () => {
        const data = encodeData(token1.address, usdc.address, lender.address, lender.address, fee)
        await expect(lender.reclaim(newLoan1.address, data))
          .to.emit(feePool, 'Joined')
          .withArgs(lender.address, parseEth(25), parseEth(25))
          .and.to.emit(feePool, 'Transfer')
          .withArgs(lender.address, stkTru.address, parseEth(25))
      })
    })
  })

  describe('Distribute', () => {
    const loanTokens: LoanToken2[] = []

    beforeEach(async () => {
      const mockMutex = await deployMockContract(owner, BorrowingMutexJson.abi)
      await loanFactory.setBorrowingMutex(mockMutex.address)
      await mockMutex.mock.isUnlocked.returns(true)
      await mockMutex.mock.lock.returns()
      await mockMutex.mock.unlock.returns()

      for (let i = 0; i < 5; i++) {
        const newLoan1 = await createLoan(loanFactory, borrower, pool1, 100000, DAY, 100)

        loanTokens.push(newLoan1)
        await approveLoanRating(newLoan1)
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

    it('reverts if not called by the pool', async () => {
      await expect(lender.distribute(borrower.address, 2, 5)).to.be.revertedWith('TrueLender: Pool not supported by the factory')
    })
  })

  describe('transferAllLoanTokens', () => {
    beforeEach(async () => {
      await approveLoanRating(loan1)
      await lender.connect(borrower).fund(loan1.address)
      await lender.setFee(0)
    })

    it('can only be called by the pool', async () => {
      await expect(lender.transferAllLoanTokens(loan1.address, owner.address)).to.be.revertedWith('TrueLender: Pool not supported by the factory')
    })

    it('transfers whole LT balance to the recipient', async () => {
      const balance = await loan1.balanceOf(lender.address)
      await expect(lender.testTransferAllLoanTokens(loan1.address, owner.address))
        .to.emit(loan1, 'Transfer').withArgs(lender.address, owner.address, balance)
    })

    it('removes LT from the list', async () => {
      expect(await lender.loans(pool1.address)).to.deep.equal([loan1.address])
      await lender.testTransferAllLoanTokens(loan1.address, owner.address)
      expect(await lender.loans(pool1.address)).to.deep.equal([])
    })
  })
})
