import assertRevert from './helpers/assertRevert'
import expectThrow from './helpers/expectThrow'
import assertBalance from './helpers/assertBalance'
const Registry = artifacts.require("RegistryMock")
const TrueUSD = artifacts.require("TrueUSDMock")
const Proxy = artifacts.require("OwnedUpgradeabilityProxy")
const PreMigrationTokenController = artifacts.require("PreMigrationTokenController")
const MultisigOwner = artifacts.require("MultiSigOwner")

const bytes32 = require('./helpers/bytes32.js')
const BN = web3.utils.toBN;

contract('--Full upgrade process with multisig--', function (accounts) {
    const [_, owner1, owner2, owner3 , oneHundred, anotherAccount, mintKey, pauseKey, approver] = accounts
    const notes = bytes32("notes")
    const CAN_BURN = bytes32("canBurn")

    describe('--Set up contracts--', function () {
        beforeEach(async function () {
            this.multisigOwner = await MultisigOwner.new({ from: owner1 })
            await this.multisigOwner.msInitialize([owner1, owner2, owner3],{ from: owner1 })

            this.registry = await Registry.new({ from: owner1 })
            this.controllerImplementation = await PreMigrationTokenController.new({ from: owner1 })
            this.controllerProxy = await Proxy.new({ from: owner1 })
            this.controller = await PreMigrationTokenController.at(this.controllerProxy.address)
            await this.multisigOwner.msSetTokenController(this.controllerProxy.address, {from : owner1 })
            await this.multisigOwner.msSetTokenController(this.controllerProxy.address, {from : owner2 })
            await this.controllerProxy.transferProxyOwnership(this.multisigOwner.address,{ from: owner1 } )
            await this.multisigOwner.msClaimControllerProxyOwnership({from : owner1 })
            await this.multisigOwner.msClaimControllerProxyOwnership({from : owner2 })
            await this.multisigOwner.msUpgradeControllerProxyImplTo(this.controllerImplementation.address, {from : owner1 })
            await this.multisigOwner.msUpgradeControllerProxyImplTo(this.controllerImplementation.address, {from : owner2 })
            this.tokenProxy = await Proxy.new({ from: owner1 })
            this.tokenImplementation = await TrueUSD.new(owner1, 0, { from: owner1 })
            this.token = await TrueUSD.at(this.tokenProxy.address)
            await this.registry.subscribe(CAN_BURN, this.token.address, { from: owner1 })
            await this.tokenProxy.transferProxyOwnership(this.controller.address,{ from: owner1 } )
            await this.multisigOwner.initialize({from : owner1 })
            await this.multisigOwner.initialize({from : owner2 })
            await this.multisigOwner.setToken(this.token.address, {from : owner1 })
            await this.multisigOwner.setToken(this.token.address, {from : owner2 })
            await this.multisigOwner.claimTusdProxyOwnership({from : owner1 })
            await this.multisigOwner.claimTusdProxyOwnership({from : owner2 })
            await this.multisigOwner.upgradeTusdProxyImplTo(this.tokenImplementation.address, {from : owner1 })
            await this.multisigOwner.upgradeTusdProxyImplTo(this.tokenImplementation.address, {from : owner2 })
            await this.token.initialize({ from: owner1 })
            await this.token.transferOwnership(this.controller.address, {from: owner1})
            await this.multisigOwner.issueClaimOwnership(this.token.address, {from: owner1})
            await this.multisigOwner.issueClaimOwnership(this.token.address, {from: owner2})
            await this.multisigOwner.transferMintKey(mintKey, { from: owner1 })
            await this.multisigOwner.transferMintKey(mintKey, { from: owner2 })

            await this.multisigOwner.setRegistry(this.registry.address, { from: owner1 })
            await this.multisigOwner.setRegistry(this.registry.address, { from: owner2 })
            await this.multisigOwner.setTokenRegistry(this.registry.address, { from: owner1 })
            await this.multisigOwner.setTokenRegistry(this.registry.address, { from: owner2 })
            await this.registry.setAttribute(oneHundred, CAN_BURN, 1, notes, { from: owner1 })
            await this.registry.setAttribute(approver, bytes32("isTUSDMintApprover"), 1, notes, { from: owner1 })
            await this.registry.setAttribute(pauseKey, bytes32("isTUSDMintPausers"), 1, notes, { from: owner1 })
            await this.multisigOwner.requestMint(oneHundred, BN(10*10**18),  {from: owner1})
            await this.multisigOwner.requestMint(oneHundred, BN(10*10**18), {from: owner2})
            await this.multisigOwner.ratifyMint(0,oneHundred, BN(10*10**18), {from: owner1})
            await this.multisigOwner.ratifyMint(0,oneHundred, BN(10*10**18), {from: owner2})
        })
        describe('Assertion tests for set up', async function()  {

            it('multisig contract cannot be reinitialized', async function() {
                await assertRevert(this.multisigOwner.msInitialize([owner1, owner2, owner3],{ from: owner1 }))
            })

            it('controller contract cannot be reinitialized', async function() {
                await assertRevert(this.controller.initialize({from: owner1}))
                await assertRevert(this.controller.initialize({from: oneHundred}))
            })

            it('token contract cannot be reinitialized', async function() {
                await assertRevert(this.token.initialize({from: owner1}))
                await assertRevert(this.token.initialize({from: oneHundred}))
            })

            it('Controller owner is set', async function(){
                const controllerOwner = await this.controller.owner.call()
                assert.equal(controllerOwner, this.multisigOwner.address)
            })

            it('Token owner is set', async function(){
                const tokenOwner = await this.token.owner.call()
                assert.equal(tokenOwner,this.controller.address)
            })

            it('controller cannot accept eth', async function(){
                await assertRevert(this.controller.sendTransaction({ 
                    value: 33, 
                    from: owner3, 
                    gas: 400000 
                 }));             
            })

            it('token cannot accept eth', async function(){
                await assertRevert(this.token.sendTransaction({ 
                    value: 33, 
                    from: owner3, 
                    gas: 400000 
                 }));             
            })
        })
        describe('Upgrade each piece of the contract', async function()  {
            it('upgrades token implementation contract', async function() {
                this.newTokenImplementation = await TrueUSD.new(owner2, 0, { from: owner2 })
                await this.multisigOwner.upgradeTusdProxyImplTo(this.newTokenImplementation.address, {from : owner1 })
                await this.multisigOwner.upgradeTusdProxyImplTo(this.newTokenImplementation.address, {from : owner2 })
                const newImplAddress = await this.tokenProxy.implementation.call()
                assert.equal(newImplAddress,this.newTokenImplementation.address)
                const currentOwner = await this.token.owner.call()
                assert.equal(currentOwner,this.controller.address)
                await this.multisigOwner.requestMint(oneHundred, BN(10*10**18),  {from: owner1})
                await this.multisigOwner.requestMint(oneHundred, BN(10*10**18), {from: owner2})
                await this.multisigOwner.ratifyMint(1, oneHundred, BN(10*10**18),  {from: owner1})
                await this.multisigOwner.ratifyMint(1, oneHundred, BN(10*10**18), {from: owner2})    
            })
            it('upgrades controller implementation contract', async function() {
                this.newControllerImplementation = await PreMigrationTokenController.new({ from: owner2 })
                await this.multisigOwner.msUpgradeControllerProxyImplTo(this.newControllerImplementation.address, {from : owner1 })
                await this.multisigOwner.msUpgradeControllerProxyImplTo(this.newControllerImplementation.address, {from : owner2 })
                const newImplAddress = await this.controllerProxy.implementation.call()
                assert.equal(newImplAddress,this.newControllerImplementation.address)
                const currentOwner = await this.controller.owner.call()
                assert.equal(currentOwner,this.multisigOwner.address)
                await this.multisigOwner.requestMint(oneHundred, BN(10*10**18),  {from: owner1})
                await this.multisigOwner.requestMint(oneHundred, BN(10*10**18), {from: owner2})
                await this.multisigOwner.ratifyMint(1, oneHundred, BN(10*10**18), {from: owner1})
                await this.multisigOwner.ratifyMint(1, oneHundred, BN(10*10**18), {from: owner2})    
            })
            it('upgrades multisig owner contract', async function() {
                this.newMultisigOwner = await MultisigOwner.new({ from: owner1 })

                await this.newMultisigOwner.msInitialize([owner1, owner2, owner3], { from: owner1 })

                await this.multisigOwner.transferOwnership(this.newMultisigOwner.address, {from: owner1})
                await this.multisigOwner.transferOwnership(this.newMultisigOwner.address, {from: owner2})    
                await this.multisigOwner.msTransferControllerProxyOwnership(this.newMultisigOwner.address, {from: owner1})
                await this.multisigOwner.msTransferControllerProxyOwnership(this.newMultisigOwner.address, {from: owner2})    
                
                await this.newMultisigOwner.msSetTokenController(this.controller.address, {from : owner1 })
                await this.newMultisigOwner.msSetTokenController(this.controller.address, {from : owner2 })
    
                await this.newMultisigOwner.claimOwnership({from: owner1})
                await this.newMultisigOwner.claimOwnership({from: owner2})    
                
                await this.newMultisigOwner.msClaimControllerProxyOwnership({from: owner1})
                await this.newMultisigOwner.msClaimControllerProxyOwnership({from: owner2})    
            })
            it('upgrades controller proxy contract', async function() {
                this.newControllerImplementation = await PreMigrationTokenController.new({ from: owner1 })
                this.newControllerProxy = await Proxy.new({ from: owner1 })
                this.newController = await PreMigrationTokenController.at(this.newControllerProxy.address)
                await this.multisigOwner.transferChild(this.token.address, this.newControllerProxy.address, {from : owner1 })
                await this.multisigOwner.transferChild(this.token.address, this.newControllerProxy.address, {from : owner2 })
                await this.multisigOwner.transferTusdProxyOwnership(this.newControllerProxy.address, {from : owner1 })
                await this.multisigOwner.transferTusdProxyOwnership(this.newControllerProxy.address, {from : owner2 })
                await this.multisigOwner.msSetTokenController(this.newControllerProxy.address, {from : owner1 })
                await this.multisigOwner.msSetTokenController(this.newControllerProxy.address, {from : owner2 })
                await this.newControllerProxy.transferProxyOwnership(this.multisigOwner.address,{ from: owner1 } )
                await this.multisigOwner.msClaimControllerProxyOwnership({from : owner1 })
                await this.multisigOwner.msClaimControllerProxyOwnership({from : owner2 })
                await this.multisigOwner.msUpgradeControllerProxyImplTo(this.newControllerImplementation.address, {from : owner1 })
                await this.multisigOwner.msUpgradeControllerProxyImplTo(this.newControllerImplementation.address, {from : owner2 })
                await this.multisigOwner.initialize({from : owner1 })
                await this.multisigOwner.initialize({from : owner2 })
                await this.multisigOwner.issueClaimOwnership(this.token.address, {from : owner1 })
                await this.multisigOwner.issueClaimOwnership(this.token.address, {from : owner2 })
                await this.multisigOwner.setToken(this.token.address, {from : owner1 })
                await this.multisigOwner.setToken(this.token.address, {from : owner2 })
                await this.multisigOwner.claimTusdProxyOwnership({from : owner1 })
                await this.multisigOwner.claimTusdProxyOwnership({from : owner2 })
            })
        })
    })
})
