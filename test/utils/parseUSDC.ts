import { BigNumberish } from 'ethers'
import { parseEth } from './parseEth'

export const parseUSDC = (amount: BigNumberish) => parseEth(amount).div(10 ** 12)
