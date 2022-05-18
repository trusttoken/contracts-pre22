import { BigNumber, BigNumberish, Wallet, utils, providers } from 'ethers'
import { AddressZero } from '@ethersproject/constants'
import { solidity } from 'ethereum-waffle'
import { expect, use } from 'chai'
import { waffle, network } from 'hardhat'

import { timeTravel } from 'utils'
import {
  MockV3Aggregator,
  MockV3Aggregator__factory,
  TrueCurrencyWithPoR,
  TrueUsdWithPoR__factory,
} from 'contracts'

use(solidity)

// = base * 10^{exponent}
const exp = (base: BigNumberish, exponent: BigNumberish): BigNumber => {
  return BigNumber.from(base).mul(BigNumber.from(10).pow(exponent))
}

describe('TrueCurrency with Proof-of-reserves check', () => {
  const ONE_DAY_SECONDS = 24 * 60 * 60 // seconds in a day
  const TUSD_FEED_INITIAL_ANSWER = exp(1_000_000, 18).toString() // "1M TUSD in reserves"
  const AMOUNT_TO_MINT = utils.parseEther('1000000')
  let token: TrueCurrencyWithPoR
  let mockV3Aggregator: MockV3Aggregator
  let owner: Wallet

  before(async () => {
    const provider = waffle.provider;
    [owner] = provider.getWallets()

    token = (await new TrueUsdWithPoR__factory(owner).deploy()) as TrueCurrencyWithPoR

    // Deploy a mock aggregator to mock PoR feed answers
    mockV3Aggregator = await new MockV3Aggregator__factory(owner).deploy(
      '18',
      TUSD_FEED_INITIAL_ANSWER,
    )
  })

  beforeEach(async () => {
    // Reset pool PoR feed defaults
    const currentFeed = await token.chainReserveFeed()
    if (currentFeed.toLowerCase() !== mockV3Aggregator.address.toLowerCase()) {
      await token.setChainReserveFeed(mockV3Aggregator.address)
    }
    const currentHeartbeat = await token.chainReserveHeartbeat()
    const MAX_AGE = await token.MAX_AGE()
    if (!currentHeartbeat.eq(MAX_AGE)) {
      await token.setChainReserveHeartbeat(0)
    }

    // Set fresh, valid answer on mock PoR feed
    const tusdSupply = await token.totalSupply()
    await mockV3Aggregator.updateAnswer(tusdSupply.add(AMOUNT_TO_MINT))
  })

  it('should mint successfully when feed is unset', async () => {
    // Make sure feed is unset
    await token.setChainReserveFeed(AddressZero)
    expect(await token.chainReserveFeed()).to.equal(AddressZero)

    // Mint TUSD
    const balanceBefore = await token.balanceOf(owner.address)
    await token.mint(owner.address, AMOUNT_TO_MINT)
    expect(await token.balanceOf(owner.address)).to.equal(balanceBefore.add(AMOUNT_TO_MINT))
  })

  it('should mint successfully when feed is set, but heartbeat is unset (defaulting to MAX_AGE)', async () => {
    // Mint TUSD
    const balanceBefore = await token.balanceOf(owner.address)
    await token.mint(owner.address, AMOUNT_TO_MINT, {
      gasLimit: 200_000,
    })
    expect(await token.balanceOf(owner.address)).to.equal(AMOUNT_TO_MINT.add(balanceBefore))
  })

  it('should mint successfully when both feed and heartbeat are set', async () => {
    // Set heartbeat to 1 day
    await token.setChainReserveHeartbeat(ONE_DAY_SECONDS)
    expect(await token.chainReserveHeartbeat()).to.equal(ONE_DAY_SECONDS)

    // Mint TUSD
    const balanceBefore = await token.balanceOf(owner.address)
    await token.mint(owner.address, AMOUNT_TO_MINT)
    expect(await token.balanceOf(owner.address)).to.equal(balanceBefore.add(AMOUNT_TO_MINT))
  })

  it('should mint successfully when feed decimals < TrueCurrency decimals', async () => {
    // Re-deploy a mock aggregator with fewer decimals
    const currentTusdSupply = await token.totalSupply()
    const validReserve = currentTusdSupply.div(exp(1, 12)).add(AMOUNT_TO_MINT)
    const mockV3AggregatorWith6Decimals = await new MockV3Aggregator__factory(owner).deploy('6', validReserve)
    // Set feed and heartbeat on newly-deployed aggregator
    await token.setChainReserveFeed(mockV3AggregatorWith6Decimals.address)
    expect(await token.chainReserveFeed()).to.equal(mockV3AggregatorWith6Decimals.address)

    // Mint TUSD
    const balanceBefore = await token.balanceOf(owner.address)
    await token.mint(owner.address, AMOUNT_TO_MINT, {
      gasLimit: 200_000,
    })
    expect(await token.balanceOf(owner.address)).to.equal(balanceBefore.add(AMOUNT_TO_MINT))
  })

  it('should mint successfully when feed decimals > TrueCurrency decimals', async () => {
    // Re-deploy a mock aggregator with more decimals
    const currentTusdSupply = await token.totalSupply()
    const validReserve = currentTusdSupply.mul(exp(1, 2)).add(AMOUNT_TO_MINT)
    const mockV3AggregatorWith20Decimals = await new MockV3Aggregator__factory(owner).deploy('20', validReserve)
    // Set feed and heartbeat on newly-deployed aggregator
    await token.setChainReserveFeed(mockV3AggregatorWith20Decimals.address)
    expect(await token.chainReserveFeed()).to.equal(mockV3AggregatorWith20Decimals.address)

    // Mint TUSD
    const balanceBefore = await token.balanceOf(owner.address)
    await token.mint(owner.address, AMOUNT_TO_MINT, {
      gasLimit: 200_000,
    })
    expect(await token.balanceOf(owner.address)).to.equal(balanceBefore.add(AMOUNT_TO_MINT))
  })

  it('should mint successfully when TrueCurrency supply == proof-of-reserves', async () => {
    // Mint TUSD
    const balanceBefore = await token.balanceOf(owner.address)
    await token.mint(owner.address, AMOUNT_TO_MINT)
    expect(await token.balanceOf(owner.address)).to.equal(balanceBefore.add(AMOUNT_TO_MINT))
  })

  it('should revert if TrueCurrency supply > proof-of-reserves', async () => {
    const currentTusdSupply = await token.totalSupply()
    const notEnoughReserves = currentTusdSupply.sub('1')
    await mockV3Aggregator.updateAnswer(notEnoughReserves)

    // Mint TUSD
    const balanceBefore = await token.balanceOf(owner.address)
    await expect(token.mint(owner.address, AMOUNT_TO_MINT)).to.be.revertedWith(
      'TrueCurrency: total supply would exceed reserves after mint',
    )
    expect(await token.balanceOf(owner.address)).to.equal(balanceBefore)
  })

  it('should revert if the feed is not updated within the heartbeat', async () => {
    // Set heartbeat to 1 day
    await token.setChainReserveHeartbeat(ONE_DAY_SECONDS)
    expect(await token.chainReserveHeartbeat()).to.equal(ONE_DAY_SECONDS)

    // Heartbeat is set to 1 day, so fast-forward 2 days
    await timeTravel(<unknown> network.provider as providers.JsonRpcProvider, 2 * ONE_DAY_SECONDS)

    // Mint TUSD
    const balanceBefore = await token.balanceOf(owner.address)
    await expect(token.mint(owner.address, AMOUNT_TO_MINT)).to.be.revertedWith('TrueCurrency: PoR answer too old')
    expect(await token.balanceOf(owner.address)).to.equal(balanceBefore)
  })

  it('should revert if feed returns an invalid answer', async () => {
    // Update feed with invalid answer
    await mockV3Aggregator.updateAnswer(0)

    // Mint TUSD
    const balanceBefore = await token.balanceOf(owner.address)
    await expect(token.mint(owner.address, AMOUNT_TO_MINT)).to.be.revertedWith('TrueCurrency: Invalid answer from PoR feed')
    expect(await token.balanceOf(owner.address)).to.equal(balanceBefore)
  })
})
