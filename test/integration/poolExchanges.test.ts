import { upgradeSuite } from './suite'
import { TrueFiPool__factory } from 'contracts'
import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'

use(solidity)

describe('[Skip CI] Pool Curve integration', () => {
  it('deposit TUSD to Curve', async () => {
    const pool = await upgradeSuite(TrueFiPool__factory, '0xa1e72267084192Db7387c8CC1328fadE470e4149', [])
    const tusdBalance = await pool.currencyBalance()
    await expect(pool.flush(tusdBalance)).to.be.not.reverted
  })
})
