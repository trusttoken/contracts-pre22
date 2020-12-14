import { expect } from 'chai'
import { BigNumber } from 'ethers'

export const expectCloseTo = (a: BigNumber, b: BigNumber, eps = 10000) => {
  if (b.eq(a)) {
    return true
  }
  if (b.gt(a)) {
    [a, b] = [b, a]
  }
  try {
    expect(a.div(a.sub(b))).to.be.gt(eps)
  } catch (e) {
    throw new Error(`Expected ${a.toString()} to be close to ${b.toString()}. But it wasn't.`)
  }
}
