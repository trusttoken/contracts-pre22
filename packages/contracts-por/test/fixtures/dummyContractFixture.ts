import { DummyContract__factory } from 'build/types'
import { Wallet } from 'ethers'

export async function dummyContractFixture([wallet]: Wallet[]) {
  const dummyContract = await new DummyContract__factory(wallet).deploy()
  return { dummyContract }
}
