import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { Wallet } from 'ethers'

import { setupDeploy } from 'scripts/utils'

import { beforeEachWithFixture, timeTravel } from 'utils'

import {
  TimeOwnedUpgradeabilityProxyFactory,
  TimeOwnedUpgradeabilityProxy,
} from 'contracts'

use(solidity)

describe('TimeOwnedUpgradeabilityProxy', () => {
  const address = Wallet.createRandom().address
  let timeOwnedUpgradeabilityProxy: TimeOwnedUpgradeabilityProxy
  let getCurrentTimestamp: () => Promise<number>
  let advanceTime: (time: number) => Promise<void>

  async function getCurrentExpirationTimestamp () {
    return (await timeOwnedUpgradeabilityProxy.expiration()).toNumber()
  }

  beforeEachWithFixture(async ([owner], _provider) => {
    timeOwnedUpgradeabilityProxy = await setupDeploy(owner)(TimeOwnedUpgradeabilityProxyFactory)
    getCurrentTimestamp = async () => (await _provider.getBlock('latest')).timestamp
    advanceTime = (time: number) => timeTravel(_provider, time)
  })

  it('does not allow upgrade after certain time passes', async () => {
    await advanceTime(60 * 60 * 24 * 124 + 10)
    await expect(timeOwnedUpgradeabilityProxy.upgradeTo(address)).to.be.revertedWith('after expiration date')
  })

  it('allows upgrade before certain time passes', async () => {
    await timeOwnedUpgradeabilityProxy.upgradeTo(address)
    expect(await timeOwnedUpgradeabilityProxy.implementation()).to.equal(address)
  })

  it('allows upgrade before some, but not enough time passes', async () => {
    await advanceTime(60 * 60 * 24 * 124 - 10)
    await timeOwnedUpgradeabilityProxy.upgradeTo(address)
    expect(await timeOwnedUpgradeabilityProxy.implementation()).to.equal(address)
  })

  it('allows set before certain time passes', async () => {
    await advanceTime(60 * 60 * 24 * 124 - 10)
    const currentExpiration = await getCurrentExpirationTimestamp()
    await timeOwnedUpgradeabilityProxy.setExpiration(currentExpiration + 30)
    await advanceTime(20)
    await timeOwnedUpgradeabilityProxy.upgradeTo(address)
    expect(await timeOwnedUpgradeabilityProxy.implementation()).to.equal(address)
  })

  it('does not allow to upgrade if extended time already passes', async () => {
    await advanceTime(60 * 60 * 24 * 124 - 10)
    const currentExpiration = await getCurrentExpirationTimestamp()
    await timeOwnedUpgradeabilityProxy.setExpiration(currentExpiration + 20)
    await advanceTime(40)
    await expect(timeOwnedUpgradeabilityProxy.upgradeTo(address)).to.be.revertedWith('after expiration date')
  })

  it('does not allow to upgrade if expiration time was decreased and passed', async () => {
    const currentExpiration = await getCurrentExpirationTimestamp()
    await timeOwnedUpgradeabilityProxy.setExpiration(currentExpiration - 20)
    await advanceTime(60 * 60 * 24 * 124 - 10)
    await expect(timeOwnedUpgradeabilityProxy.upgradeTo(address)).to.be.revertedWith('after expiration date')
  })

  it('does not allow to set expiration time to the past', async function () {
    const currentTimestamp = await getCurrentTimestamp()
    await expect(timeOwnedUpgradeabilityProxy.setExpiration(currentTimestamp - 20)).to.be.revertedWith('new expiration time must be in the future')
  })

  it('does not allow set after certain time passes', async function () {
    const currentExpiration = await getCurrentExpirationTimestamp()
    await advanceTime(60 * 60 * 24 * 124 + 10)
    await expect(timeOwnedUpgradeabilityProxy.setExpiration(currentExpiration + 20)).to.be.revertedWith('after expiration time')
  })
})
