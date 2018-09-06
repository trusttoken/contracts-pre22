import assertRevert from './helpers/assertRevert'
import expectThrow from './helpers/expectThrow'
import assertBalance from './helpers/assertBalance'
import increaseTime, { duration } from './helpers/increaseTime'
import { throws } from 'assert'
const Registry = artifacts.require("Registry")
const TrueUSD = artifacts.require("TrueUSD")
const BalanceSheet = artifacts.require("BalanceSheet")
const AllowanceSheet = artifacts.require("AllowanceSheet")
const TimeLockedController = artifacts.require("TimeLockedController")
const TrueUSDMock = artifacts.require("TrueUSDMock")
const ForceEther = artifacts.require("ForceEther")
const DelegateBurnableMock = artifacts.require("DelegateBurnableMock")
const FaultyDelegateBurnableMock1 = artifacts.require("FaultyDelegateBurnableMock1")
const FaultyDelegateBurnableMock2 = artifacts.require("FaultyDelegateBurnableMock2")
const DateTimeMock = artifacts.require("DateTimeMock")
const MultisigOwner = artifacts.require("MultisigOwner")
const BasicTokenMock = artifacts.require("BasicTokenMock")


contract('MultisigOwner', function (accounts) {
    const [_, owner1, owner2, owner3 , oneHundred, mintKey, pauseKey, approver] = accounts
    
    beforeEach(async function () {
        this.registry = await Registry.new({ from: owner1 })
        this.dateTime = await DateTimeMock.new({ from: owner1 })
        this.token = await TrueUSDMock.new(oneHundred, 100*10**18, { from: owner1 })
        this.controller = await TimeLockedController.new({ from: owner1 })
        await this.controller.setRegistry(this.registry.address, { from: owner1 })
        await this.token.transferOwnership(this.controller.address, { from: owner1 })
        await this.controller.issueClaimOwnership(this.token.address, { from: owner1 })
        await this.controller.setTrueUSD(this.token.address, { from: owner1 })
        await this.controller.setTusdRegistry(this.registry.address, { from: owner1 })
        await this.controller.setDateTime(this.dateTime.address, { from: owner1 })
        await this.controller.transferMintKey(mintKey, { from: owner1 })
        this.balanceSheet = await this.token.balances()
        this.allowanceSheet = await this.token.allowances()
        this.delegateContract = await DelegateBurnableMock.new({ from: owner1 })
        this.faultyDelegateContract1 = await FaultyDelegateBurnableMock1.new({ from: owner1 })
        this.faultyDelegateContract2 = await FaultyDelegateBurnableMock2.new({ from: owner1 })
        await this.registry.setAttribute(oneHundred, "hasPassedKYC/AML", 1, "notes", { from: owner1 })
        await this.registry.setAttribute(approver, "isTUSDMintApprover", 1, "notes", { from: owner1 })
        await this.registry.setAttribute(pauseKey, "isTUSDMintChecker", 1, "notes", { from: owner1 })

        this.multisigOwner = await MultisigOwner.new([owner1, owner2, owner3], { from: owner1 })
    })

    describe('Multisig Contract claiming TimeLockController', function () {
        it('Multisig can claimownership to TimeLockController', async function () {
            await this.controller.transferOwnership(this.multisigOwner.address, { from: owner1 })
            console.log("multisig.address:",this.multisigOwner.address)
            const initialOwner = await this.controller.owner()
            console.log("initialOwner:", initialOwner)
            await this.multisigOwner.msIssueclaimContract(this.controller.address, {from : owner1 })
            const currentOwner = await this.controller.owner()
            console.log("currentOwner:", currentOwner)
            const pendingOwner = await this.controller.pendingOwner()
            console.log("pendingOwner:", pendingOwner)
            await this.multisigOwner.msIssueclaimContract(this.controller.address, {from : owner2 })
            const finalOwner = await this.controller.owner()
            console.log("finalOwner:", finalOwner)
            console.log(this.multisigOwner.address)
   
        })

        it('multisig cannot claim ownership when there is another action in flight', async function () {
            await this.controller.transferOwnership(this.multisigOwner.address, { from: owner1 })
            await this.multisigOwner.msIssueclaimContract(this.registry.address, {from : owner1 })
            await assertRevert(this.multisigOwner.msIssueclaimContract(this.controller.address, {from : owner2 }));
        })

        it('Multisig cannot claimownership to when ownership is not transferred', async function () {
            await this.multisigOwner.msIssueclaimContract(this.controller.address, {from : owner1 })
            await assertRevert(this.multisigOwner.msIssueclaimContract(this.controller.address, {from : owner2 })) 
        })

        it('non owners cannot call onlyOwner functions', async function(){
            await this.controller.transferOwnership(this.multisigOwner.address, { from: owner1 })
            await assertRevert(this.multisigOwner.msIssueclaimContract(this.controller.address, {from : oneHundred }));
        })
    })

    describe('Functions independent of timeLockController', async function(){
        it ('current owners are owners', async function(){
            const owner1Result = await this.multisigOwner.Owners(owner1)
            const owner2Result = await this.multisigOwner.Owners(owner2)
            const owner3Result = await this.multisigOwner.Owners(owner3)
            console.log(owner1Result,owner2Result,owner3Result)
        })

        it ('Owners can modify owner multisig owners', async function(){
            await this.multisigOwner.updateOwner(owner3, oneHundred, {from : owner1 })
            let newOwnerResult = await this.multisigOwner.Owners(oneHundred)
            let owner3Result = await this.multisigOwner.Owners(owner3)
            console.log(newOwnerResult,owner3Result)
            await this.multisigOwner.updateOwner(owner3, oneHundred, {from : owner2 })
            newOwnerResult = await this.multisigOwner.Owners(oneHundred)
            owner3Result = await this.multisigOwner.Owners(owner3)
            console.log(newOwnerResult,owner3Result)
            const ownerList0 = await this.multisigOwner.ownerList(0)
            const ownerList1 = await this.multisigOwner.ownerList(1)
            const ownerList2 = await this.multisigOwner.ownerList(2)
            console.log(ownerList0)
            console.log(ownerList1)
            console.log(ownerList2)
        })

        it ('Owners can set timelock controller', async function(){
            await this.multisigOwner.msSetTimeLockController(this.controller.address, {from : owner1 })
            await this.multisigOwner.msSetTimeLockController(this.controller.address, {from : owner2 })
            const controller = await this.multisigOwner.timeLockController();
            console.log(controller)
        })


        it ('Owners can transfer contract it owns to other addresses', async function(){
            await this.controller.transferOwnership(this.multisigOwner.address, { from: owner1 })
            await this.multisigOwner.msIssueclaimContract(this.controller.address, {from : owner1 })
            await this.multisigOwner.msIssueclaimContract(this.controller.address, {from : owner2 })
            const currentOwner = await this.controller.owner()
            console.log(currentOwner)

            await this.multisigOwner.msReclaimContract(this.controller.address, oneHundred, {from : owner1 })
            await this.multisigOwner.msReclaimContract(this.controller.address, oneHundred, {from : owner2 })
            const controllerPendingOwner = await this.controller.pendingOwner()
            console.log(controllerPendingOwner)
            console.log(oneHundred)
        })

        it ('owners can reclaim ether',async function(){
            const initialBalance = web3.fromWei(web3.eth.getBalance(this.multisigOwner.address), 'ether').toNumber()
            console.log(initialBalance)
            await this.multisigOwner.sendTransaction({from: oneHundred, gas: 30000, value: 10});                  
            const balanceWithEther = web3.fromWei(web3.eth.getBalance(this.multisigOwner.address), 'ether').toNumber()
            console.log(balanceWithEther)
            await this.multisigOwner.msReclaimEther(oneHundred, {from : owner1 })
            await this.multisigOwner.msReclaimEther(oneHundred, {from : owner2 })
            const multisigFinalBalance = web3.fromWei(web3.eth.getBalance(this.multisigOwner.address), 'ether').toNumber()
            const userBalance = web3.fromWei(web3.eth.getBalance(oneHundred), 'ether').toNumber()
            console.log(multisigFinalBalance)
            console.log(userBalance)
        })

        it('owners can reclaim token', async function(){
            this.basicToken = await BasicTokenMock.new(this.multisigOwner.address, 100, {from: owner1});
            await this.multisigOwner.msReclaimToken(this.basicToken.address, oneHundred, {from : owner1 })
            await this.multisigOwner.msReclaimToken(this.basicToken.address, oneHundred,  {from : owner2 })
            const contractBalance = await this.basicToken.balanceOf(this.multisigOwner.address)
            const userBalance = await this.basicToken.balanceOf(oneHundred)
            console.log(contractBalance)
            console.log(userBalance)
        })

        it('owners can veto actions', async function(){
            await this.multisigOwner.msSetTimeLockController(this.controller.address, {from : owner1 })
            await this.multisigOwner.veto({from : owner2 })
            await this.multisigOwner.veto({from : owner3 })
            const ownerAction = await this.multisigOwner.ownerAction();
            console.log(ownerAction)
        })

        it('owner cannot veto an action twice', async function(){
            await this.multisigOwner.msSetTimeLockController(this.controller.address, {from : owner1 })
            await this.multisigOwner.veto({from : owner2 })
            await assertRevert(this.multisigOwner.veto({from : owner2 }))
        })

        it('same owner cannot sign the same action twice', async function(){
            await this.multisigOwner.msSetTimeLockController(this.controller.address, {from : owner1 })
            await assertRevert(this.multisigOwner.msSetTimeLockController(this.controller.address, {from : owner1 }))
        })

    }) 

    describe('Call timeLockController functions', function(){
        beforeEach(async function () {
            await this.controller.transferOwnership(this.multisigOwner.address, { from: owner1 })
            await this.multisigOwner.msIssueclaimContract(this.controller.address, {from : owner1 })
            await this.multisigOwner.msIssueclaimContract(this.controller.address, {from : owner2 })
            await this.multisigOwner.msSetTimeLockController(this.controller.address, {from : owner1 })
            await this.multisigOwner.msSetTimeLockController(this.controller.address, {from : owner2 })
        })

        it('call reclaimEther of timeLockController', async function(){
            const forceEther = await ForceEther.new({ from: oneHundred, value: "10000000000000000000" })
            await forceEther.destroyAndSend(this.controller.address)
            const controllerInitialBalance = web3.fromWei(web3.eth.getBalance(this.controller.address), 'ether').toNumber()
            const multisigInitialBalance = web3.fromWei(web3.eth.getBalance(this.multisigOwner.address), 'ether').toNumber()
            await this.multisigOwner.reclaimEther({from: owner1})
            await this.multisigOwner.reclaimEther({from: owner2})
            const controllerFinalBalance = web3.fromWei(web3.eth.getBalance(this.controller.address), 'ether').toNumber()
            const multisigFinalBalance = web3.fromWei(web3.eth.getBalance(this.multisigOwner.address), 'ether').toNumber()
            console.log(controllerInitialBalance)
            console.log(multisigInitialBalance)
            console.log(controllerFinalBalance)
            console.log(multisigFinalBalance)
        })

        it('function should fail if controller call fails', async function(){
            await this.multisigOwner.transferOwnership(this.balanceSheet.address, {from: owner1})
            await assertRevert(this.multisigOwner.transferOwnership(this.balanceSheet.address, {from: owner1}))
        })

        it('call transferOwnership of timeLockController', async function(){
            await this.multisigOwner.transferOwnership(oneHundred,{from: owner1})
            await this.multisigOwner.transferOwnership(oneHundred,{from: owner2})
            const pendingOwner = await this.controller.pendingOwner()
            console.log(pendingOwner)
            console.log(oneHundred)
        })

        it('call addMintCheckTime of timeLockController', async function(){
            await this.multisigOwner.addMintCheckTime(8,30,{from: owner1})
            await this.multisigOwner.addMintCheckTime(8,30,{from: owner2})
            console.log(0)
            const numberOfCheckTimes = await this.controller.numberOfCheckTimes()
            console.log(1)
            console.log("numberofchecks",numberOfCheckTimes)
            const firstCheckTime = await this.controller.mintCheckTimes(0)
            console.log(2)
            assert.equal(Number(numberOfCheckTimes), 1)
            assert.equal(Number(firstCheckTime[0]), 8)
            assert.equal(Number(firstCheckTime[1]), 30)

        })

        it('call removeMintCheckTime of timeLockController', async function(){
            await this.multisigOwner.addMintCheckTime(8,30,{from: owner1})
            await this.multisigOwner.addMintCheckTime(8,30,{from: owner2})
            await this.multisigOwner.removeMintCheckTime(0,{from: owner1})
            await this.multisigOwner.removeMintCheckTime(0,{from: owner2})
            const numberOfCheckTimes = await this.controller.numberOfCheckTimes()
            assert.equal(Number(numberOfCheckTimes), 0)

        })

        it('call setSmallMintThreshold of timeLockController', async function(){
            await this.multisigOwner.setSmallMintThreshold(10000, {from: owner1})
            await this.multisigOwner.setSmallMintThreshold(10000, {from: owner2})

        })

        it('call setMinimalApprovals of timeLockController', async function(){
            await this.multisigOwner.setMinimalApprovals(1, 2, {from: owner1})
            await this.multisigOwner.setMinimalApprovals(1, 2, {from: owner2})

        })

        it('call setMintLimit of timeLockController', async function(){
            await this.multisigOwner.setMintLimit(1000, {from: owner1})
            await this.multisigOwner.setMintLimit(1000, {from: owner2})

        })

        it('call resetMintedToday of timeLockController', async function(){
            await this.multisigOwner.resetMintedToday({from: owner1})
            await this.multisigOwner.resetMintedToday({from: owner2})

        })

        it('call pauseMints of timeLockController', async function(){
            await this.multisigOwner.pauseMints({from: owner1})
            await this.multisigOwner.pauseMints({from: owner2})
        })

        it('call unPauseMints of timeLockController', async function(){
            await this.multisigOwner.unPauseMints({from: owner1})
            await this.multisigOwner.unPauseMints({from: owner2})
        })

        it('call addHoliday of timeLockController', async function(){
            await this.multisigOwner.addHoliday(2018, 1, 1, {from: owner1})
            await this.multisigOwner.addHoliday(2018, 1, 1, {from: owner2})

        })

        it('call removeHoliday of timeLockController', async function(){
            await this.multisigOwner.addHoliday(2018, 1, 1, {from: owner1})
            await this.multisigOwner.addHoliday(2018, 1, 1, {from: owner2})

            await this.multisigOwner.removeHoliday(2018, 1, 1, {from: owner1})
            await this.multisigOwner.removeHoliday(2018, 1, 1, {from: owner2})

        })

        it('call setDateTime of timeLockController', async function(){
            await this.multisigOwner.setDateTime(this.dateTime.address, {from: owner1})
            await this.multisigOwner.setDateTime(this.dateTime.address, {from: owner2})

        })

        it('call setDelegatedFrom of timeLockController', async function(){
            await this.multisigOwner.setDelegatedFrom(this.token.address, {from: owner1})
            await this.multisigOwner.setDelegatedFrom(this.token.address, {from: owner2})

        })

        it('call setTrueUSD of timeLockController', async function(){
            await this.multisigOwner.setTrueUSD(this.token.address, {from: owner1})
            await this.multisigOwner.setTrueUSD(this.token.address, {from: owner2})

        })

        it('call changeTokenName of timeLockController', async function(){
            await this.multisigOwner.changeTokenName("Terry Token", "ttt", {from: owner1})
            await this.multisigOwner.changeTokenName("Terry Token", "ttt", {from: owner2})

        })

        it('call setTusdRegistry of timeLockController', async function(){
            await this.multisigOwner.setTusdRegistry(this.registry.address, {from: owner1})
            await this.multisigOwner.setTusdRegistry(this.registry.address, {from: owner2})

        })

        it('call delegateToNewContract of timeLockController', async function(){
            await this.multisigOwner.pauseMints({from: owner1})
            await this.multisigOwner.pauseMints({from: owner2})

        })

        it('call transferChild of timeLockController', async function(){
            await this.multisigOwner.pauseMints({from: owner1})
            await this.multisigOwner.pauseMints({from: owner2})

        })

        it('call requestReclaimContract of timeLockController', async function(){
            await this.multisigOwner.pauseMints({from: owner1})
            await this.multisigOwner.pauseMints({from: owner2})

        })

        it('call transferChild of timeLockController', async function(){
            await this.multisigOwner.pauseMints({from: owner1})
            await this.multisigOwner.pauseMints({from: owner2})

        })

        it('call requestReclaimEther of timeLockController', async function(){
            await this.multisigOwner.pauseMints({from: owner1})
            await this.multisigOwner.pauseMints({from: owner2})

        })

        it('call requestReclaimToken of timeLockController', async function(){
            this.basicToken = await BasicTokenMock.new(this.token.address, 100, {from: owner1});

            await this.multisigOwner.requestReclaimToken(this.basicToken.address, {from: owner1})
            await this.multisigOwner.requestReclaimToken(this.basicToken.address, {from: owner2})
            
            const tokenContractBalance = await this.basicToken.balanceOf(this.token.address)
            const multiSigBalance = await this.basicToken.balanceOf(this.multisigOwner.address)
            console.log(tokenContractBalance)
            console.log(multiSigBalance)

            await this.multisigOwner.msReclaimToken(this.basicToken.address, oneHundred, {from : owner1 })
            await this.multisigOwner.msReclaimToken(this.basicToken.address, oneHundred,  {from : owner2 })
            
            const userBalance = await this.basicToken.balanceOf(oneHundred)
            console.log(userBalance)

        })

        it('call setBurnBounds of timeLockController', async function(){
            await this.multisigOwner.setBurnBounds(10, 100, {from: owner1})
            await this.multisigOwner.setBurnBounds(10, 100, {from: owner2})

        })

        it('call changeStakingFees of timeLockController', async function(){
            await this.multisigOwner.changeStakingFees(1, 2, 3, 4, 5, 6, 7, 8, {from: owner1})
            await this.multisigOwner.changeStakingFees(1, 2, 3, 4, 5, 6, 7, 8, {from: owner2})

        })

        it('call changeStaker of timeLockController', async function(){
            await this.multisigOwner.changeStaker(oneHundred, {from: owner1})
            await this.multisigOwner.changeStaker(oneHundred, {from: owner2})

        })

        


        
    })
})
