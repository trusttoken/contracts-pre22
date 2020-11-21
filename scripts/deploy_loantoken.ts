/* eslint-disable */
/**
 * ts-node scripts/deploy_trusttoken.ts "{private_key}" "{network}"
 */
import { ethers, providers } from 'ethers'
import { TrustTokenFactory } from '../build/types'
import { LoanTokenFactory } from '../build/types'

async function deploy() {
  // await deployTrustToken().catch(console.error)
  await deployLoanToken().catch(console.error)
}

async function deployLoanToken () {
  const txnArgs = { gasLimit: 4_500_000, gasPrice: 100_000_000_000 }
  const provider = new providers.InfuraProvider(process.argv[3], '81447a33c1cd4eb09efb1e8c388fb28e')
  const wallet = new ethers.Wallet(process.argv[2], provider)
  // 0x0000000000000000000000000000000000085d4780b73119b644ae5ecd22b3760x000000000000000000000000f6e2da7d82ee49f76ce652bc0beb546cbe0ea5210x00000000000000000000000000000000000000000000000000000000000027100x00000000000000000000000000000000000000000000000000000000000027100x00000000000000000000000000000000000000000000000000000000000003e8
  const token = '0x0000000000085d4780B73119b644AE5ecd22b376'
  const borrower = '0xf6E2Da7D82ee49f76CE652bc0BeB546Cbe0Ea521'
  const amount = '10000'
  const term = '10000'
  const apy = '1000'

  const loantoken = await (await new LoanTokenFactory(wallet).deploy(
    token,
    borrower,
    amount,
    term,
    apy,
    txnArgs)).deployed()
  console.log('loantoken address: ', loantoken.address)
}

deploy().catch(console.error)
