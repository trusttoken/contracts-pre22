import { expect } from 'chai'
import { Wallet } from 'ethers'

import {
  PortfolioFactory,
  PortfolioFactory__factory,
  BulletLoans,
  BulletLoans__factory,
  PortfolioConfig,
  PortfolioConfig__factory,
} from 'contracts'
import { describe } from 'mocha'

import { beforeEachWithFixture } from 'fixtures/beforeEachWithFixture'

describe('PortfolioFactory', () => {
  let factory: PortfolioFactory

  let protocolOwner: Wallet
  let protocol: Wallet

  let bulletLoans: BulletLoans
  let portfolioConfig: PortfolioConfig

  beforeEachWithFixture(async (wallets) => {
    [protocolOwner, protocol] = wallets

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
})
