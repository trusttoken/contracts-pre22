import { utils } from 'ethers'

export const parseTT = (amount: utils.BigNumberish) => utils.parseUnits(amount.toString(), 8)
