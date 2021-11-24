import { expect } from 'chai'
import { beforeEachWithFixture } from 'fixtures/beforeEachWithFixture'
import { PowTest__factory, PowTest } from 'contracts'
import { BigNumber } from 'ethers'

describe('Power', () => {
  let pow: PowTest
  beforeEachWithFixture(async ([owner]) => {
    pow = await new PowTest__factory(owner).deploy()
  })

  it('calculates x^y', async () => {
    expect(await pow.pow(10000, 5000)).to.be.closeTo(BigNumber.from(100), 1)
    expect(await pow.pow(1000, 3333)).to.be.closeTo(BigNumber.from(10), 1)
    expect(await pow.pow(4, 20000)).to.equal(16)
    expect(await pow.pow(4, 0)).to.equal(1)
  })
})
