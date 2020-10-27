import { beforeEachWithFixture } from '../utils/beforeEachWithFixture'
import { Wallet } from 'ethers'
import { parseEther } from '@ethersproject/units'
import { MockErc20TokenFactory } from '../../build/types/MockErc20TokenFactory'
import { MockErc20Token } from '../../build/types/MockErc20Token'
import { CurvePoolFactory } from '../../build/types/CurvePoolFactory'
import { CurvePool } from '../../build/types/CurvePool'
import { MockCurvePool } from '../../build/types/MockCurvePool'
import { MockCurvePoolFactory } from '../../build/types/MockCurvePoolFactory'
import { Erc20 } from '../../build/types/Erc20'
import { Erc20Factory } from '../../build/types/Erc20Factory'
import { expect } from 'chai'
import { TrueLender } from '../../build/types/TrueLender'
import { TrueLenderFactory } from '../../build/types/TrueLenderFactory'
import TrueRatingAgency from '../../build/TrueRatingAgency.json'
import { deployMockContract, MockContract, MockProvider } from 'ethereum-waffle'
import { LoanTokenFactory } from '../../build/types/LoanTokenFactory'
import { toTrustToken } from '../../scripts/utils'
import { timeTravel } from '../utils/timeTravel'
import { isCloseTo } from '../utils/isCloseTo'

describe('CurvePool', () => {
  let provider: MockProvider
  let owner: Wallet
  let borrower: Wallet
  let token: MockErc20Token
  let cTUSD: Erc20
  let curve: MockCurvePool
  let pool: CurvePool
  let lender: TrueLender
  let mockRatingAgency: MockContract

  const dayInSeconds = 60 * 60 * 24

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner, borrower] = wallets
    token = await new MockErc20TokenFactory(owner).deploy()
    await token.mint(owner.address, parseEther('10000000'))
    curve = await new MockCurvePoolFactory(owner).deploy()
    await curve.initialize(token.address)
    cTUSD = Erc20Factory.connect(await curve.token(), owner)
    pool = await new CurvePoolFactory(owner).deploy()
    mockRatingAgency = await deployMockContract(owner, TrueRatingAgency.abi)
    lender = await new TrueLenderFactory(owner).deploy()
    await pool.initialize(curve.address, token.address, lender.address)
    await lender.initialize(pool.address, mockRatingAgency.address)
    provider = _provider
  })

  describe('poolValue', () => {
    it('equals balance of tusd when no other tokens on balance', async () => {
      await token.approve(pool.address, parseEther('1'))
      await pool.join(parseEther('1'))
      expect(await pool.poolValue()).to.equal(parseEther('1'))
    })

    it('price of loan tokens is added to pool value after loans were given', async () => {
      await token.approve(pool.address, parseEther('10000000'))
      await pool.join(parseEther('10000000'))
      const loan1 = await new LoanTokenFactory(owner).deploy(token.address, borrower.address, parseEther('1000000'), dayInSeconds * 360, 1000)
      await lender.allow(owner.address, true)
      await mockRatingAgency.mock.getResults.returns(0, 0, toTrustToken(1000000))
      await lender.fund(loan1.address)
      await timeTravel(provider, dayInSeconds * 180)
      const loan2 = await new LoanTokenFactory(owner).deploy(token.address, borrower.address, parseEther('1000000'), dayInSeconds * 360, 1000)
      await lender.fund(loan2.address)
      isCloseTo(await pool.poolValue(), parseEther('9000000').add(parseEther('1050000')))
    })
  })

  describe('join-exit', () => {
    it('returns a basket of tokens on exit', async () => {
      await token.approve(pool.address, parseEther('10000000'))
      await pool.join(parseEther('10000000'))
      const loan1 = await new LoanTokenFactory(owner).deploy(token.address, borrower.address, parseEther('1000000'), dayInSeconds * 360, 1000)
      await lender.allow(owner.address, true)
      await mockRatingAgency.mock.getResults.returns(0, 0, toTrustToken(1000000))
      await lender.fund(loan1.address)
      await timeTravel(provider, dayInSeconds * 180)
      const loan2 = await new LoanTokenFactory(owner).deploy(token.address, borrower.address, parseEther('1000000'), dayInSeconds * 360, 2500)
      await lender.fund(loan2.address)

      await pool.exit(parseEther('5000000'))
      expect(await token.balanceOf(owner.address)).to.equal(parseEther('4000000'))
      expect(await loan1.balanceOf(owner.address)).to.equal(parseEther('550000'))
      expect(await loan2.balanceOf(owner.address)).to.equal(parseEther('625000'))
    })

    it('returns a basket of tokens on exit, two stakers', async () => {
      await token.approve(pool.address, parseEther('10000000'))
      await pool.join(parseEther('10000000'))
      const loan1 = await new LoanTokenFactory(owner).deploy(token.address, borrower.address, parseEther('1000000'), dayInSeconds * 360, 1000)
      await lender.allow(owner.address, true)
      await mockRatingAgency.mock.getResults.returns(0, 0, toTrustToken(1000000))
      await lender.fund(loan1.address)
      await timeTravel(provider, dayInSeconds * 180)
      await token.mint(borrower.address, parseEther('1000000'))
      await token.connect(borrower).approve(pool.address, parseEther('1000000'))
      // PoolValue is 1.005M USD at the moment
      // After join, owner has around 91.5% of shares
      await pool.connect(borrower).join(parseEther('1000000'))
      const loan2 = await new LoanTokenFactory(owner).deploy(token.address, borrower.address, parseEther('1000000'), dayInSeconds * 360, 2500)
      await lender.fund(loan2.address)

      await pool.exit(parseEther('5000000'))
      isCloseTo(await token.balanceOf(owner.address), parseEther('4126556')) // 91.5% of 4.5M
      isCloseTo(await loan1.balanceOf(owner.address), parseEther('504356')) // 91.5% of 550K
      isCloseTo(await loan2.balanceOf(owner.address), parseEther('573132')) // 91.5% of 625K
    })
  })

  describe.skip('joining', () => {
    it('correctly transfers tokens', async () => {
      await token.approve(pool.address, parseEther('1'))
      await pool.join(parseEther('1'))
      expect(await pool.balanceOf(owner.address)).to.equal(parseEther('1'))
      expect(await cTUSD.balanceOf(pool.address)).to.equal(parseEther('1'))
      expect(await token.balanceOf(curve.address)).to.equal(parseEther('1'))
    })

    it('minimal token amount on equals 99% of curve estimation', async () => {
      await token.approve(pool.address, parseEther('1'))
      await pool.join(parseEther('1'))
      expect('add_liquidity').to.be.calledOnContractWith(curve, [[0, 0, 0, parseEther('1')], 0])
    })
  })

  describe.skip('exiting', () => {
    beforeEach(async () => {
      await token.approve(pool.address, parseEther('1'))
      await pool.join(parseEther('1'))
    })

    it('correctly transfers tokens', async () => {
      await pool.exit(parseEther('1'))
      expect(await pool.balanceOf(owner.address)).to.equal(0)
      expect(await pool.totalSupply()).to.equal(0)
      expect(await cTUSD.totalSupply()).to.equal(0)
      expect(await token.balanceOf(owner.address)).to.equal(parseEther('1'))
    })

    it('minimal token amount on withdrawal equals 99% of curve estimation', async () => {
      await pool.exit(parseEther('1'))
      expect('remove_liquidity_one_coin').to.be.calledOnContractWith(curve, [parseEther('1'), 3, 0, false])
    })
  })
})
