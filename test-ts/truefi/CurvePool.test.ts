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

describe('Curve Pool', () => {
  let owner: Wallet
  let token: MockErc20Token
  let cTUSD: Erc20
  let curve: MockCurvePool
  let pool: CurvePool

  beforeEachWithFixture(async (wallets) => {
    [owner] = wallets
    token = await new MockErc20TokenFactory(owner).deploy()
    await token.mint(owner.address, parseEther('1'))
    curve = await new MockCurvePoolFactory(owner).deploy(token.address)
    cTUSD = Erc20Factory.connect(await curve.token(), owner)
    pool = await new CurvePoolFactory(owner).deploy(curve.address, token.address, owner.address)
  })

  describe('joining', () => {
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
      expect('add_liquidity').to.be.calledOnContractWith(curve, [[0, 0, 0, parseEther('1')], parseEther('0.95')])
    })
  })

  describe('exiting', () => {
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
      expect('remove_liquidity_one_coin').to.be.calledOnContractWith(curve, [parseEther('1'), 3, parseEther('0.95'), false])
    })
  })
})
