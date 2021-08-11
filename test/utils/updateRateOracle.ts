import { TestTimeAveragedBaseRateOracle, TimeAveragedBaseRateOracle } from "contracts"
import { MockProvider } from "ethereum-waffle"
import { timeTravelTo } from "."


export const updateRateOracle = async (oracle: TimeAveragedBaseRateOracle | TestTimeAveragedBaseRateOracle, cooldown: number, provider: MockProvider) => {
  const [, timestamps, currIndex] = await oracle.getTotalsBuffer()
  const newestTimestamp = timestamps[currIndex].toNumber()
  await timeTravelTo(provider, newestTimestamp + cooldown - 1)
  await oracle.update()
}