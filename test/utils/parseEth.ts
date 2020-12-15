import { BigNumberish } from 'ethers'
import { parseEther } from 'ethers/lib/utils'

export const parseEth = (amount: BigNumberish) => parseEther(amount.toString())
