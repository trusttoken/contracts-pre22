import { constants } from 'ethers'

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
export const BURN_AMOUNT_MULTIPLIER = 12_500_000
export const MAX_BURN_BOUND = constants.MaxUint256.sub(constants.MaxUint256.mod(BURN_AMOUNT_MULTIPLIER))

export const DAY = 60 * 60 * 24
