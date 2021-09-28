import {
  DebtToken__factory,
  LoanFactory2,
  LoanToken2__factory,
  TrueFiPool2,
} from 'contracts'
import { BigNumberish, Wallet } from 'ethers'
import { connectMockContract } from 'utils/connectMockContract'
import { CreditModelJson } from 'build'
import { MAX_APY } from './constants'

export const createLoan = async function (factory: LoanFactory2, creator: Wallet, pool: TrueFiPool2, amount: BigNumberish, duration: BigNumberish, apy: BigNumberish) {
  const mockCreditModel = connectMockContract(await factory.creditModel(), factory.signer, CreditModelJson.abi)
  await mockCreditModel.mock.fixedTermLoanAdjustment.returns(apy)
  const loanTx = await factory.connect(creator).createLoanToken(pool.address, amount, duration, MAX_APY)
  const loanAddress = (await loanTx.wait()).events[0].args.loanToken
  return new LoanToken2__factory(creator).attach(loanAddress)
}

export const createDebtToken = async (loanFactory: LoanFactory2, creditAgency: Wallet, owner: Wallet, pool: TrueFiPool2, borrower: Wallet, debt: BigNumberish) => {
  await loanFactory.setCreditAgency(creditAgency.address)
  const tx = await loanFactory.connect(creditAgency).createDebtToken(pool.address, borrower.address, debt)
  const creationEvent = (await tx.wait()).events[1]
  return DebtToken__factory.connect(creationEvent.args.debtToken, owner)
}
