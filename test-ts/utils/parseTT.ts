import { BigNumber } from 'ethers'

export const parseTT = (amount: number) => BigNumber.from(amount).mul(10 ** 8)
