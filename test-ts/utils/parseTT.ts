import { BigNumberish, BigNumber } from 'ethers'

export const parseTT = (amount: BigNumberish) => BigNumber.from(amount).mul(10 ** 8)
