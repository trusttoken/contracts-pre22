import assertRevert from '../../../test/helpers/assertRevert.js'
import timeMachine from 'ganache-time-traveler'
import { solidity } from 'ethereum-waffle'
import { Wallet } from 'ethers'
import { beforeEachWithFixture } from '../../utils/beforeEachWithFixture'
import { setupDeploy } from '../../../scripts/utils'
import { expect } from 'chai'

chai.use(solidity)

describe('TimeOwnedUpgradeabilityProxy', () => {
  const address = Wallet.createRandom().address
  let timeOwnedUpgradeabilityProxy
  let getCurrentTimestamp: () => Promise<number>

  const getCurrentExpirationTimestamp = async (timeOwnedUpgradeabilityProxy) => parseInt((await timeOwnedUpgradeabilityProxy.expiration()).toString())

  beforeEachWithFixture(async (_provider, [owner]) => {
    const getCurrentTimestampFrom = (provider) => async () => (await provider.getBlock('latest')).timestamp
    timeOwnedUpgradeabilityProxy = await setupDeploy(owner)(TimeOwnedUpgradeabilityProxyFactory)
    getCurrentTimestamp = getCurrentTimestampFrom(_provider)
  })

  it('does not allow upgrade after certain time passes', async () => {
    await timeMachine.advanceTime(60 * 60 * 24 * 124 + 10)
    await assertRevert(timeOwnedUpgradeabilityProxy.upgradeTo(address))
  })

  it('allows upgrade before certain time passes', async () => {
    await timeOwnedUpgradeabilityProxy.upgradeTo(address)
    expect(await timeOwnedUpgradeabilityProxy.implementation()).to.equal(address)
  })

  it('allows upgrade before some, but not enough time passes', async () => {
    await timeMachine.advanceTime(60 * 60 * 24 * 124 - 10)
    await timeOwnedUpgradeabilityProxy.upgradeTo(address)
    expect(await timeOwnedUpgradeabilityProxy.implementation()).to.equal(address)
  })

  it('allows set before certain time passes', async () => {
    await timeMachine.advanceTime(60 * 60 * 24 * 124 - 10)
    const currentExpiration = await getCurrentExpirationTimestamp(timeOwnedUpgradeabilityProxy)
    await timeOwnedUpgradeabilityProxy.setExpiration(currentExpiration + 30)
    await timeMachine.advanceTime(20)
    await timeOwnedUpgradeabilityProxy.upgradeTo(address)
    expect(await timeOwnedUpgradeabilityProxy.implementation()).to.equal(address)
  })

  it('does not allow to upgrade if extended time already passes', async () => {
    await timeMachine.advanceTime(60 * 60 * 24 * 124 - 10)
    const currentExpiration = await getCurrentExpirationTimestamp(timeOwnedUpgradeabilityProxy)
    await timeOwnedUpgradeabilityProxy.setExpiration(currentExpiration + 20)
    await timeMachine.advanceTime(40)
    expect(timeOwnedUpgradeabilityProxy.upgradeTo(address)).to.be.revertedWith('dsfa')
  })

  it('does not allow to upgrade if expiration time was decreased and passed', async () => {
    const currentExpiration = await getCurrentExpirationTimestamp(timeOwnedUpgradeabilityProxy)
    await timeOwnedUpgradeabilityProxy.setExpiration(currentExpiration - 20)
    await timeMachine.advanceTime(60 * 60 * 24 * 124 - 10)
    expect(timeOwnedUpgradeabilityProxy.upgradeTo(address)).to.be.revertedWith('dsfa')
  })

  it('does not allow to set expiration time to the past', async function () {
    const currentTimestamp = await getCurrentTimestamp()
    expect(timeOwnedUpgradeabilityProxy.setExpiration(currentTimestamp - 20)).to.be.revertedWith('dsfa')
  })

  it('does not allow set after certain time passes', async function () {
    const currentExpiration = await getCurrentExpirationTimestamp(timeOwnedUpgradeabilityProxy)
    await timeMachine.advanceTime(60 * 60 * 24 * 124 + 10)
    expect(timeOwnedUpgradeabilityProxy.setExpiration(currentExpiration + 20)).to.be.revertedWith('dsfa')
  })
})
