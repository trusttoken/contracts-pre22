import { MockProvider } from 'ethereum-waffle'
import { timeTravelTo } from '.'
import { BigNumber } from 'ethers'

interface AveragedOracle {
  update(): Promise<unknown>,
  getTotalsBuffer(): Promise<[BigNumber[], BigNumber[], number]>,
}

export const updateRateOracle = async (oracle: AveragedOracle, cooldown: number, provider: MockProvider) => {
  const [, timestamps, currIndex] = await oracle.getTotalsBuffer()
  const newestTimestamp = timestamps[currIndex].toNumber()
  await timeTravelTo(provider, newestTimestamp + cooldown - 1)
  await oracle.update()
}
