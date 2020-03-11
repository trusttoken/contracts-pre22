import assertRevert from './helpers/assertRevert'
import expectThrow from './helpers/expectThrow'
import assertBalance from './helpers/assertBalance'
import increaseTime, { duration } from './helpers/increaseTime'
import { throws } from 'assert'
const Registry = artifacts.require("RegistryMock")
const TrueUSD = artifacts.require("TrueUSDMock")
const PreMigrationTokenController = artifacts.require("PreMigrationTokenController")
const MultisigOwner = artifacts.require("MultiSigOwner")
const Proxy = artifacts.require("OwnedUpgradeabilityProxy")

const bytes32 = require('./helpers/bytes32.js')
const BN = web3.utils.toBN;

contract('MultisigOwner With Proxy', function (accounts) {
    const [_, owner1, owner2, owner3 , oneHundred, blackListed, mintKey, pauseKey, approver] = accounts
    const notes = bytes32("notes");
    const KYCAML = bytes32("hasPassedKYC/AML")
    const CAN_BURN = bytes32("canBurn")
    
    beforeEach(async function () {
        this.multisigProxy = await Proxy.new({ from: owner1 })
        this.multisigImplementation = await MultisigOwner.new({ from: owner1 })
        this.multisigOwner = await MultisigOwner.at(this.multisigProxy.address)
        await this.multisigProxy.upgradeTo(this.multisigImplementation.address, {from: owner1})

        await this.multisigOwner.msInitialize([owner1, owner2, owner3],{ from: owner1 })
        await this.multisigProxy.transferProxyOwnership(this.multisigOwner.address, {from: owner1})

        await this.multisigOwner.msClaimProxyOwnership({from: owner1})
        await this.multisigOwner.msClaimProxyOwnership({from: owner2})

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
        await this.multisigOwner.initialize({from : owner1 })
        await this.multisigOwner.initialize({from : owner2 })
        this.tokenProxy = await Proxy.new({ from: owner1 })
        this.tokenImplementation = await TrueUSD.new(owner1, 0, { from: owner1 })
        this.token = await TrueUSD.at(this.tokenProxy.address)

        await this.multisigOwner.setToken(this.token.address, {from : owner1 })
        await this.multisigOwner.setToken(this.token.address, {from : owner2 })
        await this.tokenProxy.transferProxyOwnership(this.controller.address,{ from: owner1 } )

        await this.multisigOwner.claimTusdProxyOwnership({from : owner1 })
        await this.multisigOwner.claimTusdProxyOwnership({from : owner2 })
        await this.multisigOwner.upgradeTusdProxyImplTo(this.tokenImplementation.address, {from : owner1 })
        await this.multisigOwner.upgradeTusdProxyImplTo(this.tokenImplementation.address, {from : owner2 })
        
        await this.token.initialize({from :owner1})
        await this.token.transferOwnership(this.controller.address, {from: owner1})
        await this.multisigOwner.issueClaimOwnership(this.token.address, {from: owner1})
        await this.multisigOwner.issueClaimOwnership(this.token.address, {from: owner2})

        await this.multisigOwner.transferMintKey(mintKey, { from: owner1 })
        await this.multisigOwner.transferMintKey(mintKey, { from: owner2 })
        await this.multisigOwner.setRegistry(this.registry.address, { from: owner1 })
        await this.multisigOwner.setRegistry(this.registry.address, { from: owner2 })
        await this.multisigOwner.setTokenRegistry(this.registry.address, { from: owner1 })
        await this.multisigOwner.setTokenRegistry(this.registry.address, { from: owner2 })

        await this.registry.subscribe(CAN_BURN, this.token.address, { from: owner1 })
        await this.registry.subscribe(KYCAML, this.token.address, { from: owner1 })
        await this.registry.setAttribute(oneHundred, KYCAML, 1, notes, { from: owner1 })
        await this.registry.setAttribute(oneHundred, CAN_BURN, 1, notes, { from: owner1 })
        await this.registry.setAttribute(oneHundred, KYCAML, 1, notes, { from: owner1 })
        await this.registry.setAttribute(approver, bytes32("isTUSDMintApprover"), 1, notes, { from: owner1 })
        await this.registry.setAttribute(pauseKey, bytes32("isTUSDMintPausers"), 1, notes, { from: owner1 })
        await this.multisigOwner.requestMint(oneHundred, BN(10*10**18),  {from: owner1})
        await this.multisigOwner.requestMint(oneHundred, BN(10*10**18), {from: owner2})
        await this.multisigOwner.ratifyMint(0,oneHundred, BN(10*10**18), {from: owner1})
        await this.multisigOwner.ratifyMint(0,oneHundred, BN(10*10**18), {from: owner2})
    })

    it('multisg proxy owns itself', async function(){
        const proxyOwner = await this.multisigProxy.proxyOwner.call()
        assert.equal(proxyOwner,this.multisigProxy.address)
    })

    it('multisig owner can upgrade itself', async function(){
        this.newMultisigImplementation = await MultisigOwner.new({ from: owner1 })
        await this.multisigOwner.msUpgradeImplementation(this.newMultisigImplementation.address,{from: owner1})
        await this.multisigOwner.msUpgradeImplementation(this.newMultisigImplementation.address,{from: owner2})
        const newImplementation = await this.multisigProxy.implementation.call()
        assert.equal(newImplementation,this.newMultisigImplementation.address)
    })

    it('multisig owner can upgrade itself', async function(){
        await this.multisigOwner.msTransferProxyOwnership(owner2,{from: owner1})
        await this.multisigOwner.msTransferProxyOwnership(owner2,{from: owner2})
        await this.multisigProxy.claimProxyOwnership({from: owner2})
        const newProxyOwner = await this.multisigProxy.proxyOwner.call()
        assert.equal(newProxyOwner,owner2)
    })

    it('multisig owner can accept eth', async function(){
        const initialEthBalance = Number(await web3.eth.getBalance(this.multisigProxy.address))
        await this.multisigProxy.sendTransaction({ 
            value: 33, 
            from: owner1, 
            gas: 300000 
         });         
         const ethBalance = Number(await web3.eth.getBalance(this.multisigProxy.address))
         assert.isAbove(ethBalance, initialEthBalance)
    })
})
