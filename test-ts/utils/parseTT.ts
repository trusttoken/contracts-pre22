import { utils } from 'ethers'

export const parseTT = (amount: number) => utils.bigNumberify(amount).mul(10 ** 8)
