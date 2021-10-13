import {
  DebtToken__factory,
  LoanFactory2,
  LoanToken2__factory,
  TestLegacyLoanToken2__factory,
  TestLoanFactory,
  TestTrueLender,
  TrueFiPool2,
} from 'contracts'
import { BigNumberish, Wallet } from 'ethers'

export const createLoan = async function (factory: LoanFactory2, creator: Wallet, pool: TrueFiPool2, amount: BigNumberish, duration: BigNumberish, apy: BigNumberish) {
  const fakeFTLA = creator
  const originalFTLA_address = await factory.ftlAgency()
  await factory.setFixedTermLoanAgency(fakeFTLA.address)
  const loanTx = await factory.connect(fakeFTLA).createLoanToken(pool.address, creator.address, amount, duration, apy)
  await factory.setFixedTermLoanAgency(originalFTLA_address)
  const loanAddress = (await loanTx.wait()).events[1].args.loanToken
  return new LoanToken2__factory(creator).attach(loanAddress)
}

export const createDebtToken = async (loanFactory: LoanFactory2, creditAgency: Wallet, owner: Wallet, pool: TrueFiPool2, borrower: Wallet, debt: BigNumberish) => {
  await loanFactory.setCreditAgency(creditAgency.address)
  const tx = await loanFactory.connect(creditAgency).createDebtToken(pool.address, borrower.address, debt)
  const creationEvent = (await tx.wait()).events[1]
  return DebtToken__factory.connect(creationEvent.args.debtToken, owner)
}

export const createLegacyLoan = async (loanFactory: TestLoanFactory, pool: TrueFiPool2, lender: TestTrueLender, owner: Wallet, borrower: Wallet, amount: BigNumberish, term: BigNumberish, apy: BigNumberish) => {
  const tx = await loanFactory.createLegacyLoanToken(pool.address, borrower.address, amount, term, apy)
  const receipt = await tx.wait()
  const loan = TestLegacyLoanToken2__factory.connect(receipt.events[0].args[0], owner)
  await loan.setLender(lender.address)
  return loan
}
