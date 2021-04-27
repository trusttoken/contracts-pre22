import { upgradeSuite } from './suite'
import { TrueFiPool__factory } from 'contracts'
import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'

use(solidity)

describe('Pool Curve integration', () => {
  it('deposit TUSD to Curve', async () => {
    const pool = await upgradeSuite(TrueFiPool__factory, '0xa1e72267084192Db7387c8CC1328fadE470e4149', [])
    const tusdBalance = await pool.currencyBalance()
    const minAmount = (await pool.calcTokenAmount(tusdBalance)).mul(99).div(100)
    await expect(pool.flush(tusdBalance, minAmount)).to.be.not.reverted
  })
})
