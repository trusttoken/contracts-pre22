import { providers } from 'ethers'
import { Web3Provider } from 'ethers/providers'

export const timeTravel = async (provider: providers.JsonRpcProvider, time: number) => {
  await provider.send('evm_increaseTime', [time])
  await provider.send('evm_mine', [])
}

export const timeTravelTo = async (provider: providers.JsonRpcProvider, timestamp: number) => {
  await provider.send('evm_mine', [timestamp])
}

export const skipBlocksWithProvider = async (provider: Web3Provider, numberOfBlocks: number) => {
  for (let i = 0; i < numberOfBlocks; i++) {
    await provider.send('evm_mine', [])
  }
}

export const skipToBlockWithProvider = async (provider: Web3Provider, targetBlock: number) => {
  const block = await provider.getBlockNumber()
  if (block > targetBlock) {
    throw new Error('Already past target block')
  }
  while (await provider.getBlockNumber() < targetBlock) {
    await provider.send('evm_mine', [])
  }
}
