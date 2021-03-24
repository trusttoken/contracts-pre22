import { expect, use } from 'chai'
import { beforeEachWithFixture, DAY } from 'utils'
import { deployContract } from 'scripts/utils/deployContract'
import {
  ImplementationReferenceFactory,
  LoanToken2,
  LoanToken2Factory,
  MockErc20TokenFactory,
  PoolFactoryFactory,
  StkTruTokenJson, TrueFiPool2,
  TrueFiPool2Factory,
  TrueLender2,
  TrueLender2Factory,
} from 'contracts'
import { deployMockContract, solidity } from 'ethereum-waffle'
import { AddressZero } from '@ethersproject/constants'
import { Wallet } from 'ethers'

use(solidity)

describe('TrueLender2', () => {
  let owner: Wallet
  let borrower: Wallet
  let loan1: LoanToken2
  let loan2: LoanToken2
  let lender: TrueLender2
  let counterfeitPool: TrueFiPool2

  beforeEachWithFixture(async (wallets) => {
    ([owner, borrower] = wallets)
    const poolFactory = await deployContract(owner, PoolFactoryFactory)
    const poolImplementation = await deployContract(owner, TrueFiPool2Factory)
    const implementationReference = await deployContract(owner, ImplementationReferenceFactory, [poolImplementation.address])
    await poolFactory.initialize(implementationReference.address)

    const mockStake = await deployMockContract(owner, StkTruTokenJson.abi)
    await mockStake.mock.payFee.returns()

    lender = await deployContract(owner, TrueLender2Factory)
    await lender.initialize(mockStake.address, poolFactory.address)

    const token1 = await deployContract(owner, MockErc20TokenFactory)
    const token2 = await deployContract(owner, MockErc20TokenFactory)
    await poolFactory.whitelist(token1.address, true)
    await poolFactory.whitelist(token2.address, true)

    await poolFactory.createPool(token1.address)
    await poolFactory.createPool(token2.address)

    const pool1Address = await poolFactory.pool(token1.address)
    const pool2Address = await poolFactory.pool(token2.address)

    counterfeitPool = await deployContract(owner, TrueFiPool2Factory)
    await counterfeitPool.initialize(token1.address, owner.address)

    loan1 = await deployContract(owner, LoanToken2Factory, [
      pool1Address,
      borrower.address,
      lender.address,
      AddressZero,
      100000,
      DAY,
      100,
    ])

    loan2 = await deployContract(owner, LoanToken2Factory, [
      pool2Address,
      borrower.address,
      lender.address,
      AddressZero,
      100000,
      DAY,
      100,
    ])
  })

  describe('Funding', () => {
    describe('reverts if', () => {
      it('transaction not called by the borrower', async () => {
        await expect(lender.fund(loan1.address)).to.be.revertedWith('TrueLender: Sender is not borrower')
      })

      it('loan was created for unknown pool', async () => {
        const badLoan = await deployContract(owner, LoanToken2Factory, [
          counterfeitPool.address,
          borrower.address,
          lender.address,
          AddressZero,
          100000,
          DAY,
          100,
        ])
        await expect(lender.connect(borrower).fund(badLoan.address)).to.be.revertedWith('TrueLender: Pool not created by the factory')
      })

      it('there are too many loans for given pool', async () => {
        await lender.setLoansLimit(1)
        await lender.connect(borrower).fund(loan1.address)
        await expect(lender.connect(borrower).fund(loan1.address)).to.be.revertedWith('TrueLender: Loans number has reached the limit')
      })
    })
  })
})
