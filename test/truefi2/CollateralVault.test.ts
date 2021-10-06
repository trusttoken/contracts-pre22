import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { Wallet } from 'ethers'
import { setupDeploy } from 'scripts/utils'
import { beforeEachWithFixture, setupTruefi2 } from 'utils'
import {
  CollateralVault,
  CollateralVault__factory,
  BorrowingMutex,
  BorrowingMutex__factory,
  LineOfCreditAgency,
  LineOfCreditAgency__factory,
  Liquidator2,
  Liquidator2__factory,
  TrustToken,
  TrustToken__factory,
} from 'contracts'

use(solidity)

describe('CollateralVault', () => {
  let owner: Wallet
  let borrower: Wallet

  let tru: TrustToken
  let borrowingMutex: BorrowingMutex
  let creditAgency: LineOfCreditAgency
  let liquidator: Liquidator2

  let collateralVault: CollateralVault

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner, borrower] = wallets

    ; ({
      tru,
      borrowingMutex,
      creditAgency,
      liquidator,
      collateralVault,
    } = await setupTruefi2(owner, _provider))
  })

  describe('initializer', () => {
    it('sets owner', async () => {
      expect(await collateralVault.owner()).to.eq(owner.address)
    })

    it('sets stakedToken', async () => {
      expect(await collateralVault.stakedToken()).to.eq(tru.address)
    })

    it('sets borrowingMutex', async () => {
      expect(await collateralVault.borrowingMutex()).to.eq(borrowingMutex.address)
    })

    it('sets lineOfCreditAgency', async () => {
      expect(await collateralVault.lineOfCreditAgency()).to.eq(creditAgency.address)
    })

    it('sets liquidator', async () => {
      expect(await collateralVault.liquidator()).to.eq(liquidator.address)
    })
  })
})
