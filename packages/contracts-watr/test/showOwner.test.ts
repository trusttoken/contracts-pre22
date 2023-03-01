import { Contract } from 'ethers'
import { JsonRpcProvider } from '@ethersproject/providers'

describe('show owner', () => {
  it('show', async () => {
    const provider = new JsonRpcProvider('http://127.0.0.1:8822', 688)
    const controllerInterface = ['function owner() view returns (address)']
    const contract = new Contract(
      '0xbEED7380393aD4a0c762ba2B71F8703a81AF2851',
      controllerInterface,
      provider,
    )
    const owner = await contract.owner()
    console.log({ owner })
  })
})
