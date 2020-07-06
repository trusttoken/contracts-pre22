import assertRevert from './helpers/assertRevert.js'
import timeMachine from 'ganache-time-traveler'
const TimeOwnedUpgradeabilityProxy = artifacts.require('TimeOwnedUpgradeabilityProxy')

contract('TimeOwnedUpgradeabilityProxy', function () {
  let address

  const getCurrentExpirationTimestamp = async () => parseInt((await this.timeOwnedUpgradeabilityProxy.expiration()).toString())
  const getCurrentTimestamp = async () => (await web3.eth.getBlock('latest')).timestamp

  beforeEach(async () => {
    address = web3.eth.accounts.create().address
    this.timeOwnedUpgradeabilityProxy = await TimeOwnedUpgradeabilityProxy.new()
  })

  it('does not allow upgrade after certain time passes', async () => {
    await timeMachine.advanceTime(60 * 60 * 24 * 124 + 10)
    await assertRevert(this.timeOwnedUpgradeabilityProxy.upgradeTo(address))
  })

  it('allows upgrade before certain time passes', async () => {
    await this.timeOwnedUpgradeabilityProxy.upgradeTo(address)
    assert(address === await this.timeOwnedUpgradeabilityProxy.implementation())
  })

  it('allows upgrade before some, but not enough time passes', async () => {
    await timeMachine.advanceTime(60 * 60 * 24 * 124 - 10)
    await this.timeOwnedUpgradeabilityProxy.upgradeTo(address)
    assert(address === await this.timeOwnedUpgradeabilityProxy.implementation())
  })

  it('allows set before certain time passes', async () => {
    await timeMachine.advanceTime(60 * 60 * 24 * 124 - 10)
    const currentExpiration = await getCurrentExpirationTimestamp()
    await this.timeOwnedUpgradeabilityProxy.setExpiration(currentExpiration + 30)
    await timeMachine.advanceTime(20)
    await this.timeOwnedUpgradeabilityProxy.upgradeTo(address)
    assert(address === await this.timeOwnedUpgradeabilityProxy.implementation())
  })

  it('does not allow to upgrade if extended time already passes', async () => {
    await timeMachine.advanceTime(60 * 60 * 24 * 124 - 10)
    const currentExpiration = await getCurrentExpirationTimestamp()
    await this.timeOwnedUpgradeabilityProxy.setExpiration(currentExpiration + 20)
    await timeMachine.advanceTime(40)
    await assertRevert(this.timeOwnedUpgradeabilityProxy.upgradeTo(address))
  })

  it('does not allow to upgrade if expiration time was decreased and passed', async () => {
    const currentExpiration = await getCurrentExpirationTimestamp()
    await this.timeOwnedUpgradeabilityProxy.setExpiration(currentExpiration - 20)
    await timeMachine.advanceTime(60 * 60 * 24 * 124 - 10)
    await assertRevert(this.timeOwnedUpgradeabilityProxy.upgradeTo(address))
  })

  it('does not allow to set expiration time to the past', async () => {
    const currentTimestamp = await getCurrentTimestamp()
    await assertRevert(this.timeOwnedUpgradeabilityProxy.setExpiration(currentTimestamp - 20))
  })

  it('does not allow set after certain time passes', async () => {
    const currentExpiration = await getCurrentExpirationTimestamp()
    await timeMachine.advanceTime(60 * 60 * 24 * 124 + 10)
    await assertRevert(this.timeOwnedUpgradeabilityProxy.setExpiration(currentExpiration + 20))
  })
})
