import { expect } from 'chai'
import { beforeEachWithFixture, timeTravel } from 'utils'
import { Wallet } from 'ethers'
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

  describe('emergency pause', () => {
    it('upgrades proxy implementation to address(0)', async () => {
      const proxy = await deployContract(admin, OwnedUpgradeabilityProxyFactory)
      await proxy.upgradeTo(Wallet.createRandom().address)
      await proxy.transferProxyOwnership(timelock.address)
      const block = await admin.provider.getBlock('latest')
      await timelock.queueTransaction(proxy.address, 0, 'claimProxyOwnership()', '0x', block.timestamp + 200000)
      await timeTravel(admin.provider as any, 200000)
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
})
