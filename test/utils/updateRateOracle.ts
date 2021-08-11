import { TestTimeAveragedBaseRateOracle, TimeAveragedBaseRateOracle } from 'contracts'
import { MockProvider } from 'ethereum-waffle'
import { DAY, timeTravelTo } from '.'

export const updateRateOracle = async (oracle: TimeAveragedBaseRateOracle | TestTimeAveragedBaseRateOracle, cooldown: number, provider: MockProvider) => {
  const [, timestamps, currIndex] = await oracle.getTotalsBuffer()
  const newestTimestamp = timestamps[currIndex].toNumber()
  await timeTravelTo(provider, newestTimestamp + cooldown - 1)
  await oracle.update()
}

export const weeklyFillBaseRateOracles = async (tusdOracle: TimeAveragedBaseRateOracle, usdcOracle: TimeAveragedBaseRateOracle, provider: MockProvider) => {
  for (let i = 0; i < 7; i++) {
    const [, timestamps, currIndex] = await tusdOracle.getTotalsBuffer()
    const newestTimestamp = timestamps[currIndex].toNumber()
    await timeTravelTo(provider, newestTimestamp + DAY - 1)
    await tusdOracle.update()
    await usdcOracle.update()
  }
}
