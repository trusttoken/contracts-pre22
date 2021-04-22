import { expect, use } from 'chai'
import {
  ITrueDistributorJson,
  TrueRatingAgencyV2Json,
} from 'build'
import {
  ImplementationReference,
  ImplementationReference__factory,
  LoanFactory2,
  LoanFactory2__factory,
  LoanToken2,
  LoanToken2__factory,
  MockTrueCurrency,
  MockTrueCurrency__factory,
  PoolFactory,
  PoolFactory__factory,
  StkTruToken,
  StkTruToken__factory,
  TrueFiPool2,
  TrueFiPool2__factory,
  TrueLender2,
  TrueLender2__factory,
  Liquidator2,
  Liquidator2__factory,
  MockTrueFiPoolOracle,
  MockTrueFiPoolOracle__factory,
} from 'contracts'

import { deployMockContract, MockContract, MockProvider, solidity } from 'ethereum-waffle'
import { BigNumberish, Contract, Wallet } from 'ethers'
import { Deployer, setupDeploy } from 'scripts/utils'
import { beforeEachWithFixture } from 'utils/beforeEachWithFixture'
import { AddressZero } from '@ethersproject/constants'
import { DAY } from 'utils/constants'
import { parseEth } from 'utils/parseEth'
import { parseTRU } from 'utils/parseTRU'
import { timeTravel } from 'utils/timeTravel'

use(solidity)

describe('Liquidator2', () => {
  enum LoanTokenStatus { Awaiting, Funded, Withdrawn, Settled, Defaulted, Liquidated }

  let provider: MockProvider
  let owner: Wallet
  let otherWallet: Wallet
  let borrower: Wallet
  let deployContract: Deployer

  let liquidator: Liquidator2
  let loanFactory: LoanFactory2
  let poolFactory: PoolFactory
  let token: MockTrueCurrency
  let tru: MockTrueCurrency
  let stkTru: StkTruToken
  let lender: TrueLender2
  let implementationReference: ImplementationReference
  let poolImplementation: TrueFiPool2
  let pool: TrueFiPool2
  let loan: LoanToken2
  let distributor: Contract
  let rater: MockContract
  let oracle: MockTrueFiPoolOracle

  const YEAR = DAY * 365
  const defaultedLoanCloseTime = YEAR + DAY

  const createLoan = async function (factory: LoanFactory2, creator: Wallet, pool: TrueFiPool2, amount: BigNumberish, duration: BigNumberish, apy: BigNumberish) {
    const loanTx = await factory.connect(creator).createLoanToken(pool.address, amount, duration, apy)
    const loanAddress = (await loanTx.wait()).events[0].args.contractAddress
    return new LoanToken2__factory(owner).attach(loanAddress)
  }

  const withdraw = async (wallet: Wallet, beneficiary = wallet.address) =>
    loan.connect(wallet).withdraw(beneficiary)

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner, otherWallet, borrower] = wallets
    provider = _provider
    deployContract = setupDeploy(owner)

    liquidator = await deployContract(Liquidator2__factory)
    loanFactory = await deployContract(LoanFactory2__factory)
    poolFactory = await deployContract(PoolFactory__factory)
    tru = await deployContract(MockTrueCurrency__factory)
    stkTru = await deployContract(StkTruToken__factory)
    lender = await deployContract(TrueLender2__factory)
    poolImplementation = await deployContract(TrueFiPool2__factory)
    implementationReference = await deployContract(ImplementationReference__factory, poolImplementation.address)
    token = await deployContract(MockTrueCurrency__factory)
    oracle = await deployContract(MockTrueFiPoolOracle__factory, token.address)

    rater = await deployMockContract(owner, TrueRatingAgencyV2Json.abi)
    await rater.mock.getResults.returns(0, 0, parseTRU(15e6))
    distributor = await deployMockContract(owner, ITrueDistributorJson.abi)
    await distributor.mock.nextDistribution.returns(0)

    await liquidator.initialize(stkTru.address, tru.address, loanFactory.address)
    await loanFactory.initialize(poolFactory.address, lender.address, liquidator.address)
    await poolFactory.initialize(implementationReference.address, stkTru.address, lender.address)

    await poolFactory.whitelist(token.address, true)
    await poolFactory.createPool(token.address)
    pool = poolImplementation.attach(await poolFactory.pool(token.address))
    await pool.setOracle(oracle.address)

    await tru.initialize()
    await stkTru.initialize(tru.address, pool.address, pool.address, distributor.address, liquidator.address)
    await lender.initialize(stkTru.address, poolFactory.address, rater.address, AddressZero)
    await lender.setFee(0)

    loan = await createLoan(loanFactory, borrower, pool, parseEth(1000), YEAR, 1000)

    await token.mint(owner.address, parseEth(1e7))
    await token.approve(pool.address, parseEth(1e7))
    await tru.mint(owner.address, parseEth(1e7))
    await tru.approve(stkTru.address, parseEth(1e7))
    await tru.mint(otherWallet.address, parseEth(15e6))
    await tru.connect(otherWallet).approve(stkTru.address, parseEth(1e7))
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

    it('sets fetchMaxShare correctly', async () => {
      expect(await liquidator.fetchMaxShare()).to.equal(1000)
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

  describe('setTokenApproval', () => {
    it('only owner can set token approval', async () => {
      await expect(liquidator.connect(otherWallet).setTokenApproval(token.address, true))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('changes whitelist status', async () => {
      await liquidator.setTokenApproval(token.address, true)
      expect(await liquidator.approvedTokens(token.address)).to.eq(true)

      await liquidator.setTokenApproval(token.address, false)
      expect(await liquidator.approvedTokens(token.address)).to.eq(false)
    })

    it('emits event', async () => {
      await expect(liquidator.setTokenApproval(token.address, true))
        .to.emit(liquidator, 'WhitelistStatusChanged')
        .withArgs(token.address, true)

      await expect(liquidator.setTokenApproval(token.address, false))
        .to.emit(liquidator, 'WhitelistStatusChanged')
        .withArgs(token.address, false)
    })
  })

  describe('liquidate', () => {
    beforeEach(async () => {
      await pool.connect(owner).join(parseEth(1e7))
      await lender.connect(borrower).fund(loan.address)
      await withdraw(borrower)
      await liquidator.setTokenApproval(token.address, true)
    })

    it('anyone can call it', async () => {
      await timeTravel(provider, defaultedLoanCloseTime)
      await loan.enterDefault()

      await expect(liquidator.connect(otherWallet).liquidate(loan.address))
        .to.not.be.reverted
    })

    describe('reverts if', () => {
      it('loan is not defaulted', async () => {
        await expect(liquidator.liquidate(loan.address))
          .to.be.revertedWith('Liquidator: Loan must be defaulted')

        await timeTravel(provider, defaultedLoanCloseTime)
        await expect(liquidator.liquidate(loan.address))
          .to.be.revertedWith('Liquidator: Loan must be defaulted')
      })

      it('loan was not created via factory', async () => {
        const fakeLoan = await deployContract(LoanToken2__factory, pool.address, borrower.address, borrower.address, liquidator.address, parseEth(1000), YEAR, 1000)
        await token.connect(borrower).approve(fakeLoan.address, parseEth(1000))
        await fakeLoan.connect(borrower).fund()
        await timeTravel(provider, defaultedLoanCloseTime)
        await fakeLoan.enterDefault()

        await expect(liquidator.liquidate(fakeLoan.address))
          .to.be.revertedWith('Liquidator: Unknown loan')
      })

      it('token is not whitelisted', async () => {
        await liquidator.setTokenApproval(token.address, false)
        await timeTravel(provider, defaultedLoanCloseTime)
        await loan.enterDefault()
        await expect(liquidator.liquidate(loan.address))
          .to.be.revertedWith('Liquidator: Token not approved for default protection')
      })
    })

    it('changes loanToken status', async () => {
      await timeTravel(provider, defaultedLoanCloseTime)
      await loan.enterDefault()

      await liquidator.connect(otherWallet).liquidate(loan.address)
      expect(await loan.status()).to.equal(LoanTokenStatus.Liquidated)
    })

    describe('transfers correct amount of tru to trueFiPool', () => {
      beforeEach(async () => {
        await timeTravel(provider, defaultedLoanCloseTime)
        await loan.enterDefault()
      })

      it('0 tru in staking pool balance', async () => {
        await liquidator.liquidate(loan.address)
        expect(await tru.balanceOf(pool.address)).to.equal(parseTRU(0))
      })

      it('returns max fetch share to pool', async () => {
        await stkTru.stake(parseTRU(1e3))

        await liquidator.liquidate(loan.address)
        expect(await tru.balanceOf(pool.address)).to.equal(parseTRU(1e2))
      })

      it('returns defaulted value', async () => {
        await stkTru.stake(parseTRU(1e7))

        await liquidator.liquidate(loan.address)
        expect(await tru.balanceOf(pool.address)).to.equal(parseTRU(4400))
      })

      describe('only half of loan value has defaulted', () => {
        beforeEach(async () => {
          await token.mint(loan.address, parseEth(550))
        })

        it('0 tru in staking pool balance', async () => {
          await liquidator.liquidate(loan.address)
          expect(await tru.balanceOf(pool.address)).to.equal(parseTRU(0))
        })

        it('returns max fetch share to pool', async () => {
          await stkTru.stake(parseTRU(1e3))

          await liquidator.liquidate(loan.address)
          expect(await tru.balanceOf(pool.address)).to.equal(parseTRU(100))
        })

        it('returns defaulted value', async () => {
          await stkTru.stake(parseTRU(1e7))

          await liquidator.liquidate(loan.address)
          expect(await tru.balanceOf(pool.address)).to.equal(parseTRU(22e2))
        })
      })

      describe('half of loan has defaulted and half redeemed', () => {
        beforeEach(async () => {
          await token.mint(loan.address, parseEth(550))
          await lender.reclaim(loan.address, '0x')
        })

        it('0 tru in staking pool balance', async () => {
          await liquidator.liquidate(loan.address)
          expect(await tru.balanceOf(pool.address)).to.equal(parseTRU(0))
        })

        it('returns max fetch share to pool', async () => {
          await stkTru.stake(parseTRU(1e3))

          await liquidator.liquidate(loan.address)
          expect(await tru.balanceOf(pool.address)).to.equal(parseTRU(100))
        })

        it('returns defaulted value', async () => {
          await stkTru.stake(parseTRU(1e7))

          await liquidator.liquidate(loan.address)
          expect(await tru.balanceOf(pool.address)).to.equal(parseTRU(22e2))
        })
      })
    })

    it('emits event', async () => {
      await stkTru.stake(parseTRU(1e3))
      await timeTravel(provider, defaultedLoanCloseTime)
      await loan.enterDefault()

      await expect(liquidator.liquidate(loan.address))
        .to.emit(liquidator, 'Liquidated')
        .withArgs(loan.address, parseEth(1100), parseTRU(100))
    })
  })
})
