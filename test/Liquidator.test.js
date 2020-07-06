const LiquidatorUniswap = artifacts.require('Liquidator')
const BN = web3.utils.toBN
const ONE_ETHER = BN(1e18)
const ONE_BITCOIN = BN(1e8)
const ONE_HUNDRED_ETHER = BN(100).mul(ONE_ETHER)
const ONE_HUNDRED_BITCOIN = BN(100).mul(ONE_BITCOIN)
const assertRevert = require('./helpers/assertRevert.js')
const MockTrustToken = artifacts.require('MockTrustToken')
const TrueUSD = artifacts.require('MockERC20Token')
const UniswapFactory = artifacts.require('uniswap_factory')
const UniswapExchange = artifacts.require('uniswap_exchange')
const Registry = artifacts.require('RegistryMock')
const bytes32 = require('./helpers/bytes32.js')
const APPROVED_BENEFICIARY = bytes32('approvedBeneficiary')

contract('Liquidator', function (accounts) {
  const [, owner, issuer, oneHundred, approvedBeneficiary, fakePool] = accounts
  beforeEach(async function () {
    this.uniswapFactory = await UniswapFactory.new()
    this.uniswapTemplate = await UniswapExchange.new()
    this.uniswapFactory.initializeFactory(this.uniswapTemplate.address)
    this.registry = await Registry.new({ from: owner })
    this.rewardToken = await TrueUSD.new({ from: issuer })
    this.stakeToken = await MockTrustToken.new({ from: issuer })
    await this.stakeToken.initialize(this.registry.address, { from: issuer })
    this.outputUniswapAddress = (await this.uniswapFactory.createExchange(this.rewardToken.address)).logs[0].args.exchange
    this.outputUniswap = await UniswapExchange.at(this.outputUniswapAddress)
    this.stakeUniswap = await UniswapExchange.at((await this.uniswapFactory.createExchange(this.stakeToken.address)).logs[0].args.exchange)
    await this.rewardToken.setRegistry(this.registry.address, { from: issuer })
    await this.rewardToken.mint(oneHundred, ONE_HUNDRED_ETHER, { from: issuer })
    await this.stakeToken.mint(oneHundred, ONE_HUNDRED_BITCOIN, { from: issuer })

    await this.rewardToken.approve(this.outputUniswap.address, ONE_HUNDRED_ETHER, { from: oneHundred })
    await this.stakeToken.approve(this.stakeUniswap.address, ONE_HUNDRED_BITCOIN, { from: oneHundred })
    const expiry = parseInt(Date.now() / 1000) + 12000
    await this.outputUniswap.addLiquidity(ONE_HUNDRED_ETHER, ONE_HUNDRED_ETHER, expiry, { from: oneHundred, value: 1e17 })
    await this.stakeUniswap.addLiquidity(ONE_HUNDRED_BITCOIN, ONE_HUNDRED_BITCOIN, expiry, { from: oneHundred, value: 1e17 })
    await this.rewardToken.mint(oneHundred, ONE_HUNDRED_ETHER, { from: issuer })
    await this.stakeToken.mint(oneHundred, ONE_HUNDRED_BITCOIN, { from: issuer })

    // setup uniswap liquidator
    this.liquidatorUniswap = await LiquidatorUniswap.new({ from: owner })
    await this.liquidatorUniswap.configure(this.registry.address, this.rewardToken.address, this.stakeToken.address, this.outputUniswap.address, this.stakeUniswap.address, { from: owner })
    await this.liquidatorUniswap.setPool(fakePool, { from: owner })
    await this.registry.subscribe(APPROVED_BENEFICIARY, this.liquidatorUniswap.address, { from: owner })
    await this.registry.setAttributeValue(approvedBeneficiary, APPROVED_BENEFICIARY, 1, { from: owner })
    await this.stakeToken.approve(this.liquidatorUniswap.address, ONE_HUNDRED_BITCOIN, { from: fakePool })
  })

  it('correctly sets addresses', async function () {
    assert.equal(await this.liquidatorUniswap.outputToken.call(), this.rewardToken.address)
    assert.equal(await this.liquidatorUniswap.stakeToken.call(), this.stakeToken.address)
    assert.equal(await this.liquidatorUniswap.outputUniswapV1.call(), this.outputUniswap.address)
    assert.equal(await this.liquidatorUniswap.stakeUniswapV1.call(), this.stakeUniswap.address)
    assert.equal(await this.liquidatorUniswap.registry.call(), this.registry.address)
    assert.equal(await this.liquidatorUniswap.pool.call(), fakePool)
  })

  describe('UniswapV1 with LiquidatorUniswap', function () {
    it('can be configured only once', async function () {
      await assertRevert(this.liquidatorUniswap.configure(this.registry.address, this.rewardToken.address, this.stakeToken.address, this.outputUniswap.address, this.stakeUniswap.address, { from: owner }))
    })
    it('Liquidates all stake', async function () {
      await this.stakeToken.transfer(fakePool, ONE_HUNDRED_BITCOIN, { from: oneHundred })
      const reclaimed = await this.liquidatorUniswap.reclaim(approvedBeneficiary, ONE_HUNDRED_ETHER, { from: owner })
      assert.equal(reclaimed.logs.length, 1, 'only one liquidation')
      assert.equal(reclaimed.logs[0].event, 'Liquidated')
      assert(reclaimed.logs[0].args.stakeAmount.eq(ONE_HUNDRED_BITCOIN), 'all stake liquidated')
      const debtAmount = BN('33233233333634234806')
      assert(reclaimed.logs[0].args.debtAmount.eq(debtAmount), 'maximum debt')
      assert(BN(0).eq(await this.stakeToken.balanceOf(fakePool)))
      assert(debtAmount.eq(await this.rewardToken.balanceOf(approvedBeneficiary)))
    })
    it('Liquidates most stake', async function () {
      await this.stakeToken.transfer(fakePool, ONE_HUNDRED_BITCOIN, { from: oneHundred })
      const debt = BN('33233233323634234806')
      const reclaimed = await this.liquidatorUniswap.reclaim(approvedBeneficiary, debt, { from: owner })
      assert.equal(reclaimed.logs.length, 1, 'only one liquidation')
      assert.equal(reclaimed.logs[0].event, 'Liquidated')
      assert(reclaimed.logs[0].args.debtAmount.eq(debt), 'debt filled')
      assert(reclaimed.logs[0].args.stakeAmount.eq(BN('9999999991')), 'stake liquidated')
      assert(debt.eq(await this.rewardToken.balanceOf(approvedBeneficiary)), 'debt reclaimed')
    })
  })
})
