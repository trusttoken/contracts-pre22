import { CONTRACTS_OWNER, forkChain } from './suite'
import {
  TestAaveBaseRateOracle,
  TestAaveBaseRateOracle__factory,
} from 'contracts'
import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { DAY } from 'utils'

use(solidity)

describe('AaveBaseRateOracle', () => {
  const AAVE_LENDING_POOL = '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9'
  const USDC_ADDRESS = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
  const provider = forkChain('https://eth-mainnet.alchemyapi.io/v2/Vc3xNXIWdxEbDOToa69DhWeyhgFVBDWl', [CONTRACTS_OWNER])
  const owner = provider.getSigner(CONTRACTS_OWNER)

  let oracle: TestAaveBaseRateOracle

  beforeEach(async () => {
    oracle = await new TestAaveBaseRateOracle__factory(owner).deploy(AAVE_LENDING_POOL, DAY, USDC_ADDRESS)
  })

  it('Borrow apy is within common range', async () => {
    const apy = await oracle.getAaveVariableBorrowAPY()
    expect(apy).to.be.within(0, 10000)
  })
})
