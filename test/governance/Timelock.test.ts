import { expect } from 'chai'
import { beforeEachWithFixture, timeTravel } from 'utils'
import { utils, Wallet } from 'ethers'
import { deployContract } from 'scripts/utils/deployContract'
import { OwnedUpgradeabilityProxyFactory, Timelock, TimelockFactory } from 'contracts'
import { AddressZero } from '@ethersproject/constants'

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
    await timelock.executeTransaction(timelock.address, 0, signature, data, block.timestamp + 200100)
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

  describe('setDelay', async () => {
    it('can only be called by itself', async () => {
      await expect(timelock.setDelay(10)).to.be.revertedWith('Timelock::setDelay: Call must come from Timelock.')
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
})
