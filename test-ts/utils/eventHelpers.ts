import { Contract, ContractTransaction, BigNumberish, Transaction } from 'ethers'
import { expect } from 'chai'

export const expectEvent = (contract: Contract, eventName: string) => async (tx: Transaction, ...args: any[]) => {
  await expect(Promise.resolve(tx)).to.emit(contract, eventName).withArgs(...args)
}
export const expectTransferEventOn = (contract: Contract) => async (tx: Transaction, from: string, to: string, amount: BigNumberish) => {
  await expectEvent(contract, 'Transfer')(tx, from, to, amount)
}
export const expectBurnEventOn = (contract: Contract) => async (tx: Transaction, from: string, amount: BigNumberish) => {
  await expectEvent(contract, 'Burn')(tx, from, amount)
}
export const expectMintEventOn = (contract: Contract) => async (tx: Transaction, to: string, amount: BigNumberish) => {
  await expectEvent(contract, 'Mint')(tx, to, amount)
}
export const expectEventsCountOn = (contract: Contract) => async (eventName: string, tx: ContractTransaction, count: number) => {
  expect((await tx.wait()).events.filter(({ address, event }) => address === contract.address && event === eventName).length).to.equal(count)
}
