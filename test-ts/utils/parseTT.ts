import { utils } from 'ethers'
import { BigNumberish } from 'ethers/utils'

export const parseTT = (amount: BigNumberish) => utils.bigNumberify(amount).mul(10 ** 8)
