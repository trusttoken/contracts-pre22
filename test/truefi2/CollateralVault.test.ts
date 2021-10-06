import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { Wallet } from 'ethers'
import { setupDeploy } from 'scripts/utils'
import { beforeEachWithFixture } from 'utils'
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

  let tru: TrustToken
  let borrowingMutex: BorrowingMutex
  let lineOfCreditAgency: LineOfCreditAgency
  let liquidator: Liquidator2

  let collateralVault: CollateralVault

  beforeEachWithFixture(async (wallets) => {
    [owner] = wallets
    const deployContract = setupDeploy(owner)

    tru = await deployContract(TrustToken__factory)
    borrowingMutex = await deployContract(BorrowingMutex__factory)
    lineOfCreditAgency = await deployContract(LineOfCreditAgency__factory)
    liquidator = await deployContract(Liquidator2__factory)

    collateralVault = await deployContract(CollateralVault__factory)
    await collateralVault.initialize(tru.address, borrowingMutex.address, lineOfCreditAgency.address, liquidator.address)
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
      expect(await collateralVault.lineOfCreditAgency()).to.eq(lineOfCreditAgency.address)
    })

    it('sets liquidator', async () => {
      expect(await collateralVault.liquidator()).to.eq(liquidator.address)
    })
  })
})
