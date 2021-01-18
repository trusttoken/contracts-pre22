import { expect } from 'chai'
import { beforeEachWithFixture } from 'utils'
import { MockLog, MockLogFactory } from 'contracts'

describe('Log', () => {
  let log: MockLog
  beforeEachWithFixture(async ([owner]) => {
    log = await new MockLogFactory(owner).deploy()
  })

  const checkLog = async (x: number) => {
    const res = await log.ln(x)
    expect(res.mul(1000000).div(2 ** 32).div(2 ** 32).toNumber() / 1000000).to.be.closeTo(Math.log(x), 0.001)
  }

  it('calculates natural logarithm', async () => {
    for (let i = 1; i < 100; i++) {
      await checkLog(i)
    }
  })

  it('calculates logarithm for larger numbers', async () => {
    await checkLog(1e8)
  })
})
