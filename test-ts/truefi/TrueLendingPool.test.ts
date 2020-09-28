import { expect } from 'chai'
import { Contract, Wallet } from 'ethers'
import { AddressZero, MaxUint256 } from 'ethers/constants'

import { beforeEachWithFixture } from '../utils/beforeEachWithFixture'

import { TrueLendingPoolFactory } from '../../build/types/TrueLendingPoolFactory'
import { TrueLendingPool } from '../../build/types/TrueLendingPool'
import { MockTrueCurrency } from '../../build/types/MockTrueCurrency'
import { MockTrueCurrencyFactory } from '../../build/types/MockTrueCurrencyFactory'
import ITrueFiPoolJson from '../../build/ITrueFiPool.json'
import { deployMockContract } from 'ethereum-waffle'
import { BigNumberish, parseEther } from 'ethers/utils'

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

    it('default params', async () => {
      expect(await lendingPool.minLoanSize()).to.equal(parseEther('1000000'))
      expect(await lendingPool.maxLoanSize()).to.equal(parseEther('10000000'))
      expect(await lendingPool.minApy()).to.equal('1000')
      expect(await lendingPool.minLoanApprovalFactor()).to.equal('7000')
      expect(await lendingPool.minLoanApprovalVoteRatio()).to.equal('7000')
      expect(await lendingPool.burnFactor()).to.equal('8000')
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

  describe('Parameters set up', () => {
    async function shouldChangeParameters (
      methodName: string,
      values: BigNumberish[],
      getterNames: string[],
      eventName: keyof TrueLendingPool['filters'],
    ) {
      if (typeof methodName !== 'string') {
        return
      }
      describe(methodName, () => {
        it(`changes ${getterNames}`, async () => {
          await lendingPool.functions[methodName](...values)
          for (let i = 0; i < getterNames.length; i++) {
            expect(await lendingPool.functions[getterNames[i]]()).to.equal(values[i])
          }
        })

        it(`emits ${eventName}`, async () => {
          await expect(lendingPool.functions[methodName](...values)).to.emit(lendingPool, eventName).withArgs(...values)
        })

        it('must be called by owner', async () => {
          await expect(lendingPool.connect(otherWallet).functions[methodName](...values)).to.be.revertedWith('caller is not the owner')
        })
      })
    }

    shouldChangeParameters('setLoanBounds', [1000, 100000], ['minLoanSize', 'maxLoanSize'], 'LoanBoundsChanged')
    shouldChangeParameters('setMinApy', [1000], ['minApy'], 'MinApyChanged')
    shouldChangeParameters('setLoanApprovalConditions', [1000, 2000], ['minLoanApprovalFactor', 'minLoanApprovalVoteRatio'], 'LoanApprovalConditionsChanged')
    shouldChangeParameters('setBurnFactor', [1000], ['burnFactor'], 'BurnFactorChanged')

    describe('setLoanBounds', () => {
      it('cannot set minLoanSize to be bigger than maxLoanSize', async () => {
        await expect(lendingPool.setLoanBounds(2, 1)).to.be.revertedWith('TrueLendingPool: Maximal loan size is smaller than minimal')
      })

      it('can set minLoanSize to same value as maxLoanSize', async () => {
        await expect(lendingPool.setLoanBounds(2, 2)).to.be.not.reverted
      })
    })

    describe('setLoanApprovalConditions', () => {
      it('cannot set it to be over 100%', async () => {
        await expect(lendingPool.setLoanApprovalConditions(10001, 1)).to.be.revertedWith('TrueLendingPool: MinLoanApprovalFactor exceeds 100%')
        await expect(lendingPool.setLoanApprovalConditions(1, 10001)).to.be.revertedWith('TrueLendingPool: MinLoanApprovalVoteRatio exceeds 100%')
      })
    })
  })

  describe('Creating/Removing application', () => {
    beforeEach(async () => {
      await lendingPool.whitelistForLoan(owner.address, true)
    })

    it('creates loan application', async () => {
      await lendingPool.createLoanApplication(otherWallet.address, parseEther('2000000'), 1200, 300)
      const application = await lendingPool.applications('0xdf606ca5ed7b19de')
      expect(application.creationBlock).to.equal(7)
      expect(application.timestamp).to.be.gt(0)
      expect(application.creator).to.equal(owner.address)
      expect(application.receiver).to.equal(otherWallet.address)
      expect(application.amount).to.equal(parseEther('2000000'))
      expect(application.apy).to.equal(1200)
      expect(application.duration).to.equal(300)
    })

    it('emits event on creation', async () => {
      await expect(lendingPool.createLoanApplication(otherWallet.address, parseEther('1000000'), 1300, 400))
        .to.emit(lendingPool, 'NewApplication').withArgs('0xa31403571b527adb', owner.address, otherWallet.address, parseEther('1000000'), 1300, 400)
    })

    it('should be whitelisted to create loan application', async () => {
      await expect(lendingPool.connect(otherWallet).createLoanApplication(otherWallet.address, parseEther('2000000'), 1200, 300))
        .to.be.revertedWith('TrueLendingPool: sender not whitelisted')
    })

    it('checks loan amount to be within boundaries', async () => {
      await expect(lendingPool.createLoanApplication(otherWallet.address, parseEther('999999'), 1200, 300))
        .to.be.revertedWith('TrueLendingPool: Loan size is out of bounds')
      await expect(lendingPool.createLoanApplication(otherWallet.address, parseEther('10000001'), 1200, 300))
        .to.be.revertedWith('TrueLendingPool: Loan size is out of bounds')
    })

    it('checks APY to be not below minimum', async () => {
      await expect(lendingPool.createLoanApplication(otherWallet.address, parseEther('1000000'), 900, 300))
        .to.be.revertedWith('TrueLendingPool: APY is below minimum')
    })

    it('application can be removed by creator', async () => {
      await lendingPool.createLoanApplication(otherWallet.address, parseEther('2000000'), 1200, 300)
      await lendingPool.removeLoanApplication('0xdf606ca5ed7b19de')
      const application = await lendingPool.applications('0xdf606ca5ed7b19de')
      expect(application.creationBlock).to.equal(0)
      expect(application.creator).to.equal(AddressZero)
      expect(application.receiver).to.equal(AddressZero)
      expect(application.amount).to.equal(0)
      expect(application.apy).to.equal(0)
      expect(application.duration).to.equal(0)
    })

    it('throws when removing not existing application', async () => {
      await expect(lendingPool.removeLoanApplication('0xdf606ca5ed7b19de')).to.be.revertedWith('TrueLendingPool: application doesn\'t exist')
    })

    it('cannot remove application created by someone else', async () => {
      await lendingPool.whitelistForLoan(otherWallet.address, true)
      await lendingPool.connect(otherWallet).createLoanApplication(otherWallet.address, parseEther('2000000'), 1200, 300)
      await expect(lendingPool.removeLoanApplication('0xe84da7cc33050c00')).to.be.revertedWith('TrueLendingPool: not application\'s creator')
    })

    it('emits event on remove', async () => {
      await lendingPool.createLoanApplication(otherWallet.address, parseEther('1000000'), 1300, 400)
      await expect(lendingPool.removeLoanApplication('0xa31403571b527adb')).to.emit(lendingPool, 'ApplicationRemoved')
    })
  })
})
