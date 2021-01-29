import { BigNumberish } from 'ethers'
import { parseEth } from './parseEth'

export const parseTRU = (amount: BigNumberish) => parseEth(amount).div(10 ** 10)
