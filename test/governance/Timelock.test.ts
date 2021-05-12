import { expect, use } from 'chai'
import { beforeEachWithFixture, timeTravel } from 'utils'
import { utils, Wallet } from 'ethers'
import { deployContract } from 'scripts/utils/deployContract'
import {
  ImplementationReference__factory,
  MockPauseableContract,
  MockPauseableContract__factory,
  OwnedProxyWithReference__factory,
  OwnedUpgradeabilityProxy__factory,
  Timelock,
  Timelock__factory,
} from 'contracts'
import { AddressZero } from '@ethersproject/constants'
import { formatBytes32String } from '@ethersproject/strings'
import { solidity } from 'ethereum-waffle'

use(solidity)

describe('Timelock', () => {
  let admin: Wallet, notAdmin: Wallet, pauser: Wallet
  let timelock: Timelock

  beforeEachWithFixture(async (wallets) => {
    ([admin, notAdmin, pauser] = wallets)
    timelock = await deployContract(admin, Timelock__factory)
    await timelock.initialize(admin.address, 200000)
  })

  const queueAndExecute = async <Sig extends keyof Timelock['functions']>(signature: Sig, args: Parameters<Timelock['functions'][Sig]>) => {
    const abi = [`function ${signature}`]
    const iface = new utils.Interface(abi)
    const data = `0x${iface.encodeFunctionData(signature, args).slice(10)}`
    const block = await admin.provider.getBlock('latest')
    await timelock.queueTransaction(timelock.address, 0, signature, data, block.timestamp + 200100)
    await timeTravel(admin.provider as any, 200200)
    return timelock.executeTransaction(timelock.address, 0, signature, data, block.timestamp + 200100, { gasLimit: 6000000 })
  }

  describe('emergency pause regular proxy', () => {
    beforeEach(async () => {
      await timelock.setPauser(pauser.address)
    })

    async function createProxy () {
      const proxy = await deployContract(admin, OwnedUpgradeabilityProxy__factory)
      await proxy.upgradeTo(Wallet.createRandom().address)
      await proxy.transferProxyOwnership(timelock.address)
      const block = await admin.provider.getBlock('latest')
      await timelock.queueTransaction(proxy.address, 0, 'claimProxyOwnership()', '0x', block.timestamp + 200100)
      await timeTravel(admin.provider as any, 200200)
      await timelock.executeTransaction(proxy.address, 0, 'claimProxyOwnership()', '0x', block.timestamp + 200100)
      return proxy
    }

    it('upgrades proxy implementation to address(0)', async () => {
      const proxy = await createProxy()
      expect(await proxy.implementation()).to.not.equal(AddressZero)
      await timelock.connect(pauser).emergencyPauseProxy(proxy.address)
      expect(await proxy.implementation()).to.equal(AddressZero)
    })

    it('can only be called by pauser', async () => {
      const proxy = await deployContract(admin, OwnedUpgradeabilityProxy__factory)
      await expect(timelock.connect(notAdmin).emergencyPauseProxy(proxy.address)).to.be.revertedWith('Timelock::emergencyPauseProxy: Call must come from Timelock or pauser.')
      await expect(timelock.connect(admin).emergencyPauseProxy(proxy.address)).to.be.revertedWith('Timelock::emergencyPauseProxy: Call must come from Timelock or pauser.')
    })

    it('can be called by queueing transaction to Timelock', async () => {
      const proxy = await createProxy()
      await queueAndExecute('emergencyPauseProxy(address)', [proxy.address])
      expect(await proxy.implementation()).to.equal(AddressZero)
    })

    it('cannot pause timelock', async () => {
      await expect(timelock.connect(pauser).emergencyPauseProxy(timelock.address)).to.be.revertedWith('Timelock::emergencyPauseProxy: Cannot pause Timelock.')
    })

    it('cannot pause admin', async () => {
      await expect(timelock.connect(pauser).emergencyPauseProxy(admin.address)).to.be.revertedWith('Timelock:emergencyPauseProxy: Cannot pause admin.')
    })
  })

  describe('emergency pause proxy with reference', () => {
    beforeEach(async () => {
      await timelock.setPauser(pauser.address)
    })

    async function createProxy () {
      const reference = await deployContract(admin, ImplementationReference__factory, [Wallet.createRandom().address])
      const proxy = await deployContract(admin, OwnedProxyWithReference__factory, [timelock.address, reference.address])

      await reference.transferOwnership(timelock.address)
      const block = await admin.provider.getBlock('latest')
      await timelock.queueTransaction(reference.address, 0, 'claimOwnership()', '0x', block.timestamp + 200100)
      await timeTravel(admin.provider as any, 200200)
      await timelock.executeTransaction(reference.address, 0, 'claimOwnership()', '0x', block.timestamp + 200100)
      return [proxy, reference]
    }

    it('upgrades proxy implementation to address(0)', async () => {
      const [proxy, reference] = await createProxy()
      expect(await reference.implementation()).to.not.equal(AddressZero)
      expect(await proxy.implementation()).to.not.equal(AddressZero)
      await timelock.connect(pauser).emergencyPauseReference(reference.address)
      expect(await reference.implementation()).to.equal(AddressZero)
      expect(await proxy.implementation()).to.equal(AddressZero)
    })

    it('can only be called by pauser', async () => {
      const reference = await deployContract(admin, ImplementationReference__factory, [Wallet.createRandom().address])
      await expect(timelock.connect(notAdmin).emergencyPauseReference(reference.address)).to.be.revertedWith('Timelock::emergencyPauseProxy: Call must come from Timelock or pauser.')
      await expect(timelock.connect(admin).emergencyPauseReference(reference.address)).to.be.revertedWith('Timelock::emergencyPauseProxy: Call must come from Timelock or pauser.')
    })

    it('can be called by queueing transaction to Timelock', async () => {
      const [proxy, reference] = await createProxy()
      await queueAndExecute('emergencyPauseReference(address)', [reference.address])
      expect(await reference.implementation()).to.equal(AddressZero)
      expect(await proxy.implementation()).to.equal(AddressZero)
    })
  })

  describe('setPauseStatus', () => {
    let pauseable: MockPauseableContract

    beforeEach(async () => {
      pauseable = await deployContract(admin, MockPauseableContract__factory)
      await timelock.setPauser(pauser.address)
    })

    it('pause and unpause pausable contract', async () => {
      await timelock.connect(pauser).setPauseStatus(pauseable.address, true)
      expect(await pauseable.pauseStatus()).to.be.true
      await timelock.connect(pauser).setPauseStatus(pauseable.address, false)
      expect(await pauseable.pauseStatus()).to.be.false
    })

    it('can only be called by pauser', async () => {
      await expect(timelock.connect(admin).setPauseStatus(pauseable.address, true))
        .to.be.revertedWith('Timelock::setPauseStatus: Call must come from Timelock or pauser.')
    })

    it('can be called by queueing transaction to Timelock', async () => {
      await queueAndExecute('setPauseStatus(address,bool)', [pauseable.address, true])
      expect(await pauseable.pauseStatus()).to.be.true
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

    const encodeAndHash = (_target: string, _value: string, _signature: string, _data: string, _eta: number) => {
      return utils.keccak256((new utils.AbiCoder()).encode(
        ['address', 'uint', 'string', 'bytes', 'uint'],
        [_target, _value, _signature, _data, _eta],
      ))
    }

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
        const txHash = encodeAndHash(target, value, signature, data, eta)
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
        const txHash = encodeAndHash(target, value, signature, data, eta)
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

    describe('executeTransaction', async () => {
      describe('reverts if', async () => {
        it('caller is not admin', async () => {
          await expect(timelock.connect(notAdmin).executeTransaction(target, value, signature, data, 0))
            .to.be.revertedWith('Timelock::executeTransaction: Call must come from admin.')
        })

        it('transaction hasn\'t been queued', async () => {
          await expect(timelock.connect(admin).executeTransaction(target, value, signature, data, 0))
            .to.be.revertedWith('Timelock::executeTransaction: Transaction hasn\'t been queued.')
        })

        it('transaction is no longer in queue', async () => {
          const eta = block.timestamp + 200_100
          await timelock.connect(admin).queueTransaction(target, value, signature, data, eta)
          await timeTravel(admin.provider as any, 200_100)
          await timelock.connect(admin).setPendingAdmin(AddressZero)
          await timelock.connect(admin).executeTransaction(target, value, signature, data, eta)
          await expect(timelock.connect(admin).executeTransaction(target, value, signature, data, eta))
            .to.be.revertedWith('Timelock::executeTransaction: Transaction hasn\'t been queued.')
        })

        it('transaction has stayed in queue less than its eta', async () => {
          const eta = block.timestamp + 200_100
          await timelock.connect(admin).queueTransaction(target, value, signature, data, eta)

          // 200_100 - 1 should have sufficed, but
          // block.timestamp may increase on its own asynchronously
          await timeTravel(admin.provider as any, 200_100 - 100)
          await expect(timelock.connect(admin).executeTransaction(target, value, signature, data, eta))
            .to.be.revertedWith('Timelock::executeTransaction: Transaction hasn\'t surpassed time lock.')
        })

        it('transaction has stayed in queue longer than the grace period', async () => {
          const eta = block.timestamp + 200_100
          await timelock.connect(admin).queueTransaction(target, value, signature, data, eta)
          await timeTravel(admin.provider as any, 200_100 + 14 * 24 * 3600 + 1) // lockTime + 14 days + a bit longer
          await expect(timelock.connect(admin).executeTransaction(target, value, signature, data, eta))
            .to.be.revertedWith('Timelock::executeTransaction: Transaction is stale.')
        })

        it('signature is not empty and transaction did not succeed', async () => {
          const eta = block.timestamp + 200_100
          await timelock.connect(admin).queueTransaction(target, value, signature, data, eta)
          await timeTravel(admin.provider as any, 200_100)

          // reverted because first setPendingAdmin() call
          // should come from admin, not from timelock itself;
          // though would revert the same way in case of another cause
          await expect(timelock.connect(admin).executeTransaction(target, value, signature, data, eta, { gasLimit: 6000000 }))
            .to.be.revertedWith('Timelock::executeTransaction: Transaction execution reverted.')
        })

        it('signature is empty and transaction did not succeed', async () => {
          // prepare callData equivalently to solidity code below
          // bytes callData = abi.encodePacked(bytes4(keccak256(bytes(signature))), data);
          const encodedSignature = formatBytes32String(signature)
          const hashedSignature = utils.keccak256(encodedSignature.slice(0, encodedSignature.length - 16))
          const callData = `0x${hashedSignature.slice(2, 10)}${data.slice(2)}`

          signature = ''
          const eta = block.timestamp + 200_100
          await timelock.connect(admin).queueTransaction(target, value, signature, callData, eta)
          await timeTravel(admin.provider as any, 200_100)

          // reverted because first setPendingAdmin() call
          // should come from admin, not from timelock itself;
          // though would revert the same way in case of another cause
          await expect(timelock.connect(admin).executeTransaction(target, value, signature, callData, eta, { gasLimit: 6000000 }))
            .to.be.revertedWith('Timelock::executeTransaction: Transaction execution reverted.')
        })
      })

      describe('emits event if', async () => {
        it('signature is not empty', async () => {
          const eta = block.timestamp + 200_100
          const txHash = encodeAndHash(target, value, signature, data, eta)
          await timelock.connect(admin).queueTransaction(target, value, signature, data, eta)
          await timeTravel(admin.provider as any, 200_100)
          await timelock.connect(admin).setPendingAdmin(AddressZero)
          await expect(timelock.connect(admin).executeTransaction(target, value, signature, data, eta))
            .to.emit(timelock, 'ExecuteTransaction')
            .withArgs(txHash, target, value, signature, data, eta)
        })

        it('signature is empty', async () => {
          // prepare callData equivalently to solidity code below
          // bytes callData = abi.encodePacked(bytes4(keccak256(bytes(signature))), data);
          const encodedSignature = formatBytes32String(signature)
          const hashedSignature = utils.keccak256(encodedSignature.slice(0, encodedSignature.length - 16))
          const callData = `0x${hashedSignature.slice(2, 10)}${data.slice(2)}`

          signature = ''
          const eta = block.timestamp + 200_100
          await timelock.connect(admin).queueTransaction(target, value, signature, callData, eta)
          await timeTravel(admin.provider as any, 200_100)
          await timelock.connect(admin).setPendingAdmin(AddressZero)
          const txHash = encodeAndHash(target, value, signature, callData, eta)
          await expect(timelock.connect(admin).executeTransaction(target, value, signature, callData, eta))
            .to.emit(timelock, 'ExecuteTransaction')
            .withArgs(txHash, target, value, signature, callData, eta)
        })
      })
    })
  })
})
