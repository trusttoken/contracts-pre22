import { expect, use } from 'chai'
import { ImplementationReference, ImplementationReferenceFactory, MockErc20Token, MockErc20TokenFactory, PoolFactory, PoolFactoryFactory, TrueFiPool2, TrueFiPool2Factory } from 'contracts/types'
import { Pool2ArbitrageTestFactory } from 'contracts/types/Pool2ArbitrageTestFactory'
import { solidity } from 'ethereum-waffle'
import { BigNumber, Wallet } from 'ethers'
import { beforeEachWithFixture } from 'utils/beforeEachWithFixture'
import { parseEth } from 'utils/parseEth'

use(solidity)

describe('TrueFiPool2', () => {
  let owner: Wallet
  let borrower: Wallet
  let tusd: MockErc20Token
  let stakingToken: MockErc20Token
  let implementationReference: ImplementationReference
  let poolImplementation: TrueFiPool2
  let pool: TrueFiPool2
  let poolFactory: PoolFactory

  // const dayInSeconds = 60 * 60 * 24
  const includeFee = (amount: BigNumber) => amount.mul(10000).div(9975)

  beforeEachWithFixture(async (wallets) => {
    [owner, borrower] = wallets

    stakingToken = await new MockErc20TokenFactory(owner).deploy()
    tusd = await new MockErc20TokenFactory(owner).deploy()
    poolFactory = await new PoolFactoryFactory(owner).deploy()
    poolImplementation = await new TrueFiPool2Factory(owner).deploy()
    implementationReference = await new ImplementationReferenceFactory(owner).deploy(poolImplementation.address)
    await poolFactory.initialize(implementationReference.address, stakingToken.address)
    await poolFactory.whitelist(tusd.address, true)
    await poolFactory.createPool(tusd.address)
    pool = poolImplementation.attach(await poolFactory.pool(tusd.address))

    await tusd.mint(owner.address, includeFee(parseEth(1e7)))
  })

  describe('initializer', () => {
    it('sets corresponding token', async () => {
      expect(await pool.token()).to.equal(tusd.address)
    })

    it('sets staking token', async () => {
      expect(await pool.stakingToken()).to.eq(stakingToken.address)
    })

    it('sets no initial joiningFee', async () => {
      expect(await pool.joiningFee()).to.eq(0)
    })

    it('sets erc20 params', async () => {
      expect(await pool.name()).to.equal('TrueFi TrueUSD')
      expect(await pool.symbol()).to.equal('tfTUSD')
      expect(await pool.decimals()).to.equal(18)
    })

    it('transfers ownership', async () => {
      expect(await pool.owner()).to.eq(owner.address)
    })
  })

  it('cannot exit and join on same transaction', async () => {
    const arbitrage = await new Pool2ArbitrageTestFactory(owner).deploy()
    await tusd.transfer(arbitrage.address, parseEth(1))
    await expect(arbitrage.joinExit(pool.address)).to.be.revertedWith('TrueFiPool: Cannot join and exit in same block')
  })

  describe('poolValue', () => {
    // requires strategy
    // requires lender
  })

  describe('changeJoiningPauseStatus', () => {
    it('can be called by owner', async () => {
      await expect(pool.changeJoiningPauseStatus(true))
        .not.to.be.reverted
      await expect(pool.changeJoiningPauseStatus(false))
        .not.to.be.reverted
    })

    it('cannot be called by unauthorized address', async () => {
      await expect(pool.connect(borrower).changeJoiningPauseStatus(true))
        .to.be.revertedWith('Ownable: caller is not the owner')
      await expect(pool.connect(borrower).changeJoiningPauseStatus(false))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('properly changes pausing status', async () => {
      expect(await pool.isJoiningPaused()).to.be.false
      await pool.changeJoiningPauseStatus(true)
      expect(await pool.isJoiningPaused()).to.be.true
      await pool.changeJoiningPauseStatus(false)
      expect(await pool.isJoiningPaused()).to.be.false
    })

    it('emits proper event', async () => {
      await expect(pool.changeJoiningPauseStatus(true))
        .to.emit(pool, 'JoiningPauseStatusChanged')
        .withArgs(true)
      await expect(pool.changeJoiningPauseStatus(false))
        .to.emit(pool, 'JoiningPauseStatusChanged')
        .withArgs(false)
    })
  })

  describe('join-exit', () => {
    // requires strategy
    // requires lender
  })

  describe('flush', () => {
    // requires strategy
  })

  describe('pull', () => {
    // requires strategy
  })

  describe('borrow-repay', () => {
    // requires strategy
  })

  describe('collectFees', () => {
    const beneficiary = Wallet.createRandom().address

    beforeEach(async () => {
      await tusd.approve(pool.address, parseEth(1e7))
      await pool.setJoiningFee(25)
      await pool.join(parseEth(1e7))
    })

    it('transfers claimable fees to address', async () => {
      await pool.collectFees(beneficiary)
      expect(await tusd.balanceOf(beneficiary)).to.equal(parseEth(25000))
    })

    it('sets claimableFees to 0', async () => {
      await pool.collectFees(beneficiary)
      expect(await pool.claimableFees()).to.equal(0)
      await expect(pool.collectFees(beneficiary)).to.not.emit(tusd, 'Transfer')
    })

    it('reverts when called not by owner or funds manager', async () => {
      await expect(pool.connect(borrower).collectFees(beneficiary)).to.be.revertedWith('Ownable: caller is not the owner')
    })
  })

  describe('setJoiningFee', () => {
    it('sets fee value', async () => {
      await pool.setJoiningFee(50)
      expect(await pool.joiningFee()).to.equal(50)
    })

    it('reverts when called not by owner', async () => {
      await expect(pool.connect(borrower).setJoiningFee(50)).to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('reverts when JoiningFee set to more than 100%', async () => {
      await expect(pool.setJoiningFee(10100))
        .to.be.revertedWith('TrueFiPool: Fee cannot exceed transaction value')
    })
  })

  describe('integrateAtPoint', () => {
    const calcOffchain = (x: number) => Math.floor(Math.log(x + 50) * 50000)
    it('calculates integral * 1e9', async () => {
      for (let i = 0; i < 100; i++) {
        expect(await pool.integrateAtPoint(i)).to.equal(calcOffchain(i))
      }
    })
  })

  describe('averageExitPenalty', () => {
    const testPenalty = async (from: number, to: number, result: number) => expect(await pool.averageExitPenalty(from, to)).to.equal(result)

    it('throws if from > to', async () => {
      await expect(pool.averageExitPenalty(10, 9)).to.be.revertedWith('TrueFiPool: To precedes from')
    })

    it('correctly calculates penalty when from = to', async () => {
      await testPenalty(0, 0, 1000)
      await testPenalty(1, 1, 980)
      await testPenalty(100, 100, 333)
      await testPenalty(10000, 10000, 0)
    })

    it('correctly calculates penalty when from+1=to', async () => {
      const testWithStep1 = async (from: number) => {
        const penalty = await pool.averageExitPenalty(from, from + 1)
        const expected = (await pool.averageExitPenalty(from, from)).add(await pool.averageExitPenalty(from + 1, from + 1)).div(2)
        expect(penalty.sub(expected).abs()).to.be.lte(1)
      }

      await testWithStep1(0)
      await testWithStep1(1)
      await testWithStep1(2)
      await testWithStep1(3)
      await testWithStep1(5)
      await testWithStep1(10)
      await testWithStep1(42)
      await testWithStep1(150)
      await testWithStep1(1000)
      await testWithStep1(10000 - 2)
    })

    it('correctly calculates penalty when from < to', async () => {
      // Checked with Wolfram Alpha
      await testPenalty(0, 12, 896)
      await testPenalty(1, 100, 544)
      await testPenalty(5, 10, 870)
      await testPenalty(15, 55, 599)
      await testPenalty(42, 420, 215)
      await testPenalty(100, 1000, 108)
      await testPenalty(9100, 10000, 5)
      await testPenalty(1000, 10000, 12)
    })
  })

  describe('liquidExit', () => {
    // requires strategy
    // requires lender
  })
})
