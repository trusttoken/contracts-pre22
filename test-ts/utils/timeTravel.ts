import { providers } from 'ethers'

export const timeTravel = async (provider: providers.JsonRpcProvider, time: number) => {
  await provider.send('evm_increaseTime', [time])
  await provider.send('evm_mine', [])
}

export const timeTravelTo = async (provider: providers.JsonRpcProvider, timestamp: number) => {
  await provider.send('evm_mine', [timestamp])
}
