import assertRevert from './helpers/assertRevert'
import expectThrow from './helpers/expectThrow'
import { on } from 'cluster';
const Proxy = artifacts.require("OwnedUpgradeabilityProxy")
const TrueUSD = artifacts.require("TrueUSDMock")

contract('Proxy', function (accounts) {
    const [_, owner, oneHundred, anotherAccount] = accounts
    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

    describe('Proxy ownership', async function () {
        beforeEach(async function () {
            this.proxy = await Proxy.new({from: owner})
        })

        it('owner is the owner of the proxy', async function(){
            const proxyOwner = await this.proxy.proxyOwner.call()
            assert.equal(proxyOwner, owner)
        })

        it('owner can transfer proxy ownership ', async function(){
            let pendingOwner = await this.proxy.pendingProxyOwner.call()
            assert.equal(pendingOwner, ZERO_ADDRESS)
            await this.proxy.transferProxyOwnership(oneHundred, {from: owner})
            pendingOwner = await this.proxy.pendingProxyOwner.call()
            assert.equal(pendingOwner, oneHundred)
        })

        it('pending owner can claim ownership ', async function(){
            await this.proxy.transferProxyOwnership(oneHundred, {from: owner})
            await this.proxy.claimProxyOwnership({from: oneHundred})
            const proxyOwner = await this.proxy.proxyOwner.call()
            assert.equal(proxyOwner, oneHundred)
        })

        it('non owner cannot transfer ownership ', async function(){
            await assertRevert(this.proxy.transferProxyOwnership(oneHundred, {from: anotherAccount}))
        })

        it('non pending owner cannot claim ownership ', async function(){
            await this.proxy.transferProxyOwnership(oneHundred, {from: owner})
            await assertRevert(this.proxy.claimProxyOwnership({from: anotherAccount}))
        })

        it('zero address cannot be pending owner ', async function(){
            await assertRevert(this.proxy.transferProxyOwnership(ZERO_ADDRESS, {from: owner}))
        })

    })
    describe('set implementation', async function(){
        beforeEach(async function () {
            this.proxy = await Proxy.new({from: owner})
            this.token = await TrueUSD.at(this.proxy.address)
        })

        it('sets up implementation contract ', async function(){
            await this.proxy.upgradeTo(oneHundred, {from: owner})
            const implementation = await this.proxy.implementation.call()
            assert.equal(implementation, oneHundred)    
        })

        it('non owner cannot upgrade implementation contract', async function(){
            await assertRevert(this.proxy.upgradeTo(oneHundred, {from: anotherAccount}))
        })

        it('new implementation contract cannot be the same as the old', async function(){
            await this.proxy.upgradeTo(oneHundred, {from: owner})
            await assertRevert(this.proxy.upgradeTo(oneHundred, {from: owner}))
        })
    })

    describe('Events', async function(){
        beforeEach(async function () {
            this.proxy = await Proxy.new({from: owner})
        })
        
        it('upgrade implementation emits event', async function(){
            const {logs} = await this.proxy.upgradeTo(oneHundred, {from: owner})
            assert.equal(logs[0].event, 'Upgraded')
            assert.equal(logs[0].args.implementation, oneHundred)
        })

        it('transfer proxy ownership emits event', async function(){
            const {logs} = await this.proxy.transferProxyOwnership(oneHundred, {from: owner})
            assert.equal(logs[0].event, 'NewPendingOwner')
            assert.equal(logs[0].args.currentOwner, owner)
            assert.equal(logs[0].args.pendingOwner, oneHundred)
        })

        it('claim proxy ownership emits event', async function(){
            await this.proxy.transferProxyOwnership(oneHundred, {from: owner})
            const {logs} = await this.proxy.claimProxyOwnership({from: oneHundred})
            assert.equal(logs[0].event, 'ProxyOwnershipTransferred')
            assert.equal(logs[0].args.previousOwner, owner)
            assert.equal(logs[0].args.newOwner, oneHundred)
        })

    })
})
