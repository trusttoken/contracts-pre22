import { upgradeSuite } from './suite'
import { TrueFiPool__factory } from 'contracts'
import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { parseUnits } from '@ethersproject/units'

use(solidity)

describe('Pool Curve integration', () => {
  it('deposit TUSD to Curve', async () => {
    const pool = await upgradeSuite(TrueFiPool__factory, '0xa1e72267084192Db7387c8CC1328fadE470e4149', [])
    await expect(pool.flush(parseUnits('1000', 18))).to.be.not.reverted
  })
})
