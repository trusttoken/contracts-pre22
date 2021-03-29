import { expect, use } from 'chai'
import { beforeEachWithFixture, timeTravel } from 'utils'
import { utils, Wallet } from 'ethers'
import { deployContract } from 'scripts/utils/deployContract'
import { OwnedUpgradeabilityProxyFactory, Timelock, TimelockFactory } from 'contracts'
import { AddressZero } from '@ethersproject/constants'
import { solidity } from 'ethereum-waffle'

use(solidity)

describe('Timelock', () => {
  let admin: Wallet, notAdmin: Wallet
  let timelock: Timelock

  beforeEachWithFixture(async (wallets) => {
    ([admin, notAdmin] = wallets)
    timelock = await deployContract(admin, TimelockFactory)
    await timelock.initialize(admin.address, 200000)
  })

  const queueAndExecute = async <Sig extends keyof Timelock['functions']>(signature: Sig, args: Parameters<Timelock['functions'][Sig]>) => {
    const abi = [`function ${signature}`]
    const iface = new utils.Interface(abi)
    const data = `0x${iface.encodeFunctionData(signature, args).slice(10)}`
    const block = await admin.provider.getBlock('latest')
    await timelock.queueTransaction(timelock.address, 0, signature, data, block.timestamp + 200100)
    await timeTravel(admin.provider as any, 200200)
    return timelock.executeTransaction(timelock.address, 0, signature, data, block.timestamp + 200100)
  }

  describe('emergency pause', () => {
    it('upgrades proxy implementation to address(0)', async () => {
      const proxy = await deployContract(admin, OwnedUpgradeabilityProxyFactory)
      await proxy.upgradeTo(Wallet.createRandom().address)
      await proxy.transferProxyOwnership(timelock.address)
      const block = await admin.provider.getBlock('latest')
      await timelock.queueTransaction(proxy.address, 0, 'claimProxyOwnership()', '0x', block.timestamp + 200000)
      await timeTravel(admin.provider as any, 200100)
      await timelock.executeTransaction(proxy.address, 0, 'claimProxyOwnership()', '0x', block.timestamp + 200000)
      expect(await proxy.implementation()).to.not.equal(AddressZero)
      await timelock.emergencyPause(proxy.address)
      expect(await proxy.implementation()).to.equal(AddressZero)
    })

    it('is onlyAdmin', async () => {
      const proxy = await deployContract(admin, OwnedUpgradeabilityProxyFactory)
      await expect(timelock.connect(notAdmin).emergencyPause(proxy.address)).to.be.revertedWith('Timelock::emergencyPause: Call must come from admin.')
    })
  })

  describe('setPauser', async () => {
    describe('if admin_initialized is not set', async () => {
      it('sets pauser once', async () => {
        await expect(timelock.connect(admin).setPauser(notAdmin.address))
          .to.emit(timelock, 'NewPauser')
          .withArgs(notAdmin.address)
        expect(await timelock.pauser()).to.be.eq(notAdmin.address)
      })

      it('sets pauser repeatedly', async () => {
        await timelock.connect(admin).setPauser(notAdmin.address)
        expect(await timelock.pauser()).to.be.eq(notAdmin.address)

        await timelock.connect(admin).setPauser(admin.address)
        expect(await timelock.pauser()).to.be.eq(admin.address)

        await timelock.connect(admin).setPauser(notAdmin.address)
        expect(await timelock.pauser()).to.be.eq(notAdmin.address)
      })

      it('reverts if caller is not admin', async () => {
        await expect(timelock.connect(notAdmin).setPauser(admin.address))
          .to.be.revertedWith('Timelock::setPauser: First call must come from admin.')
      })
    })

    describe('if admin_initialized is set', async () => {
      it('sets pauser if caller is timelock', async () => {
        await timelock.connect(admin).setPendingAdmin(admin.address)
        expect(await timelock.admin_initialized())
          .to.be.eq(true)
        await expect(queueAndExecute('setPauser(address)', [notAdmin.address]))
          .to.emit(timelock, 'NewPauser')
          .withArgs(notAdmin.address)
      })

      it('reverts if caller is not timelock', async () => {
        await timelock.connect(admin).setPendingAdmin(admin.address)
        await expect(timelock.connect(admin).setPauser(notAdmin.address))
          .to.be.revertedWith('Timelock::setPauser: Call must come from Timelock.')
      })
    })
  })

  describe('setDelay', async () => {
    it('can only be called by itself', async () => {
      await expect(timelock.setDelay(10))
        .to.be.revertedWith('Timelock::setDelay: Call must come from Timelock.')
    })

    it('changes delay', async () => {
      await queueAndExecute('setDelay(uint256)', [10 * 60 * 60 * 24])
      expect(await timelock.delay()).to.equal(10 * 60 * 60 * 24)
    })

    it('reverts if delay too small', async () => {
      const tooSmallDelay = 60 * 60 * 24 // 1 day
      await expect(queueAndExecute('setDelay(uint256)', [tooSmallDelay]))
        .to.be.revertedWith('Timelock::executeTransaction: Transaction execution reverted.')
    })

    it('reverts if delay too big', async () => {
      const tooBigDelay = 31 * 60 * 60 * 24 // 31 day
      await expect(queueAndExecute('setDelay(uint256)', [tooBigDelay]))
        .to.be.revertedWith('Timelock::executeTransaction: Transaction execution reverted.')
    })
  })

  describe('acceptAdmin', async () => {
    it('accepts the pending admin as the admin address', async () => {
      await timelock.connect(admin).setPendingAdmin(notAdmin.address)
      await expect(timelock.connect(notAdmin).acceptAdmin())
        .to.emit(timelock, 'NewAdmin')
        .withArgs(notAdmin.address)
      expect(await timelock.admin())
        .to.be.eq(notAdmin.address)
      expect(await timelock.pendingAdmin())
        .to.be.eq('0x0000000000000000000000000000000000000000')
    })

    it('reverts if the caller is not pending admin', async () => {
      await expect(timelock.connect(admin).acceptAdmin())
        .to.be.revertedWith('Timelock::acceptAdmin: Call must come from pendingAdmin')
    })
  })

  describe('setPendingAdmin', async () => {
    it('sets pending admin', async () => {
      expect(await timelock.admin_initialized())
        .to.be.eq(false)
      await expect(timelock.connect(admin).setPendingAdmin(notAdmin.address))
        .to.emit(timelock, 'NewPendingAdmin')
        .withArgs(notAdmin.address)
      expect(await timelock.admin_initialized())
        .to.be.eq(true)
      expect(await timelock.pendingAdmin())
        .to.be.eq(notAdmin.address)
    })

    it('reverts if first call come not from admin', async () => {
      await expect(timelock.connect(notAdmin).setPendingAdmin(notAdmin.address))
        .to.be.revertedWith('Timelock::setPendingAdmin: First call must come from admin.')
    })

    it('sets pending admin if was already set before', async () => {
      await timelock.connect(admin).setPendingAdmin(admin.address)
      expect(await timelock.admin_initialized())
        .to.be.eq(true)
      await expect(queueAndExecute('setPendingAdmin(address)', [notAdmin.address]))
        .to.emit(timelock, 'NewPendingAdmin')
        .withArgs(notAdmin.address)
      expect(await timelock.admin_initialized())
        .to.be.eq(true)
      expect(await timelock.pendingAdmin())
        .to.be.eq(notAdmin.address)
    })

    it('reverts if admin initialized and call does not come from Timelock', async () => {
      await timelock.connect(admin).setPendingAdmin(notAdmin.address)
      expect(await timelock.admin_initialized())
        .to.be.eq(true)
      await expect(timelock.connect(admin).setPendingAdmin(notAdmin.address))
        .to.be.revertedWith('Timelock::setPendingAdmin: Call must come from Timelock.')
    })
  })

  describe('Transaction operations', async () => {
    let target: string
    let value: string
    let signature: string
    let data: string
    let block

    beforeEach(async () => {
      target = timelock.address
      value = '0'
      signature = 'setPendingAdmin(address)'
      data = (new utils.AbiCoder()).encode(['address'], [notAdmin.address])
      block = await admin.provider.getBlock('latest')
    })

    describe('queueTransaction', async () => {
      describe('reverts if', async () => {
        it('caller is not admin', async () => {
          await expect(timelock.connect(notAdmin).queueTransaction(target, value, signature, data, 0))
            .to.be.revertedWith('Timelock::queueTransaction: Call must come from admin.')
        })

        it('delay is not satisfied', async () => {
          await expect(timelock.connect(admin).queueTransaction(target, value, signature, data, block.timestamp + 199_990))
            .to.be.revertedWith('Timelock::queueTransaction: Estimated execution block must satisfy delay.')
        })
      })

      it('queues transaction successfully', async () => {
        const eta = block.timestamp + 200_010
        const txHash = utils.keccak256((new utils.AbiCoder()).encode(
          ['address', 'uint', 'string', 'bytes', 'uint'],
          [target, value, signature, data, eta]
        ))
        expect(await timelock.queuedTransactions(txHash))
          .to.be.false
        await expect(timelock.connect(admin).queueTransaction(target, value, signature, data, eta))
          .to.emit(timelock, 'QueueTransaction')
          .withArgs(txHash, target, value, signature, data, eta)
        expect(await timelock.queuedTransactions(txHash))
          .to.be.true
      })
    })

    describe('cancelTransaction', async () => {
      it('reverts if caller is not admin', async () => {
        await expect(timelock.connect(notAdmin).cancelTransaction(target, value, signature, data, 0))
          .to.be.revertedWith('Timelock::cancelTransaction: Call must come from admin.')
      })

      it('cancels transaction successfully', async () => {
        const eta = block.timestamp + 200_010
        const txHash = utils.keccak256((new utils.AbiCoder()).encode(
          ['address', 'uint', 'string', 'bytes', 'uint'],
          [target, value, signature, data, eta]
        ))
        await timelock.connect(admin).queueTransaction(target, value, signature, data, eta)
        expect(await timelock.queuedTransactions(txHash))
          .to.be.true
        await expect(timelock.connect(admin).cancelTransaction(target, value, signature, data, eta))
          .to.emit(timelock, 'CancelTransaction')
          .withArgs(txHash, target, value, signature, data, eta)
        expect(await timelock.queuedTransactions(txHash))
          .to.be.false
      })
    })
  })
})
