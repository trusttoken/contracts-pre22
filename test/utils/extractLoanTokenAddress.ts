import { ContractTransaction, Wallet } from 'ethers'
import {
  LoanFactory2,
  LoanToken2__factory,
} from 'contracts'

export async function extractLoanTokenAddress (pendingTx: Promise<ContractTransaction>, owner: Wallet, loanFactory: LoanFactory2) {
  const tx = await pendingTx
  const receipt = await tx.wait()
  const iface = loanFactory.interface
  return LoanToken2__factory.connect(receipt.events
    .filter(({ address }) => address === loanFactory.address)
    .map((e) => iface.parseLog(e))
    .find(({ eventFragment }) => eventFragment.name === 'LoanTokenCreated')
    .args.loanToken, owner)
}
