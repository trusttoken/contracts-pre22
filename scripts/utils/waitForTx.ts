import { ContractReceipt, ContractTransaction } from 'ethers'

export async function waitForTx (transaction: Promise<ContractTransaction>): Promise<ContractReceipt> {
  const response = await transaction
  return response.wait()
}
