import {
  LoanFactory2,
  LoanToken2__factory,
  TrueFiPool2,
} from 'contracts'
import { BigNumberish, Wallet } from 'ethers'
import { connectMockContract } from 'utils/connectMockContract'
import { TrueRateAdjusterJson } from 'build'
import { MAX_APY } from './constants'

export const createLoan = async function (factory: LoanFactory2, creator: Wallet, pool: TrueFiPool2, amount: BigNumberish, duration: BigNumberish, apy: BigNumberish) {
  const mockRateAdjuster = connectMockContract(await factory.rateAdjuster(), factory.signer, TrueRateAdjusterJson.abi)
  await mockRateAdjuster.mock.fixedTermLoanAdjustment.returns(apy)
  const loanTx = await factory.connect(creator).createLoanToken(pool.address, amount, duration, MAX_APY)
  const loanAddress = (await loanTx.wait()).events[0].args.contractAddress
  return new LoanToken2__factory(creator).attach(loanAddress)
}
