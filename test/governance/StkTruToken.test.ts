import { use } from 'chai'
import { providers, Wallet } from 'ethers'
import { solidity } from 'ethereum-waffle'

import { setupDeploy } from 'scripts/utils'

import { beforeEachWithFixture } from 'utils'

import {
  MockTrueCurrency,
  MockTrueCurrencyFactory,
  StkTruToken,
  StkTruTokenFactory,
  TrustToken,
  TrustTokenFactory,
} from 'contracts'

use(solidity)

describe('StkTruToken', () => {
  let owner: Wallet
  let trustToken: TrustToken
  let stkToken: StkTruToken
  let tusd: MockTrueCurrency
  let provider: providers.JsonRpcProvider

  beforeEachWithFixture(async (wallets, _provider) => {
    ([owner] = wallets)
    provider = _provider
    const deployContract = setupDeploy(owner)
    trustToken = await deployContract(TrustTokenFactory)
    await trustToken.initialize()
    stkToken = await deployContract(StkTruTokenFactory)
    tusd = await deployContract(MockTrueCurrencyFactory)
    await stkToken.initialize(trustToken.address, stkToken.address)
  })
})
