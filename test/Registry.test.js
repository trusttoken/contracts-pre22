import assertRevert from './helpers/assertRevert'
import bytes32 from './helpers/bytes32'
import writeAttributeFor from './helpers/writeAttributeFor'
const RegistryMock = artifacts.require('RegistryMock')
const MockToken = artifacts.require('MockERC20Token')
const ForceEther = artifacts.require('ForceEther')

contract('Registry', function ([, owner, oneHundred, anotherAccount]) {
  beforeEach(async function () {
    this.registry = await RegistryMock.new({ from: owner })
    await this.registry.initialize({ from: owner })
  })

  describe('--Registry Tests--', function () {
    const prop1 = web3.utils.sha3('hasPassedKYC/AML')
    const prop2 = bytes32('isDepositAddress')
    const notes = bytes32('isBlacklisted')

    describe('ownership functions', function () {
      it('cannot be reinitialized', async function () {
        await assertRevert(this.registry.initialize({ from: owner }))
      })
      it('can transfer ownership', async function () {
        await this.registry.transferOwnership(anotherAccount, { from: owner })
        assert.equal(await this.registry.pendingOwner(), anotherAccount)
      })
      it('non owner cannot transfer ownership', async function () {
        await assertRevert(this.registry.transferOwnership(anotherAccount, { from: anotherAccount }))
      })
      it('can claim ownership', async function () {
        await this.registry.transferOwnership(anotherAccount, { from: owner })
        await this.registry.claimOwnership({ from: anotherAccount })
        assert.equal(await this.registry.owner(), anotherAccount)
      })
      it('only pending owner can claim ownership', async function () {
        await this.registry.transferOwnership(anotherAccount, { from: owner })
        await assertRevert(this.registry.claimOwnership({ from: oneHundred }))
      })
    })
    describe('read/write', function () {
      it('works for owner', async function () {
        const { receipt } = await this.registry.setAttribute(anotherAccount, prop1, 3, notes, { from: owner })
        const attr = await this.registry.getAttribute(anotherAccount, prop1)
        assert.equal(attr[0], 3)
        assert.equal(attr[1], notes)
        assert.equal(attr[2], owner)
        assert.equal(attr[3], (await web3.eth.getBlock(receipt.blockNumber)).timestamp)
        const hasAttr = await this.registry.hasAttribute(anotherAccount, prop1)
        assert.equal(hasAttr, true)
        const value = await this.registry.getAttributeValue(anotherAccount, prop1)
        assert.equal(Number(value), 3)
        const adminAddress = await this.registry.getAttributeAdminAddr(anotherAccount, prop1)
        assert.equal(adminAddress, owner)
        const timestamp = await this.registry.getAttributeTimestamp(anotherAccount, prop1)
        assert.equal(timestamp, (await web3.eth.getBlock(receipt.blockNumber)).timestamp)
      })

      it('sets only desired attribute', async function () {
        await this.registry.setAttribute(anotherAccount, prop1, 3, notes, { from: owner })
        const attr = await this.registry.getAttribute(anotherAccount, prop2)
        assert.equal(attr[0], 0)
        assert.equal(attr[1], '0x0000000000000000000000000000000000000000000000000000000000000000')
        assert.equal(attr[2], 0)
        const hasAttr = await this.registry.hasAttribute(anotherAccount, prop2)
        assert.equal(hasAttr, false)
      })

      it('emits an event', async function () {
        const { logs } = await this.registry.setAttribute(anotherAccount, prop1, 3, notes, { from: owner })

        assert.equal(logs.length, 1)
        assert.equal(logs[0].event, 'SetAttribute')
        assert.equal(logs[0].args.who, anotherAccount)
        assert.equal(logs[0].args.attribute, prop1)
        assert.equal(logs[0].args.value, 3)
        assert.equal(logs[0].args.notes, notes)
        assert.equal(logs[0].args.adminAddr, owner)
      })

      it('cannot be called by random non-owner', async function () {
        await assertRevert(this.registry.setAttribute(anotherAccount, prop1, 3, notes, { from: oneHundred }))
      })

      it('owner can let others write', async function () {
        const canWriteProp1 = writeAttributeFor(prop1)
        await this.registry.setAttribute(oneHundred, canWriteProp1, 3, notes, { from: owner })
        await this.registry.setAttribute(anotherAccount, prop1, 3, notes, { from: oneHundred })
      })

      it('owner can let others write attribute value', async function () {
        const canWriteProp1 = writeAttributeFor(prop1)
        await this.registry.setAttributeValue(oneHundred, canWriteProp1, 3, { from: owner })
        await this.registry.setAttributeValue(anotherAccount, prop1, 3, { from: oneHundred })
      })

      it('others can only write what they are allowed to', async function () {
        const canWriteProp1 = writeAttributeFor(prop1)
        await this.registry.setAttribute(oneHundred, canWriteProp1, 3, notes, { from: owner })
        await assertRevert(this.registry.setAttribute(anotherAccount, prop2, 3, notes, { from: oneHundred }))
        await assertRevert(this.registry.setAttributeValue(anotherAccount, prop2, 3, { from: oneHundred }))
      })
    })

    describe('no ether and no tokens', function () {
      beforeEach(async function () {
        this.token = await MockToken.new(this.registry.address, 100, { from: owner })
      })

      it('owner can transfer out token in the contract address ', async function () {
        await this.registry.reclaimToken(this.token.address, owner, { from: owner })
      })

      it('cannot transfer ether to contract address', async function () {
        await assertRevert(this.registry.sendTransaction({
          value: 33,
          from: owner,
          gas: 300000,
        }))
      })

      it('owner can transfer out ether in the contract address', async function () {
        const emptyAddress = '0x5fef93e79a73b28a9113a618aabf84f2956eb3ba'

        const forceEther = await ForceEther.new({ from: owner, value: '10000000000000000000' })
        await forceEther.destroyAndSend(this.registry.address, { from: owner })
        const registryInitialWithForcedEther = web3.utils.fromWei((await web3.eth.getBalance(this.registry.address)), 'ether')
        await this.registry.reclaimEther(emptyAddress, { from: owner })
        const registryFinalBalance = web3.utils.fromWei((await web3.eth.getBalance(this.registry.address)), 'ether')
        const emptyAddressFinalBalance = web3.utils.fromWei((await web3.eth.getBalance(emptyAddress)), 'ether')
        assert.equal(registryInitialWithForcedEther, 10)
        assert.equal(registryFinalBalance, 0)
        assert.equal(emptyAddressFinalBalance, 10)
      })
    })
  })
})
