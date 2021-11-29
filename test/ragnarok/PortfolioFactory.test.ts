import { expect } from 'chai'
import { Wallet, ContractTransaction } from 'ethers'
import { MockProvider } from '@ethereum-waffle/provider'

import {
  MockUsdc,
  MockUsdc__factory,
  PortfolioFactory,
  PortfolioFactory__factory,
  BulletLoans,
  BulletLoans__factory,
  PortfolioConfig,
  PortfolioConfig__factory,
  ManagedPortfolio,
  ManagedPortfolio__factory,
} from 'contracts'
import { describe } from 'mocha'

import { parseUSDC, YEAR, ONE_PERCENT } from 'utils'
import { beforeEachWithFixture } from 'fixtures/beforeEachWithFixture'
import { solidityKeccak256 } from 'ethers/lib/utils'

const TEN_PERCENT = 10 * ONE_PERCENT
const DEPOSIT_MESSAGE = 'deposit message'

describe('PortfolioFactory', () => {
  let provider: MockProvider
  let protocolOwner: Wallet
  let protocol: Wallet
  let manager: Wallet

  let factory: PortfolioFactory
  let token: MockUsdc
  let bulletLoans: BulletLoans
  let portfolioConfig: PortfolioConfig

  beforeEachWithFixture(async (wallets, _provider) => {
    [protocolOwner, protocol, manager] = wallets
    provider = _provider

    token = await new MockUsdc__factory(protocolOwner).deploy()
    bulletLoans = await new BulletLoans__factory(protocolOwner).deploy()
    portfolioConfig = await new PortfolioConfig__factory(protocolOwner).deploy(500, protocol.address)
    factory = await new PortfolioFactory__factory(protocolOwner).deploy(bulletLoans.address, portfolioConfig.address)
  })

  describe('constructor parameters', () => {
    it('sets bulletLoans', async () => {
      expect(await factory.bulletLoans()).to.equal(bulletLoans.address)
    })

    it('sets portfolioConfig', async () => {
      expect(await factory.portfolioConfig()).to.equal(portfolioConfig.address)
    })
  })

  describe('createPortfolio', () => {
    let tx: Promise<ContractTransaction>
    let portfolio: ManagedPortfolio

    beforeEach(async () => {
      tx = factory.connect(manager).createPortfolio(
        token.address,
        YEAR,
        parseUSDC(1e7),
        TEN_PERCENT,
        DEPOSIT_MESSAGE,
      )
      const portfolioAddress = await extractPortfolioAddress(tx)
      portfolio = new ManagedPortfolio__factory(manager).attach(portfolioAddress)
    })

    it('sets manager', async () => {
      expect(await portfolio.manager()).to.equal(manager.address)
    })

    it('sets underlyingToken', async () => {
      expect(await portfolio.underlyingToken()).to.equal(token.address)
    })

    it('sets bulletLoans', async () => {
      expect(await portfolio.bulletLoans()).to.equal(bulletLoans.address)
    })

    it('sets portfolioConfig', async () => {
      expect(await portfolio.portfolioConfig()).to.equal(portfolioConfig.address)
    })

    it('sets endDate', async () => {
      const receipt = await (await tx).wait()
      const creationTimestamp = (await provider.getBlock(receipt.blockHash)).timestamp
      expect(await portfolio.endDate()).to.equal(creationTimestamp + YEAR)
    })

    it('sets maxSize', async () => {
      expect(await portfolio.maxSize()).to.equal(parseUSDC(1e7))
    })

    it('sets managerFee', async () => {
      expect(await portfolio.managerFee()).to.equal(TEN_PERCENT)
    })

    it('sets hashedDepositMessage', async () => {
      const hashedMessage = solidityKeccak256(['string'], [DEPOSIT_MESSAGE])
      expect(await portfolio.hashedDepositMessage()).to.equal(hashedMessage)
    })
  })

  const extractPortfolioAddress = async (pendingTx: Promise<ContractTransaction>) => {
    const tx = await pendingTx
    const receipt = await tx.wait()
    const portfolioAddress = receipt.events
      .filter(({ address }) => address === factory.address)
      .find(({ event }) => event === 'PortfolioCreated')
      .args.newPortfolio
    return portfolioAddress
  }
})
