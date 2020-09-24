import { expect } from 'chai'
import { Contract, Wallet } from 'ethers'
import { MaxUint256 } from 'ethers/constants'

import { beforeEachWithFixture } from '../utils/beforeEachWithFixture'

import { TrueLendingPoolFactory } from '../../build/types/TrueLendingPoolFactory'
import { TrueLendingPool } from '../../build/types/TrueLendingPool'
import { MockTrueCurrency } from '../../build/types/MockTrueCurrency'
import { MockTrueCurrencyFactory } from '../../build/types/MockTrueCurrencyFactory'
import ITrueFiPoolJson from '../../build/ITrueFiPool.json'
import { deployMockContract } from 'ethereum-waffle'

describe('TrueLendingPool', () => {
  let owner: Wallet
  let otherWallet: Wallet
  let lendingPool: TrueLendingPool
  let tusd: MockTrueCurrency
  let underlyingPool: Contract

  beforeEachWithFixture(async (_provider, wallets) => {
    [owner, otherWallet] = wallets
    tusd = await new MockTrueCurrencyFactory(owner).deploy()
    await tusd.initialize()
    underlyingPool = await deployMockContract(owner, ITrueFiPoolJson.abi)
    await underlyingPool.mock.token.returns(tusd.address)
    lendingPool = await new TrueLendingPoolFactory(owner).deploy(underlyingPool.address)
  })

  describe('Constructor', () => {
    it('sets the pool address', async () => {
      expect(await lendingPool.pool()).to.equal(underlyingPool.address)
    })

    it('approves infinite amount to underlying pool', async () => {
      expect(await tusd.allowance(lendingPool.address, underlyingPool.address)).to.equal(MaxUint256)
    })
  })

  describe('Whitelisting', () => {
    it('changes whitelist status', async () => {
      expect(await lendingPool.whitelisted(otherWallet.address)).to.be.false
      await lendingPool.whitelistForLoan(otherWallet.address, true)
      expect(await lendingPool.whitelisted(otherWallet.address)).to.be.true
      await lendingPool.whitelistForLoan(otherWallet.address, false)
      expect(await lendingPool.whitelisted(otherWallet.address)).to.be.false
    })

    it('emits event', async () => {
      await expect(lendingPool.whitelistForLoan(otherWallet.address, true))
        .to.emit(lendingPool, 'Whitelisted').withArgs(otherWallet.address, true)
      await expect(lendingPool.whitelistForLoan(otherWallet.address, false))
        .to.emit(lendingPool, 'Whitelisted').withArgs(otherWallet.address, false)
    })

    it('reverts when performed by non-owner', async () => {
      await expect(lendingPool.connect(otherWallet).whitelistForLoan(otherWallet.address, true))
        .to.be.revertedWith('caller is not the owner')
    })
  })
})
