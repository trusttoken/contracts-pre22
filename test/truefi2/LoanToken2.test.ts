import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { Wallet } from 'ethers'

import { beforeEachWithFixture, DAY, parseEth } from 'utils'

import {
  ImplementationReferenceFactory,
  LoanToken2,
  LoanToken2Factory,
  MockTrueCurrency,
  MockTrueCurrencyFactory,
  PoolFactoryFactory,
  TrueFiPool2Factory,
} from 'contracts'
import { deployContract } from 'scripts/utils/deployContract'
import { AddressZero } from '@ethersproject/constants'

use(solidity)

describe('LoanToken2', () => {
  let lender: Wallet
  let borrower: Wallet
  let loanToken: LoanToken2
  let token: MockTrueCurrency
  let poolAddress: string

  beforeEachWithFixture(async (wallets) => {
    [lender, borrower] = wallets

    token = await new MockTrueCurrencyFactory(lender).deploy()
    await token.initialize()
    await token.mint(lender.address, parseEth(1000))

    const poolFactory = await deployContract(lender, PoolFactoryFactory)
    const poolImplementation = await deployContract(lender, TrueFiPool2Factory)
    const implementationReference = await deployContract(lender, ImplementationReferenceFactory, [poolImplementation.address])
    await poolFactory.initialize(implementationReference.address, AddressZero, AddressZero)
    await poolFactory.whitelist(token.address, true)
    await poolFactory.createPool(token.address)
    poolAddress = await poolFactory.pool(token.address)

    loanToken = await new LoanToken2Factory(lender).deploy(
      poolAddress,
      borrower.address,
      lender.address,
      lender.address, // easier testing purposes
      parseEth(1000),
      DAY,
      1000,
    )

    await token.approve(loanToken.address, parseEth(1000))
  })

  describe('Constructor', () => {
    it('correctly takes token from pool', async () => {
      expect(await loanToken.currencyToken()).to.equal(token.address)
    })

    it('sets pool address', async () => {
      expect(await loanToken.pool()).to.equal(poolAddress)
    })
  })

  it('version', async () => {
    expect(await loanToken.version()).to.equal(4)
  })
})
