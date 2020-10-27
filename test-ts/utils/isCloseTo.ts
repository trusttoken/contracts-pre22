import { expect } from 'chai'
import { BigNumber } from 'ethers'

export const isCloseTo = (a: BigNumber, b: BigNumber) => {
  if (b.eq(a)) {
    return true
  }
  if (b.gt(a)) {
    [a, b] = [b, a]
  }
  expect(a.div(a.sub(b))).to.be.gt(10000)
}
