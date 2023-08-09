import { parseUnits } from 'ethers/lib/utils'

export const trueUSDDecimals = 18
export function parseTrueUSD(amount: string) {
  return parseUnits(amount, trueUSDDecimals)
}
