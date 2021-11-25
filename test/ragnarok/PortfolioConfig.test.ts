import { PortfolioConfig, PortfolioConfig__factory } from 'contracts'
import { beforeEachWithFixture } from 'fixtures/beforeEachWithFixture'
import { ONE_PERCENT } from 'utils'
import { Wallet } from 'ethers'
import { expect } from 'chai'

describe('PortfolioConfig', () => {
  let owner: Wallet, protocol: Wallet
  let config: PortfolioConfig

  beforeEachWithFixture(async (wallets) => {
    [owner, protocol] = wallets
    config = await new PortfolioConfig__factory(owner).deploy(10 * ONE_PERCENT, protocol.address)
  })

  describe('constructor', () => {
    it('sets fee', async () => {
      expect(await config.protocolFee()).to.equal(10 * ONE_PERCENT)
    })

    it('sets protocol', async () => {
      expect(await config.protocolAddress()).to.equal(protocol.address)
    })
  })

  describe('setFee', () => {
    it('changes fee', async () => {
      await config.setProtocolFee(20 * ONE_PERCENT)
      expect(await config.protocolFee()).to.equal(20 * ONE_PERCENT)
    })

    it('only owner can change fee', async () => {
      await expect(config.connect(protocol).setProtocolFee(20 * ONE_PERCENT)).to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('emits event', async () => {
      await expect(config.setProtocolFee(20 * ONE_PERCENT))
        .to.emit(config, 'ProtocolFeeChanged')
        .withArgs(20 * ONE_PERCENT)
    })
  })

  describe('setProtocolAddress', () => {
    const newProtocol = Wallet.createRandom().address

    it('changes protocol address', async () => {
      await config.setProtocolAddress(newProtocol)
      expect(await config.protocolAddress()).to.equal(newProtocol)
    })

    it('only owner can change protocol address', async () => {
      await expect(config.connect(protocol).setProtocolAddress(newProtocol)).to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('emits event', async () => {
      await expect(config.setProtocolAddress(newProtocol))
        .to.emit(config, 'ProtocolAddressChanged')
        .withArgs(newProtocol)
    })
  })
})
