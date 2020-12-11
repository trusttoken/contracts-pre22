import { BigNumberish, BigNumber } from 'ethers'

export const parseTRU = (amount: BigNumberish) => BigNumber.from(amount).mul(10 ** 8)
