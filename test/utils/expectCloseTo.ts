import { expect } from 'chai'
import { BigNumber, BigNumberish, Contract } from 'ethers'

export const expectCloseTo = (a: BigNumber, b: BigNumber, eps = 10000) => {
  if (b.eq(a)) {
    return true
  }
  if (b.gt(a)) {
    [a, b] = [b, a]
  }
  try {
    expect(a.sub(b)).to.be.lt(eps)
  } catch (e) {
    throw new Error(`Expected ${a.toString()} to be close to ${b.toString()}. But it wasn't.`)
  }
}

export const expectScaledCloseTo = (a: BigNumber, b: BigNumber, eps = 10000) => {
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

export const expectBalanceChangeCloseTo = async (callback: () => Promise<unknown>, token: Contract, account: {address: string} | string, expectedChange: BigNumberish, epsilon = '10000000') => {
  const address = typeof account === 'string' ? account : account.address
  const balanceBefore = await token.balanceOf(address)
  await callback()
  const balanceAfter = await token.balanceOf(address)
  const diff = balanceAfter.sub(balanceBefore).sub(expectedChange).abs()
  expect(diff, `Expected balance to change by approx. ${expectedChange.toString()}, but it changed by ${balanceAfter.sub(balanceBefore).toString()}`)
    .to.be.lte(epsilon)
}
