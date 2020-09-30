import { expect } from 'chai'
import { Contract, Wallet } from 'ethers'
import { AddressZero, MaxUint256 } from 'ethers/constants'

import { beforeEachWithFixture } from '../utils/beforeEachWithFixture'

import { TrueLenderFactory } from '../../build/types/TrueLenderFactory'
import { TrueLender } from '../../build/types/TrueLender'
import { MockTrueCurrency } from '../../build/types/MockTrueCurrency'
import { MockTrueCurrencyFactory } from '../../build/types/MockTrueCurrencyFactory'
import ITrueFiPoolJson from '../../build/ITrueFiPool.json'
import { deployMockContract } from 'ethereum-waffle'
import { BigNumberish, parseEther } from 'ethers/utils'

describe('TrueLender', () => {
  let owner: Wallet
  let otherWallet: Wallet
  let lendingPool: TrueLender
  let tusd: MockTrueCurrency
  let underlyingPool: Contract

  const monthInSeconds = 60 * 60 * 24 * 30

  beforeEachWithFixture(async (_provider, wallets) => {
    [owner, otherWallet] = wallets
    tusd = await new MockTrueCurrencyFactory(owner).deploy()
    await tusd.initialize()
    underlyingPool = await deployMockContract(owner, ITrueFiPoolJson.abi)
    await underlyingPool.mock.token.returns(tusd.address)
    lendingPool = await new TrueLenderFactory(owner).deploy(underlyingPool.address)
  })

  describe('Constructor', () => {
    it('sets the pool address', async () => {
      expect(await lendingPool.pool()).to.equal(underlyingPool.address)
    })

    it('approves infinite amount to underlying pool', async () => {
      expect(await tusd.allowance(lendingPool.address, underlyingPool.address)).to.equal(MaxUint256)
    })

    it('default params', async () => {
      expect(await lendingPool.minSize()).to.equal(parseEther('1000000'))
      expect(await lendingPool.maxSize()).to.equal(parseEther('10000000'))
      expect(await lendingPool.minDuration()).to.equal(monthInSeconds * 6)
      expect(await lendingPool.maxDuration()).to.equal(monthInSeconds * 120)
      expect(await lendingPool.minApy()).to.equal('1000')
    })
  })

  describe('Whitelisting', () => {
    it('changes whitelist status', async () => {
      expect(await lendingPool.borrowers(otherWallet.address)).to.be.false
      await lendingPool.whitelistAsBorrower(otherWallet.address, true)
      expect(await lendingPool.borrowers(otherWallet.address)).to.be.true
      await lendingPool.whitelistAsBorrower(otherWallet.address, false)
      expect(await lendingPool.borrowers(otherWallet.address)).to.be.false
    })

    it('emits event', async () => {
      await expect(lendingPool.whitelistAsBorrower(otherWallet.address, true))
        .to.emit(lendingPool, 'Whitelisted').withArgs(otherWallet.address, true)
      await expect(lendingPool.whitelistAsBorrower(otherWallet.address, false))
        .to.emit(lendingPool, 'Whitelisted').withArgs(otherWallet.address, false)
    })

    it('reverts when performed by non-owner', async () => {
      await expect(lendingPool.connect(otherWallet).whitelistAsBorrower(otherWallet.address, true))
        .to.be.revertedWith('caller is not the owner')
    })
  })

  describe('Parameters set up', () => {
    describe('setMinApy', () => {
      it('changes minApy', async () => {
        await lendingPool.setMinApy(1234)
        expect(await lendingPool.minApy()).to.equal(1234)
      })
      
      it('emits MinApyChanged', async () => {
        await expect(lendingPool.setMinApy(1234)).to.emit(lendingPool, 'MinApyChanged').withArgs(1234)
      })
      
      it('must be called by owner', async () => {
        await expect(lendingPool.connect(otherWallet).setMinApy(1234)).to.be.revertedWith('caller is not the owner')
      })
    })
    
    describe('setSizeLimits', () => {
      it(`changes minSize and maxSize`, async () => {
        await lendingPool.setSizeLimits(7654, 234567)
        expect(await lendingPool.minSize()).to.equal(7654)
        expect(await lendingPool.maxSize()).to.equal(234567)
      })
      
      it(`emits SizeLimitsChanged`, async () => {
        await expect(lendingPool.setSizeLimits(7654, 234567)).to.emit(lendingPool, 'SizeLimitsChanged').withArgs(7654, 234567)
      })
      
      it('must be called by owner', async () => {
        await expect(lendingPool.connect(otherWallet).setSizeLimits(7654, 234567)).to.be.revertedWith('caller is not the owner')
      })

      it('cannot set minSize to be bigger than maxSize', async () => {
        await expect(lendingPool.setSizeLimits(2, 1)).to.be.revertedWith('TrueLender: Maximal loan size is smaller than minimal')
      })
      
      it('can set minSize to same value as maxSize', async () => {
        await expect(lendingPool.setSizeLimits(2, 2)).to.be.not.reverted
      })
    })
    
    describe('setDurationLimits', () => {
      it(`changes minDuration and maxDuration`, async () => {
        await lendingPool.setDurationLimits(7654, 234567)
        expect(await lendingPool.minDuration()).to.equal(7654)
        expect(await lendingPool.maxDuration()).to.equal(234567)
      })
      
      it(`emits DurationLimitsChanged`, async () => {
        await expect(lendingPool.setDurationLimits(7654, 234567)).to.emit(lendingPool, 'DurationLimitsChanged').withArgs(7654, 234567)
      })
      
      it('must be called by owner', async () => {
        await expect(lendingPool.connect(otherWallet).setDurationLimits(7654, 234567)).to.be.revertedWith('caller is not the owner')
      })

      it('cannot set minDuration to be bigger than maxDuration', async () => {
        await expect(lendingPool.setDurationLimits(2, 1)).to.be.revertedWith('TrueLender: Maximal loan duration is smaller than minimal')
      })
      
      it('can set minDuration to same value as maxDuration', async () => {
        await expect(lendingPool.setDurationLimits(2, 2)).to.be.not.reverted
      })
    })
  })

  describe('Submiting/Retracting application', () => {
    beforeEach(async () => {
      await lendingPool.whitelistAsBorrower(owner.address, true)
    })

    it('creates loan application', async () => {
      await lendingPool.submit(otherWallet.address, parseEther('2000000'), 1200, monthInSeconds * 12)

      const application = await lendingPool.applications('0xb159518c94e5ad5b')
      expect(application.creationBlock).to.equal(7)
      expect(application.timestamp).to.be.gt(0)
      expect(application.borrower).to.equal(owner.address)
      expect(application.beneficiary).to.equal(otherWallet.address)
      expect(application.amount).to.equal(parseEther('2000000'))
      expect(application.apy).to.equal(1200)
      expect(application.duration).to.equal(monthInSeconds * 12)
    })

    it('emits event on creation', async () => {
      await expect(lendingPool.submit(otherWallet.address, parseEther('1000000'), 1300, monthInSeconds * 18))
        .to.emit(lendingPool, 'ApplicationSubmitted').withArgs('0x45852ad67ae2dde5', owner.address, otherWallet.address, parseEther('1000000'), 1300, monthInSeconds * 18)
    })

    it('should be whitelisted to create loan application', async () => {
      await expect(lendingPool.connect(otherWallet).submit(otherWallet.address, parseEther('2000000'), 1200, monthInSeconds * 12))
        .to.be.revertedWith('TrueLender: sender not whitelisted')
    })

    it('checks loan amount to be within boundaries', async () => {
      await expect(lendingPool.submit(otherWallet.address, parseEther('999999'), 1200, monthInSeconds * 12))
        .to.be.revertedWith('TrueLender: Loan size is out of bounds')
      await expect(lendingPool.submit(otherWallet.address, parseEther('10000001'), 1200, monthInSeconds * 12))
        .to.be.revertedWith('TrueLender: Loan size is out of bounds')
    })

    it('checks APY to be not below minimum', async () => {
      await expect(lendingPool.submit(otherWallet.address, parseEther('1000000'), 900, monthInSeconds * 12))
        .to.be.revertedWith('TrueLender: APY is below minimum')
    })

    it('application can be removed by borrower', async () => {
      await lendingPool.submit(otherWallet.address, parseEther('2000000'), 1200, monthInSeconds * 12)
      await lendingPool.retract('0xb159518c94e5ad5b')

      const application = await lendingPool.applications('0xb159518c94e5ad5b')
      expect(application.creationBlock).to.equal(0)
      expect(application.borrower).to.equal(AddressZero)
      expect(application.beneficiary).to.equal(AddressZero)
      expect(application.amount).to.equal(0)
      expect(application.apy).to.equal(0)
      expect(application.duration).to.equal(0)
    })

    it('throws when removing not existing application', async () => {
      await expect(lendingPool.retract('0xdf606ca5ed7b19de')).to.be.revertedWith('TrueLender: application doesn\'t exist')
    })

    it('cannot remove application created by someone else', async () => {
      await lendingPool.whitelistAsBorrower(otherWallet.address, true)
      await lendingPool.connect(otherWallet).submit(otherWallet.address, parseEther('2000000'), 1200, monthInSeconds * 12)
      await expect(lendingPool.retract('0x4d0aa9e1b69a8f90')).to.be.revertedWith('TrueLender: not retractor\'s application')
    })

    it('emits event on remove', async () => {
      await lendingPool.submit(otherWallet.address, parseEther('1000000'), 1300, monthInSeconds * 12)
      await expect(lendingPool.retract('0x37b341c3a6e097a7')).to.emit(lendingPool, 'ApplicationRetracted')
    })
  })
})
