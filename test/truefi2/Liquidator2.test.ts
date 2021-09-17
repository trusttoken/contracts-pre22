import { expect, use } from 'chai'
import {
  BorrowingMutex__factory,
  Liquidator2,
  LoanFactory2,
  LoanToken2,
  LoanToken2__factory,
  MockTrueCurrency,
  MockUsdc,
  PoolFactory,
  StkTruToken,
  TrueFiPool2,
  TrueLender2,
  TrueFiCreditOracle,
  PoolFactory__factory,
  DebtToken,
  MockTrueFiPoolOracle,
  MockTrueFiPoolOracle__factory,
} from 'contracts'

import { solidity } from 'ethereum-waffle'
import { BigNumberish, Wallet } from 'ethers'
import { setupDeploy } from 'scripts/utils'
import { DAY } from 'utils/constants'
import {
  beforeEachWithFixture,
  createLoan,
  parseEth,
  parseTRU,
  parseUSDC,
  setupTruefi2,
  timeTravel as _timeTravel,
  createDebtToken as _createDebtToken,
} from 'utils'
import { AddressZero } from '@ethersproject/constants'

use(solidity)

describe('Liquidator2', () => {
  enum LoanTokenStatus { Awaiting, Funded, Withdrawn, Settled, Defaulted, Liquidated }

  let owner: Wallet
  let otherWallet: Wallet
  let assurance: Wallet
  let borrower: Wallet

  let liquidator: Liquidator2
  let loanFactory: LoanFactory2
  let poolFactory: PoolFactory
  let usdc: MockUsdc
  let tusd: MockUsdc
  let tru: MockTrueCurrency
  let stkTru: StkTruToken
  let lender: TrueLender2
  let usdcPool: TrueFiPool2
  let tusdPool: TrueFiPool2
  let loan: LoanToken2
  let debtToken1: DebtToken
  let debtToken2: DebtToken
  let creditOracle: TrueFiCreditOracle
  let tusdOracle: MockTrueFiPoolOracle

  let timeTravel: (time: number) => void

  const YEAR = DAY * 365
  const defaultedLoanCloseTime = YEAR + 3 * DAY

  const withdraw = async (loan: LoanToken2, wallet: Wallet, beneficiary = wallet.address) =>
    loan.connect(wallet).withdraw(beneficiary)

  const createDebtToken = async (pool: TrueFiPool2, debt: BigNumberish) => {
    return _createDebtToken(loanFactory, owner, owner, pool, borrower, debt)
  }

  beforeEachWithFixture(async (_wallets, _provider) => {
    [owner, otherWallet, borrower, assurance] = _wallets
    timeTravel = (time: number) => _timeTravel(_provider, time)

    ; ({
      liquidator,
      loanFactory,
      poolFactory,
      feeToken: usdc,
      standardToken: tusd,
      tru,
      stkTru,
      lender,
      feePool: usdcPool,
      standardPool: tusdPool,
      creditOracle,
      standardTokenOracle: tusdOracle,
    } = await setupTruefi2(owner, _provider))

    loan = await createLoan(loanFactory, borrower, usdcPool, parseUSDC(1000), YEAR, 1000)
    debtToken1 = await createDebtToken(usdcPool, parseUSDC(1100))
    debtToken2 = await createDebtToken(tusdPool, parseEth(1100))

    await liquidator.setAssurance(assurance.address)

    await usdc.mint(owner.address, parseUSDC(1e7))
    await usdc.approve(usdcPool.address, parseUSDC(1e7))

    await tusd.mint(owner.address, parseEth(1e7))
    await tusd.approve(tusdPool.address, parseEth(1e7))

    await tru.mint(owner.address, parseEth(1e7))
    await tru.mint(otherWallet.address, parseEth(15e6))
    await tru.approve(stkTru.address, parseEth(1e7))
    await tru.connect(otherWallet).approve(stkTru.address, parseEth(1e7))

    await creditOracle.setScore(borrower.address, 255)
    await creditOracle.setMaxBorrowerLimit(borrower.address, parseEth(100_000_000))
  })

  describe('Initializer', () => {
    it('sets stkTru address correctly', async () => {
      expect(await liquidator.stkTru()).to.equal(stkTru.address)
    })

    it('sets tru address correctly', async () => {
      expect(await liquidator.tru()).to.equal(tru.address)
    })

    it('sets loanFactory address correctly', async () => {
      expect(await liquidator.loanFactory()).to.equal(loanFactory.address)
    })

    it('sets poolFactory address correctly', async () => {
      expect(await liquidator.poolFactory()).to.equal(poolFactory.address)
    })

    it('sets fetchMaxShare correctly', async () => {
      expect(await liquidator.fetchMaxShare()).to.equal(1000)
    })

    it('sets assurance correctly', async () => {
      expect(await liquidator.SAFU()).to.equal(assurance.address)
    })

    it('sets tusd oracle correctly', async () => {
      expect(await liquidator.tusdPoolOracle()).to.equal(tusdOracle.address)
    })
  })

  describe('setPoolFactory', () => {
    let fakePoolFactory: PoolFactory
    beforeEach(async () => {
      fakePoolFactory = await new PoolFactory__factory(owner).deploy()
    })

    it('only owner', async () => {
      await expect(liquidator.connect(otherWallet).setPoolFactory(fakePoolFactory.address))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('cannot be set to 0 address', async () => {
      await expect(liquidator.setPoolFactory(AddressZero))
        .to.be.revertedWith('Liquidator: Pool factory address cannot be set to 0')
    })

    it('sets new poolFactory address', async () => {
      await liquidator.setPoolFactory(fakePoolFactory.address)
      expect(await liquidator.poolFactory()).to.eq(fakePoolFactory.address)
    })

    it('emits event', async () => {
      await expect(liquidator.setPoolFactory(fakePoolFactory.address))
        .to.emit(liquidator, 'PoolFactoryChanged')
        .withArgs(fakePoolFactory.address)
    })
  })

  describe('setTusdPoolOracle', () => {
    let fakePoolOracle: MockTrueFiPoolOracle
    beforeEach(async () => {
      fakePoolOracle = await new MockTrueFiPoolOracle__factory(owner).deploy(tusd.address)
    })

    it('only owner', async () => {
      await expect(liquidator.connect(otherWallet).setTusdPoolOracle(fakePoolOracle.address))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('cannot be set to 0 address', async () => {
      await expect(liquidator.setTusdPoolOracle(AddressZero))
        .to.be.revertedWith('Liquidator: Pool oracle cannot be set to 0')
    })

    it('sets new poolOracle address', async () => {
      await liquidator.setTusdPoolOracle(fakePoolOracle.address)
      expect(await liquidator.tusdPoolOracle()).to.eq(fakePoolOracle.address)
    })

    it('emits event', async () => {
      await expect(liquidator.setTusdPoolOracle(fakePoolOracle.address))
        .to.emit(liquidator, 'TusdPoolOracleChanged')
        .withArgs(fakePoolOracle.address)
    })
  })

  describe('setAssurance', () => {
    it('only owner', async () => {
      await expect(liquidator.connect(otherWallet).setAssurance(otherWallet.address))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('sets new assurance', async () => {
      await liquidator.setAssurance(owner.address)
      expect(await liquidator.SAFU()).to.eq(owner.address)
    })

    it('emits event', async () => {
      await expect(liquidator.setAssurance(owner.address))
        .to.emit(liquidator, 'AssuranceChanged')
        .withArgs(owner.address)
    })
  })

  describe('fetchMaxShare', () => {
    it('only owner can set new share', async () => {
      await expect(liquidator.connect(otherWallet).setFetchMaxShare(500))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('cannot set share to 0', async () => {
      await expect(liquidator.setFetchMaxShare(0))
        .to.be.revertedWith('Liquidator: Share cannot be set to 0')
    })

    it('cannot set share to number larger than 10000', async () => {
      await expect(liquidator.setFetchMaxShare(10001))
        .to.be.revertedWith('Liquidator: Share cannot be larger than 10000')
    })

    it('is changed properly', async () => {
      await liquidator.setFetchMaxShare(500)
      expect(await liquidator.fetchMaxShare()).to.equal(500)
    })

    it('emits event', async () => {
      await expect(liquidator.setFetchMaxShare(500))
        .to.emit(liquidator, 'FetchMaxShareChanged')
        .withArgs(500)
    })
  })

  describe('liquidate', () => {
    beforeEach(async () => {
      await usdcPool.connect(owner).join(parseUSDC(1e7))
      await tusdPool.connect(owner).join(parseEth(1e7))
      await lender.connect(borrower).fund(loan.address)
      await withdraw(loan, borrower)
    })

    describe('reverts if', () => {
      it('safu is not the caller', async () => {
        await timeTravel(defaultedLoanCloseTime)
        await loan.enterDefault()

        await expect(liquidator.connect(assurance).liquidate([loan.address]))
          .to.not.be.reverted

        await expect(liquidator.connect(otherWallet).liquidate([loan.address]))
          .to.be.revertedWith('Liquidator: Only SAFU contract can liquidate a loan')
      })

      it('loans are not of a single borrower', async () => {
        await creditOracle.setScore(owner.address, 255)
        await creditOracle.setMaxBorrowerLimit(owner.address, parseEth(100_000_000))
        const loan2 = await createLoan(loanFactory, owner, usdcPool, parseUSDC(1000), YEAR, 1000)
        await lender.connect(owner).fund(loan2.address)
        await withdraw(loan2, owner)

        await timeTravel(defaultedLoanCloseTime)
        await loan.enterDefault()
        await loan2.enterDefault()
        await expect(liquidator.connect(assurance).liquidate([loan.address, loan2.address]))
          .to.be.revertedWith('Liquidator: Loans liquidated in a single transaction, have to be of a single borrower')
      })

      it('loan is not defaulted', async () => {
        await expect(liquidator.connect(assurance).liquidate([loan.address]))
          .to.be.revertedWith('Liquidator: Loan must be defaulted')

        await timeTravel(defaultedLoanCloseTime)
        await loan.enterDefault()
        await expect(liquidator.connect(assurance).liquidate([loan.address]))
          .not.to.be.reverted
      })

      it('loans are not created via factory', async () => {
        const deployContract = setupDeploy(owner)
        const borrowingMutex = await deployContract(BorrowingMutex__factory)
        await borrowingMutex.initialize()
        await borrowingMutex.allowLocker(owner.address, true)
        const fakeLoan = await deployContract(LoanToken2__factory)
        await fakeLoan.initialize(usdcPool.address, borrowingMutex.address, borrower.address, borrower.address, AddressZero, owner.address, liquidator.address, parseUSDC(1000), YEAR, 1000)
        await usdc.connect(borrower).approve(fakeLoan.address, parseUSDC(1000))
        await fakeLoan.connect(borrower).fund()
        await borrowingMutex.lock(borrower.address, await fakeLoan.address)
        await timeTravel(defaultedLoanCloseTime)
        await fakeLoan.enterDefault()
        await loan.enterDefault()

        await expect(liquidator.connect(assurance).liquidate([loan.address, fakeLoan.address]))
          .to.be.revertedWith('Liquidator: Unknown loan')
      })

      it('all pools have to be supported', async () => {
        await poolFactory.unsupportPool(usdcPool.address)
        await expect(liquidator.connect(assurance).liquidate([debtToken1.address, debtToken2.address]))
          .to.be.revertedWith('Liquidator: Pool not supported for default protection')
      })

      it('attempting to default the same loan twice', async () => {
        await timeTravel(defaultedLoanCloseTime)
        await loan.enterDefault()
        await expect(liquidator.connect(assurance).liquidate([loan.address, loan.address]))
          .to.be.revertedWith('Liquidator: Loan must be defaulted')
      })
    })

    describe('Works with loan token', () => {
      beforeEach(async () => {
        await timeTravel(defaultedLoanCloseTime)
        await loan.enterDefault()
      })

      it('changes status', async () => {
        await liquidator.connect(assurance).liquidate([loan.address])
        expect(await loan.status()).to.equal(LoanTokenStatus.Liquidated)
      })

      describe('transfers correct amount of tru to assurance contract', () => {
        describe('whole debt has defaulted', () => {
          it('0 tru in staking pool balance', async () => {
            await liquidator.connect(assurance).liquidate([loan.address])
            expect(await tru.balanceOf(assurance.address)).to.equal(parseTRU(0))
          })

          it('returns max fetch share to assurance', async () => {
            await stkTru.stake(parseTRU(1e3))

            await liquidator.connect(assurance).liquidate([loan.address])
            expect(await tru.balanceOf(assurance.address)).to.equal(parseTRU(1e2))
          })

          it('returns total defaulted value', async () => {
            await stkTru.stake(parseTRU(1e7))

            await liquidator.connect(assurance).liquidate([loan.address])
            expect(await tru.balanceOf(assurance.address)).to.equal(parseTRU(4400))
          })
        })

        describe('only half of debt value has defaulted', () => {
          beforeEach(async () => {
            await usdc.mint(loan.address, parseUSDC(550))
          })

          it('0 tru in staking pool balance', async () => {
            await liquidator.connect(assurance).liquidate([loan.address])
            expect(await tru.balanceOf(assurance.address)).to.equal(parseTRU(0))
          })

          it('returns max fetch share to assurance', async () => {
            await stkTru.stake(parseTRU(1e3))

            await liquidator.connect(assurance).liquidate([loan.address])
            expect(await tru.balanceOf(assurance.address)).to.equal(parseTRU(100))
          })

          it('returns defaulted value', async () => {
            await stkTru.stake(parseTRU(1e7))

            await liquidator.connect(assurance).liquidate([loan.address])
            expect(await tru.balanceOf(assurance.address)).to.equal(parseTRU(22e2))
          })
        })

        describe('half of debt has defaulted and half redeemed', () => {
          beforeEach(async () => {
            await usdc.mint(loan.address, parseUSDC(550))
            await lender.reclaim(loan.address, '0x')
          })

          it('0 tru in staking pool balance', async () => {
            await liquidator.connect(assurance).liquidate([loan.address])
            expect(await tru.balanceOf(assurance.address)).to.equal(parseTRU(0))
          })

          it('returns max fetch share to assurance', async () => {
            await stkTru.stake(parseTRU(1e3))

            await liquidator.connect(assurance).liquidate([loan.address])
            expect(await tru.balanceOf(assurance.address)).to.equal(parseTRU(100))
          })

          it('returns defaulted value', async () => {
            await stkTru.stake(parseTRU(1e7))

            await liquidator.connect(assurance).liquidate([loan.address])
            expect(await tru.balanceOf(assurance.address)).to.equal(parseTRU(22e2))
          })
        })
      })

      it('emits event', async () => {
        await stkTru.stake(parseTRU(1e3))

        await expect(liquidator.connect(assurance).liquidate([loan.address]))
          .to.emit(liquidator, 'Liquidated')
          .withArgs([loan.address], parseEth(1100), parseTRU(100))
      })
    })

    describe('Works with debt token', () => {
      beforeEach(async () => {
        await timeTravel(defaultedLoanCloseTime)
      })

      it('changes status', async () => {
        await liquidator.connect(assurance).liquidate([debtToken1.address, debtToken2.address])
        expect(await debtToken1.status()).to.equal(LoanTokenStatus.Liquidated)
        expect(await debtToken2.status()).to.equal(LoanTokenStatus.Liquidated)
      })

      describe('transfers correct amount of tru to assurance contract', () => {
        describe('whole debt has defaulted', () => {
          it('0 tru in staking pool balance', async () => {
            await liquidator.connect(assurance).liquidate([debtToken1.address, debtToken2.address])
            expect(await tru.balanceOf(assurance.address)).to.equal(parseTRU(0))
          })

          it('returns max fetch share to assurance', async () => {
            await stkTru.stake(parseTRU(1e3))

            await liquidator.connect(assurance).liquidate([debtToken1.address, debtToken2.address])
            expect(await tru.balanceOf(assurance.address)).to.equal(parseTRU(1e2))
          })

          it('returns defaulted value', async () => {
            await stkTru.stake(parseTRU(1e7))

            await liquidator.connect(assurance).liquidate([debtToken1.address, debtToken2.address])
            expect(await tru.balanceOf(assurance.address)).to.equal(parseTRU(8800))
          })
        })

        describe('only half of debt value has defaulted', () => {
          beforeEach(async () => {
            await usdc.mint(debtToken1.address, parseUSDC(550))
          })

          it('0 tru in staking pool balance', async () => {
            await liquidator.connect(assurance).liquidate([debtToken1.address])
            expect(await tru.balanceOf(assurance.address)).to.equal(parseTRU(0))
          })

          it('returns max fetch share to assurance', async () => {
            await stkTru.stake(parseTRU(1e3))

            await liquidator.connect(assurance).liquidate([debtToken1.address])
            expect(await tru.balanceOf(assurance.address)).to.equal(parseTRU(100))
          })

          it('returns defaulted value', async () => {
            await stkTru.stake(parseTRU(1e7))

            await liquidator.connect(assurance).liquidate([debtToken1.address])
            expect(await tru.balanceOf(assurance.address)).to.equal(parseTRU(22e2))
          })
        })
      })

      it('emits event', async () => {
        await stkTru.stake(parseTRU(1e3))

        await expect(liquidator.connect(assurance).liquidate([debtToken1.address]))
          .to.emit(liquidator, 'Liquidated')
          .withArgs([debtToken1.address], parseEth(1100), parseTRU(100))
      })
    })
  })
})
