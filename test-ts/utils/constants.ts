import { constants } from 'ethers'

export const BURN_AMOUNT_MULTIPLIER = 12_500_000
export const MAX_BURN_BOUND = constants.MaxUint256.sub(constants.MaxUint256.mod(BURN_AMOUNT_MULTIPLIER))
