import { expect } from 'chai'
import {
  ITrueDistributorJson,
  ILoanFactoryJson,
  Liquidator,
  LiquidatorFactory,
  LoanToken,
  LoanTokenFactory,
  MockErc20Token,
  MockErc20TokenFactory,
  MockTrueCurrency,
  MockTrueCurrencyFactory,
  MockTruPriceOracle,
  MockTruPriceOracleFactory,
  StkTruToken,
  StkTruTokenFactory,
} from 'contracts'
import { deployMockContract, MockContract, MockProvider } from 'ethereum-waffle'
import { Contract, Wallet } from 'ethers'
import { beforeEachWithFixture, parseEth, parseTRU, timeTravel } from 'utils'

describe('Liquidator', () => {
  enum LoanTokenStatus { Awaiting, Funded, Withdrawn, Settled, Defaulted, Liquidated }

  let provider: MockProvider
  let owner: Wallet
  let borrower: Wallet
  let otherWallet: Wallet
  let liquidator: Liquidator

  let tusd: MockTrueCurrency
  let tru: MockErc20Token
  let loanToken: LoanToken
  let pool: MockErc20Token
  let stakingPool: StkTruToken
  let oracle: MockTruPriceOracle
  let distributor: Contract
  let factory: MockContract

  const dayInSeconds = 60 * 60 * 24
  const yearInSeconds = dayInSeconds * 365
  const defaultedLoanCloseTime = yearInSeconds + dayInSeconds

  const withdraw = async (wallet: Wallet, beneficiary = wallet.address) =>
    loanToken.connect(wallet).withdraw(beneficiary)

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner, borrower, otherWallet] = wallets
    provider = _provider

    liquidator = await new LiquidatorFactory(owner).deploy()
    tusd = await new MockTrueCurrencyFactory(owner).deploy()
    tru = await new MockErc20TokenFactory(owner).deploy()
    pool = await new MockErc20TokenFactory(owner).deploy()
    await tusd.initialize()
    distributor = await deployMockContract(owner, ITrueDistributorJson.abi)
    await distributor.mock.nextDistribution.returns(0)
    stakingPool = await new StkTruTokenFactory(owner).deploy()
    oracle = await new MockTruPriceOracleFactory(owner).deploy()
    factory = await deployMockContract(owner, ILoanFactoryJson.abi)
    await factory.mock.isLoanToken.returns(true)

    await stakingPool.initialize(
      tru.address,
      pool.address,
      distributor.address,
      liquidator.address,
    )

    await liquidator.initialize(
      pool.address,
      stakingPool.address,
      tru.address,
      oracle.address,
      factory.address,
    )

    loanToken = await new LoanTokenFactory(owner).deploy(
      tusd.address,
      borrower.address,
      owner.address,
      liquidator.address,
      parseEth(1000),
      yearInSeconds,
      1000,
    )

    await tusd.mint(owner.address, parseEth(1e7))
    await tusd.approve(loanToken.address, parseEth(1e7))
    await tru.mint(owner.address, parseEth(1e7))
    await tru.approve(stakingPool.address, parseEth(1e7))
  })

  describe('Initializer', () => {
    it('trueFiPool set correctly', async () => {
      expect(await liquidator.pool()).to.equal(pool.address)
    })

    it('staking pool set correctly', async () => {
      expect(await liquidator.stkTru()).to.equal(stakingPool.address)
    })

    it('sets fetchMaxShare correctly', async () => {
      expect(await liquidator.fetchMaxShare()).to.equal(1000)
    })

    it('sets tru address correctly', async () => {
      expect(await liquidator.tru()).to.equal(tru.address)
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
      await loanToken.fund()
      await withdraw(borrower)
    })

    it('anyone can call it', async () => {
      await timeTravel(provider, defaultedLoanCloseTime)
      await loanToken.close()

      await expect(liquidator.connect(otherWallet).liquidate(loanToken.address))
        .to.not.be.reverted
    })

    it('reverts if loan is not defaulted', async () => {
      await expect(liquidator.liquidate(loanToken.address))
        .to.be.revertedWith('LoanToken: Current status should be Defaulted')

      await timeTravel(provider, defaultedLoanCloseTime)
      await expect(liquidator.liquidate(loanToken.address))
        .to.be.revertedWith('LoanToken: Current status should be Defaulted')
    })

    it('reverts if loan was not created via factory', async () => {
      await factory.mock.isLoanToken.returns(false)
      await timeTravel(provider, defaultedLoanCloseTime)
      await loanToken.close()

      await expect(liquidator.liquidate(loanToken.address))
        .to.be.revertedWith('Liquidator: Unknown loan')
    })

    it('changes loanToken status', async () => {
      await timeTravel(provider, defaultedLoanCloseTime)
      await loanToken.close()

      await liquidator.connect(otherWallet).liquidate(loanToken.address)
      expect(await loanToken.status()).to.equal(LoanTokenStatus.Liquidated)
    })

    describe('transfers correct amount of tru to trueFiPool', () => {
      beforeEach(async () => {
        await timeTravel(provider, defaultedLoanCloseTime)
        await loanToken.close()
      })

      it('0 tru in staking pool balance', async () => {
        await liquidator.liquidate(loanToken.address)
        expect(await tru.balanceOf(pool.address)).to.equal(parseTRU(0))
      })

      it('returns max fetch share to pool', async () => {
        await stakingPool.stake(parseTRU(1e3))
        await liquidator.liquidate(loanToken.address)
        expect(await tru.balanceOf(pool.address)).to.equal(parseTRU(1e2))
      })

      it('returns defaulted value', async () => {
        await stakingPool.stake(parseTRU(1e7))

        await liquidator.liquidate(loanToken.address)
        expect(await tru.balanceOf(pool.address)).to.equal(parseTRU(4400))
      })

      describe('only half of loan value has defaulted', () => {
        beforeEach(async () => {
          await tusd.mint(loanToken.address, parseEth(550))
        })

        it('0 tru in staking pool balance', async () => {
          await liquidator.liquidate(loanToken.address)
          expect(await tru.balanceOf(pool.address)).to.equal(parseTRU(0))
        })

        it('returns max fetch share to pool', async () => {
          await stakingPool.stake(parseTRU(1e3))
          await liquidator.liquidate(loanToken.address)
          expect(await tru.balanceOf(pool.address)).to.equal(parseTRU(100))
        })

        it('returns defaulted value', async () => {
          await stakingPool.stake(parseTRU(1e7))

          await liquidator.liquidate(loanToken.address)
          expect(await tru.balanceOf(pool.address)).to.equal(parseTRU(22e2))
        })
      })

      describe('half of loan has defaulted and half redeemed', () => {
        beforeEach(async () => {
          await tusd.mint(loanToken.address, parseEth(550))
          await loanToken.redeem(parseEth(500))
        })

        it('0 tru in staking pool balance', async () => {
          await liquidator.liquidate(loanToken.address)
          expect(await tru.balanceOf(pool.address)).to.equal(parseTRU(0))
        })

        it('returns max fetch share to pool', async () => {
          await stakingPool.stake(parseTRU(1e3))
          await liquidator.liquidate(loanToken.address)
          expect(await tru.balanceOf(pool.address)).to.equal(parseTRU(100))
        })

        it('returns defaulted value', async () => {
          await stakingPool.stake(parseTRU(1e7))

          await liquidator.liquidate(loanToken.address)
          expect(await tru.balanceOf(pool.address)).to.equal(parseTRU(22e2))
        })
      })
    })

    it('emits event', async () => {
      await timeTravel(provider, defaultedLoanCloseTime)
      await loanToken.close()

      await expect(liquidator.liquidate(loanToken.address))
        .to.emit(liquidator, 'Liquidated')
        .withArgs(loanToken.address)
    })
  })
})
