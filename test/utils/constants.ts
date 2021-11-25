import { constants } from 'ethers'

export const AddressOne = '0x0000000000000000000000000000000000000001'
export const BURN_AMOUNT_MULTIPLIER = 12_441_000
export const MAX_BURN_BOUND = constants.MaxUint256.sub(constants.MaxUint256.mod(BURN_AMOUNT_MULTIPLIER))

export const MAX_APY = 100_000
export const DAY = 60 * 60 * 24
export const YEAR = 365 * DAY

export const ONE_PERCENT = 100
