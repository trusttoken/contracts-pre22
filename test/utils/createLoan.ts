import {
  LoanFactory2,
  LoanToken2__factory,
  MockTrueCurrency,
  StkTruToken,
  TrueFiPool2,
  TrueRatingAgencyV2,
} from 'contracts'
import { MockProvider } from 'ethereum-waffle'
import { BigNumberish, Wallet } from 'ethers'
import { DAY, parseTRU, timeTravel } from '.'
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

export const createApprovedLoan = async function (rater: TrueRatingAgencyV2, tru: MockTrueCurrency, stkTru: StkTruToken, factory: LoanFactory2, creator: Wallet, pool: TrueFiPool2, amount: BigNumberish, duration: BigNumberish, apy: BigNumberish, voter: Wallet, provider: MockProvider) {
  await tru.mint(voter.address, parseTRU(15e6))
  await tru.connect(voter).approve(stkTru.address, parseTRU(15e6))
  await stkTru.connect(voter).stake(parseTRU(15e6))
  await timeTravel(provider, 1)

  const loan = await createLoan(factory, creator, pool, amount, duration, apy)

  await rater.allow(creator.address, true)
  await rater.connect(creator).submit(loan.address)
  await rater.connect(voter).yes(loan.address)
  await stkTru.connect(voter).cooldown()
  await timeTravel(provider, 14 * DAY + 1)
  await stkTru.connect(voter).unstake(parseTRU(15e6))

  return loan
}
