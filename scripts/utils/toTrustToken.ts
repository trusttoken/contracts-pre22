import { utils } from 'ethers'

export const toTrustToken = (amount: utils.BigNumberish) => utils.parseUnits(amount.toString(), 8)
