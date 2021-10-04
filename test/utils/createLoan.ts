import {
  DebtToken__factory, LegacyLoanToken2, LegacyLoanToken2__factory,
  LoanFactory2,
  LoanToken2__factory,
  TrueFiPool2,
} from 'contracts'
import { BigNumberish, Contract, Wallet } from 'ethers'

export const createLoan = async function (factory: LoanFactory2, creator: Wallet, pool: TrueFiPool2, amount: BigNumberish, duration: BigNumberish, apy: BigNumberish) {
  const fakeFTLA = creator
  const originalFTLA_address = await factory.ftlAgency()
  await factory.setFixedTermLoanAgency(fakeFTLA.address)
  const loanTx = await factory.connect(fakeFTLA).createFTLALoanToken(pool.address, creator.address, amount, duration, apy)
  await factory.setFixedTermLoanAgency(originalFTLA_address)
  const loanAddress = (await loanTx.wait()).events[0].args.loanToken
  return new LoanToken2__factory(creator).attach(loanAddress)
}

export const createDebtToken = async (loanFactory: LoanFactory2, creditAgency: Wallet, owner: Wallet, pool: TrueFiPool2, borrower: Wallet, debt: BigNumberish) => {
  await loanFactory.setCreditAgency(creditAgency.address)
  const tx = await loanFactory.connect(creditAgency).createDebtToken(pool.address, borrower.address, debt)
  const creationEvent = (await tx.wait()).events[1]
  return DebtToken__factory.connect(creationEvent.args.debtToken, owner)
}

export const createLegacyLoan = async (lender: Contract, ...args: Parameters<typeof createLoan>): Promise<LegacyLoanToken2> => {
  const loan = LegacyLoanToken2__factory.connect((await createLoan(...args)).address, args[1])
  await loan.setLender(lender.address)
  return loan
}
