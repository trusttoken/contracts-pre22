import { expect, use } from 'chai'
import {
  ImplementationReference,
  ImplementationReference__factory,
  LoanFactory2,
  LoanFactory2__factory,
  MockErc20Token,
  MockErc20Token__factory,
  MockUsdStableCoinOracle__factory,
  OwnedProxyWithReference,
  OwnedProxyWithReference__factory,
  PoolFactory,
  PoolFactory__factory,
  Safu,
  Safu__factory,
  FixedTermLoanAgency,
  FixedTermLoanAgency__factory,
  TestTrueLender,
  TestTrueLender__factory,
  TrueFiPool2,
  TrueFiPool2__factory,
} from 'contracts'
import { solidity } from 'ethereum-waffle'
import { Wallet } from 'ethers'
import { beforeEachWithFixture } from 'utils/beforeEachWithFixture'
import { AddressZero } from '@ethersproject/constants'
import { parseEth, parseUSDC } from 'utils'

use(solidity)

describe('PoolFactory', () => {
  let owner: Wallet
  let otherWallet: Wallet
  let borrower: Wallet
  let safu: Safu
  let poolImplementation: TrueFiPool2
  let implementationReference: ImplementationReference
  let factory: PoolFactory
  let token1: MockErc20Token
  let token2: MockErc20Token
  let token3: MockErc20Token
  let token4: MockErc20Token
  let trueLenderInstance1: TestTrueLender
  let trueLenderInstance2: TestTrueLender
  let ftlAgencyInstance1: FixedTermLoanAgency
  let ftlAgencyInstance2: FixedTermLoanAgency
  let loanFactory: LoanFactory2

  beforeEachWithFixture(async (wallets) => {
    [owner, otherWallet, borrower] = wallets
    poolImplementation = await new TrueFiPool2__factory(owner).deploy()
    implementationReference = await new ImplementationReference__factory(owner).deploy(poolImplementation.address)

    factory = await new PoolFactory__factory(owner).deploy()
    token1 = await new MockErc20Token__factory(owner).deploy()
    token2 = await new MockErc20Token__factory(owner).deploy()
    token3 = await new MockErc20Token__factory(owner).deploy()
    token4 = await new MockErc20Token__factory(owner).deploy()
    trueLenderInstance1 = await new TestTrueLender__factory(owner).deploy()
    trueLenderInstance2 = await new TestTrueLender__factory(owner).deploy()
    ftlAgencyInstance1 = await new FixedTermLoanAgency__factory(owner).deploy()
    ftlAgencyInstance2 = await new FixedTermLoanAgency__factory(owner).deploy()
    safu = await new Safu__factory(owner).deploy()
    loanFactory = await new LoanFactory2__factory(owner).deploy()
    await factory.initialize(
      implementationReference.address,
      ftlAgencyInstance1.address,
      safu.address,
      loanFactory.address,
    )
  })

  describe('Initializer', () => {
    it('sets factory owner', async () => {
      expect(await factory.owner()).to.eq(owner.address)
    })

    it('sets pool implementation address', async () => {
      expect(await factory.poolImplementationReference()).to.eq(implementationReference.address)
      expect(await implementationReference.attach(await factory.poolImplementationReference()).implementation()).to.eq(poolImplementation.address)
    })

    it('sets loan factory', async () => {
      expect(await factory.loanFactory()).to.eq(loanFactory.address)
    })

    it('sets allowAll to false', async () => {
      expect(await factory.allowAll()).to.eq(false)
    })

    it('sets maxPools to 10', async () => {
      expect(await factory.maxPools()).to.equal(10)
    })
  })

  describe('setLoanFactory', () => {
    it('can be called by owner', async () => {
      await expect(factory.setLoanFactory(loanFactory.address))
        .not.to.be.reverted
    })

    it('cannot be called by unauthorized address', async () => {
      await expect(factory.connect(borrower).setLoanFactory(loanFactory.address))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('properly changes loanFactory address', async () => {
      const newAddress = Wallet.createRandom().address
      await factory.setLoanFactory(newAddress)
      expect(await factory.loanFactory()).to.equal(newAddress)
      await factory.setLoanFactory(loanFactory.address)
      expect(await factory.loanFactory()).to.equal(loanFactory.address)
    })

    it('cannot be called with zero address', async () => {
      await expect(factory.setLoanFactory(AddressZero)).to.be.revertedWith('PoolFactory: loanFactory is zero address')
    })

    it('emits proper event', async () => {
      await expect(factory.setLoanFactory(loanFactory.address))
        .to.emit(factory, 'LoanFactoryChanged')
        .withArgs(loanFactory.address)
    })
  })

  describe('createPool', () => {
    let creationEventArgs: any
    let proxy: OwnedProxyWithReference
    let pool: TrueFiPool2

    beforeEach(async () => {
      await factory.allowToken(token1.address, true)
      const tx = await factory.createPool(token1.address)
      creationEventArgs = (await tx.wait()).events[2].args

      proxy = OwnedProxyWithReference__factory.connect(await factory.pool(token1.address), owner)

      pool = poolImplementation.attach(proxy.address)
    })

    it('transfers proxy ownership', async () => {
      expect(await proxy.proxyOwner()).to.eq(owner.address)
    })

    it('initializes implementation with ownership', async () => {
      await factory.allowToken(token2.address, true)
      await factory.connect(otherWallet).createPool(token2.address)
      proxy = OwnedProxyWithReference__factory.connect(await factory.pool(token2.address), owner)
      expect(await pool.owner()).to.eq(owner.address)
    })

    it('adds pool to token -> pool mapping', async () => {
      expect(await factory.pool(token1.address)).to.eq(proxy.address)
    })

    it('adds pool to isPool mapping', async () => {
      expect(await factory.isPool(proxy.address)).to.eq(true)
    })

    it('sets safu', async () => {
      expect(await pool.safu()).to.equal(safu.address)
    })

    it('proxy gets correct implementation', async () => {
      expect(await proxy.implementation()).to.eq(poolImplementation.address)
    })

    it('true lender is set correctly', async () => {
      expect(await pool.lender()).to.eq(AddressZero)
    })

    it('loan factory is set correctly', async () => {
      expect(await pool.loanFactory()).to.eq(loanFactory.address)
    })

    it('fixed term loan agency is set correctly', async () => {
      expect(await pool.ftlAgency()).to.eq(ftlAgencyInstance1.address)
    })

    it('cannot create pool for token that already has a pool', async () => {
      await expect(factory.createPool(token1.address))
        .to.be.revertedWith('PoolFactory: This token already has a corresponding pool')
    })

    it('emits event', async () => {
      const proxyAddress = await factory.pool(token1.address)
      expect(creationEventArgs['token']).to.eq(token1.address)
      expect(creationEventArgs['pool']).to.eq(proxyAddress)
    })
  })

  describe('Creating multiple pools', () => {
    let proxy1: OwnedProxyWithReference
    let proxy2: OwnedProxyWithReference

    beforeEach(async () => {
      await factory.allowToken(token1.address, true)
      await factory.allowToken(token2.address, true)
      await factory.createPool(token1.address)
      await factory.createPool(token2.address)
      proxy1 = OwnedProxyWithReference__factory.connect(await factory.pool(token1.address), owner)
      proxy2 = OwnedProxyWithReference__factory.connect(await factory.pool(token2.address), owner)
    })

    it('adds 2 pools for 2 tokens', async () => {
      expect(await proxy1.proxyOwner()).to.eq(owner.address)
      expect(await proxy2.proxyOwner()).to.eq(owner.address)

      expect(await factory.isPool(proxy1.address)).to.eq(true)
      expect(await factory.isPool(proxy2.address)).to.eq(true)

      expect(await factory.pool(token1.address)).to.eq(proxy1.address)
      expect(await factory.pool(token2.address)).to.eq(proxy2.address)

      expect(await proxy1.implementation()).to.eq(poolImplementation.address)
      expect(await proxy2.implementation()).to.eq(poolImplementation.address)
    })

    it('changing reference, changes implementation for both', async () => {
      const newPoolImplementation = await new TrueFiPool2__factory(owner).deploy()
      await implementationReference.setImplementation(newPoolImplementation.address)

      expect(await proxy1.implementation()).to.eq(newPoolImplementation.address)
      expect(await proxy2.implementation()).to.eq(newPoolImplementation.address)
    })

    it('one reference changed, second remains, then change initial implementation', async () => {
      const newPoolImplementation1 = await new TrueFiPool2__factory(owner).deploy()
      const newReference = await new ImplementationReference__factory(owner).deploy(newPoolImplementation1.address)
      const newPoolImplementation2 = await new TrueFiPool2__factory(owner).deploy()

      await proxy1.changeImplementationReference(newReference.address)
      expect(await proxy1.implementation()).to.eq(newPoolImplementation1.address)
      expect(await proxy2.implementation()).to.eq(poolImplementation.address)

      await implementationReference.setImplementation(newPoolImplementation2.address)
      expect(await proxy1.implementation()).to.eq(newPoolImplementation1.address)
      expect(await proxy2.implementation()).to.eq(newPoolImplementation2.address)
    })
  })

  describe('createSingleBorrowerPool', () => {
    let creationEventArgs: any
    let proxy: OwnedProxyWithReference
    let pool: TrueFiPool2

    beforeEach(async () => {
      await factory.allowToken(token1.address, true)
      await factory.whitelistBorrower(borrower.address, true)
      const tx = await factory.connect(borrower).createSingleBorrowerPool(token1.address, 'CompanyName', 'CN')
      creationEventArgs = (await tx.wait()).events[2].args
      proxy = OwnedProxyWithReference__factory.connect(await factory.singleBorrowerPool(borrower.address, token1.address), owner)

      pool = poolImplementation.attach(proxy.address)
    })

    it('transfers proxy ownership', async () => {
      expect(await proxy.proxyOwner()).to.eq(owner.address)
    })

    it('initializes implementation with ownership', async () => {
      await factory.allowToken(token2.address, true)
      await factory.connect(borrower).createSingleBorrowerPool(token2.address, 'CompanyName', 'CN')
      proxy = OwnedProxyWithReference__factory.connect(await factory.pool(token2.address), owner)
      expect(await pool.owner()).to.eq(owner.address)
    })

    it('names pool correctly', async () => {
      expect(await pool.name()).to.eq('TrueFi CompanyName TrueUSD')
      expect(await pool.symbol()).to.eq('tfCNTUSD')
    })

    it('adds pool to token -> pool mapping', async () => {
      expect(await factory.singleBorrowerPool(borrower.address, token1.address)).to.eq(proxy.address)
    })

    it('adds pool to isPool mapping', async () => {
      expect(await factory.isPool(proxy.address)).to.eq(true)
    })

    it('sets safu', async () => {
      expect(await pool.safu()).to.equal(safu.address)
    })

    it('proxy gets correct implementation', async () => {
      expect(await proxy.implementation()).to.eq(poolImplementation.address)
    })

    it('true lender is set correctly', async () => {
      expect(await pool.lender()).to.eq(AddressZero)
    })

    it('fixed term loan agency is set correctly', async () => {
      expect(await pool.ftlAgency()).to.eq(ftlAgencyInstance1.address)
    })

    it('loan factory is set correctly', async () => {
      expect(await pool.loanFactory()).to.eq(loanFactory.address)
    })

    it('cannot create pool for token that already has a pool', async () => {
      await expect(factory.connect(borrower).createSingleBorrowerPool(token1.address, 'CompanyName', 'CN'))
        .to.be.revertedWith('PoolFactory: This borrower and token already have a corresponding pool')
    })

    it('emits event', async () => {
      const proxyAddress = await factory.singleBorrowerPool(borrower.address, token1.address)
      expect(creationEventArgs['borrower']).to.eq(borrower.address)
      expect(creationEventArgs['token']).to.eq(token1.address)
      expect(creationEventArgs['pool']).to.eq(proxyAddress)
    })
  })

  describe('Whitelist', () => {
    beforeEach(async () => {
      await factory.allowToken(token1.address, true)
      await factory.createPool(token1.address)
    })

    it('only owner can call', async () => {
      await expect(factory.connect(otherWallet).allowToken(token1.address, true))
        .to.be.revertedWith('Ownable: caller is not the owner')

      await expect(factory.allowToken(token1.address, true))
        .to.not.be.reverted
    })

    it('can create only whitelisted', async () => {
      await expect(factory.createPool(token2.address))
        .to.be.revertedWith('PoolFactory: This token is not allowed to have a pool')
      await factory.allowToken(token2.address, true)
      await expect(factory.createPool(token2.address))
        .to.not.be.reverted
    })

    it('can create if allowAll is true', async () => {
      await expect(factory.createPool(token2.address))
        .to.be.revertedWith('PoolFactory: This token is not allowed to have a pool')
      await factory.setAllowAll(true)
      expect(await factory.isAllowed(token2.address))
        .to.eq(false)
      await expect(factory.createPool(token2.address))
        .not.to.be.reverted
    })

    it('emits event', async () => {
      await expect(factory.allowToken(token1.address, true))
        .to.emit(factory, 'AllowedStatusChanged')
        .withArgs(token1.address, true)

      await expect(factory.allowToken(token1.address, false))
        .to.emit(factory, 'AllowedStatusChanged')
        .withArgs(token1.address, false)
    })
  })

  describe('supportPool', () => {
    beforeEach(async () => {
      await factory.allowToken(token1.address, true)
      await factory.allowToken(token2.address, true)
      await factory.allowToken(token3.address, true)
      await factory.allowToken(token4.address, true)
      await factory.createPool(token1.address)
      await factory.createPool(token2.address)
      await factory.createPool(token3.address)
      await factory.createPool(token4.address)

      await factory.supportPool((await factory.pool(token1.address)))
      await factory.supportPool((await factory.pool(token2.address)))
      await factory.supportPool((await factory.pool(token4.address)))
    })

    it('reverts if caller is not the owner', async () => {
      const pool3 = await factory.pool(token3.address)
      await expect(factory.connect(borrower).supportPool(pool3))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('reverts if pool was not created by factory', async () => {
      const pool3 = await factory.pool(token3.address)
      await factory.deprecatePool(pool3)
      await factory.removePool(pool3)

      await expect(factory.supportPool(pool3))
        .to.be.revertedWith('PoolFactory: Pool not created by factory')
    })

    it('reverts if pool has already been added', async () => {
      const pool2 = await factory.pool(token2.address)
      await expect(factory.supportPool(pool2))
        .to.be.revertedWith('PoolFactory: Pool is already supported')
    })

    it('reverts if there are too many pools', async () => {
      const pool3 = await factory.pool(token3.address)
      await factory.setMaxPools(2)
      await expect(factory.supportPool(pool3))
        .to.be.revertedWith('PoolFactory: Pools number has reached the limit')
    })

    it('adds pools to array', async () => {
      const pool1 = await factory.pool(token1.address)
      const pool2 = await factory.pool(token2.address)
      const pool3 = await factory.pool(token3.address)
      const pool4 = await factory.pool(token4.address)

      expect(await factory.isSupportedPool(pool3)).to.be.false
      await factory.supportPool(pool3)
      expect(await factory.isSupportedPool(pool3)).to.be.true

      expect(await factory.getSupportedPools()).to.deep.eq([pool1, pool2, pool4, pool3])
    })

    it('emits event', async () => {
      const pool3 = await factory.pool(token3.address)
      await expect(factory.supportPool(pool3))
        .to.emit(factory, 'PoolSupported')
        .withArgs(pool3)
    })
  })

  describe('unsupportPool', () => {
    beforeEach(async () => {
      await factory.allowToken(token1.address, true)
      await factory.allowToken(token2.address, true)
      await factory.allowToken(token3.address, true)
      await factory.allowToken(token4.address, true)
      await factory.createPool(token1.address)
      await factory.createPool(token2.address)
      await factory.createPool(token3.address)
      await factory.createPool(token4.address)

      await factory.supportPool((await factory.pool(token1.address)))
      await factory.supportPool((await factory.pool(token2.address)))
      await factory.supportPool((await factory.pool(token4.address)))
    })

    it('reverts if caller is not the owner', async () => {
      const pool2 = await factory.pool(token2.address)
      await expect(factory.connect(borrower).unsupportPool(pool2))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('reverts if pool not in array', async () => {
      const pool3 = await factory.pool(token3.address)
      await expect(factory.unsupportPool(pool3)).to.be.revertedWith('PoolFactory: Pool already unsupported')
    })

    it('removes pool from array', async () => {
      const pool1 = await factory.pool(token1.address)
      const pool2 = await factory.pool(token2.address)
      const pool4 = await factory.pool(token4.address)

      expect(await factory.isSupportedPool(pool2)).to.be.true
      await factory.unsupportPool(pool2)
      expect(await factory.isSupportedPool(pool2)).to.be.false

      expect(await factory.getSupportedPools()).to.deep.eq([pool1, pool4])
    })

    it('emits event', async () => {
      const pool2 = await factory.pool(token2.address)
      await expect(factory.unsupportPool(pool2))
        .to.emit(factory, 'PoolUnsupported')
        .withArgs(pool2)
    })
  })

  describe('whitelistBorrower', () => {
    it('only owner can call', async () => {
      await expect(factory.connect(otherWallet).whitelistBorrower(borrower.address, true))
        .to.be.revertedWith('Ownable: caller is not the owner')

      await expect(factory.whitelistBorrower(borrower.address, true))
        .to.not.be.reverted
    })

    it('changes whitelist status', async () => {
      await factory.whitelistBorrower(borrower.address, true)
      expect(await factory.isBorrowerWhitelisted(borrower.address)).to.eq(true)

      await factory.whitelistBorrower(borrower.address, false)
      expect(await factory.isBorrowerWhitelisted(borrower.address)).to.eq(false)
    })

    it('emits event', async () => {
      await expect(factory.whitelistBorrower(borrower.address, true))
        .to.emit(factory, 'BorrowerWhitelistStatusChanged')
        .withArgs(borrower.address, true)

      await expect(factory.whitelistBorrower(borrower.address, false))
        .to.emit(factory, 'BorrowerWhitelistStatusChanged')
        .withArgs(borrower.address, false)
    })
  })

  describe('setAllowAll', () => {
    it('only owner can set allowAll', async () => {
      await (expect(factory.connect(otherWallet).setAllowAll(true)))
        .to.be.revertedWith('Ownable: caller is not the owner')
      await (expect(factory.connect(owner).setAllowAll(true)))
        .not.to.be.reverted
    })

    it('toggles correctly', async () => {
      expect(await factory.allowAll())
        .to.eq(false)
      await factory.setAllowAll(true)
      expect(await factory.allowAll())
        .to.eq(true)
      await factory.setAllowAll(false)
      expect(await factory.allowAll())
        .to.eq(false)
    })

    it('emits events', async () => {
      await expect(factory.setAllowAll(true))
        .to.emit(factory, 'AllowAllStatusChanged')
        .withArgs(true)
      await expect(factory.setAllowAll(false))
        .to.emit(factory, 'AllowAllStatusChanged')
        .withArgs(false)
    })
  })

  describe('setFixedTermLoanAgency', () => {
    it('only owner can set ftlAgency', async () => {
      await expect(factory.connect(otherWallet).setFixedTermLoanAgency(ftlAgencyInstance2.address))
        .to.be.revertedWith('Ownable: caller is not the owner')
      await expect(factory.connect(owner).setFixedTermLoanAgency(ftlAgencyInstance2.address))
        .not.to.be.reverted
    })

    it('reverts when set to 0', async () => {
      await expect(factory.setFixedTermLoanAgency(AddressZero))
        .to.be.revertedWith('PoolFactory: FixedTermLoanAgency address cannot be set to 0')
    })

    it('sets new true ftlAgency contract', async () => {
      expect(await factory.ftlAgency()).to.eq(ftlAgencyInstance1.address)
      await factory.connect(owner).setFixedTermLoanAgency(ftlAgencyInstance2.address)
      expect(await factory.ftlAgency()).to.eq(ftlAgencyInstance2.address)
    })
  })

  describe('setSAFU', () => {
    it('can be called by owner', async () => {
      await expect(factory.setSafuAddress(safu.address))
        .not.to.be.reverted
    })

    it('cannot be called by unauthorized address', async () => {
      await expect(factory.connect(otherWallet).setSafuAddress(safu.address))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('properly changes SAFU address', async () => {
      expect(await factory.safu()).to.equal(safu.address)
      await factory.setSafuAddress(otherWallet.address)
      expect(await factory.safu()).to.equal(otherWallet.address)
    })

    it('emits proper event', async () => {
      await expect(factory.setSafuAddress(otherWallet.address))
        .to.emit(factory, 'SafuChanged')
        .withArgs(otherWallet.address)
    })
  })

  describe('setMaxPools', () => {
    it('reverts if not called by the owner', async () => {
      await expect(factory.connect(borrower).setMaxPools(1))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('changes maximum pools capacity', async () => {
      await factory.setMaxPools(1)
      expect(await factory.maxPools()).to.eq(1)
    })

    it('emits event', async () => {
      await expect(factory.setMaxPools(1))
        .to.emit(factory, 'MaxPoolsChanged')
        .withArgs(1)
    })
  })

  describe('supportedPoolsTVL', () => {
    let pool1: TrueFiPool2
    let pool2: TrueFiPool2

    beforeEach(async () => {
      await factory.allowToken(token1.address, true)
      await factory.allowToken(token2.address, true)
      await factory.createPool(token1.address)
      await factory.createPool(token2.address)
      pool1 = TrueFiPool2__factory.connect(await factory.pool(token1.address), owner)
      pool2 = TrueFiPool2__factory.connect(await factory.pool(token2.address), owner)
      const oracle1 = await new MockUsdStableCoinOracle__factory(owner).deploy()
      const oracle2 = await new MockUsdStableCoinOracle__factory(owner).deploy()
      await oracle2.setDecimalAdjustment(12)
      await pool1.setOracle(oracle1.address)
      await pool2.setOracle(oracle2.address)
      await token1.mint(owner.address, parseEth(1000))
      await token2.mint(owner.address, parseUSDC(2000))
      await token1.approve(pool1.address, parseEth(1000))
      await token2.approve(pool2.address, parseUSDC(2000))
      await pool1.join(parseEth(1000))
      await pool2.join(parseUSDC(2000))
      await factory.supportPool(pool1.address)
      await factory.supportPool(pool2.address)
    })

    it('TVL returns sum of poolValues of supported pools', async () => {
      expect(await factory.supportedPoolsTVL()).to.equal(parseEth(3000))
    })

    it('removing pools from supported list reduces TVL', async () => {
      await factory.unsupportPool(pool2.address)
      expect(await factory.supportedPoolsTVL()).to.equal(parseEth(1000))
    })

    it('adding pools to supported list increases TVL', async () => {
      await factory.unsupportPool(pool2.address)
      await factory.supportPool(pool2.address)
      expect(await factory.supportedPoolsTVL()).to.equal(parseEth(3000))
    })
  })
})
