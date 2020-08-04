import { Wallet } from 'ethers'
import { deployAll } from './deployAll'

export const deployAllWithSetup = async (provider, wallets) => {
  const result = await deployAll(provider, wallets)

  await result.aaveFinancialOpportunity.configure(result.sharesToken.address, result.lendingPool.address, result.token.address, result.assuredFinancialOpportunity.address)
  await result.assuredFinancialOpportunity.configure(
    result.aaveFinancialOpportunity.address,
    Wallet.createRandom().address,
    result.liquidator.address,
    result.fractionalExponents.address,
    result.token.address,
    result.token.address,
  )

  return result
}
