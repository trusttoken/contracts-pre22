import { ContractTransaction, Wallet } from 'ethers'
import {
  DebtToken__factory,
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

export async function extractDebtTokens (loanFactory: LoanFactory2, owner: Wallet, pendingTx: Promise<ContractTransaction>) {
  const tx = await pendingTx
  const receipt = await tx.wait()
  const iface = loanFactory.interface
  return Promise.all(receipt.events
    .filter(({ address }) => address === loanFactory.address)
    .map((e) => iface.parseLog(e))
    .filter(({ eventFragment }) => eventFragment.name === 'DebtTokenCreated')
    .map((e) => DebtToken__factory.connect(e.args.debtToken, owner)))
}
