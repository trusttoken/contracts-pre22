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
const FastPauseMints = artifacts.require("FastPauseMints")
const FastPauseTrueUSD = artifacts.require("FastPauseTrueUSD")
const GlobalPause = artifacts.require("GlobalPause")

contract('TimeLockedController', function (accounts) {

    describe('--TimeLockedController Tests--', function () {
        const [_, owner, oneHundred, otherAddress, mintKey, pauseKey, pauseKey2, approver1, approver2, approver3, spender] = accounts

        beforeEach(async function () {
            this.registry = await Registry.new({ from: owner })
            this.dateTime = await DateTimeMock.new({ from: owner })
            this.token = await TrueUSDMock.new(oneHundred, 100*10**18, { from: owner })
            this.globalPause = await GlobalPause.new({ from: owner })
            await this.token.setGlobalPause(this.globalPause.address, { from: owner })    
            this.controller = await TimeLockedController.new({ from: owner })
            this.fastPauseMints = await FastPauseMints.new({ from: owner })
            await this.fastPauseMints.setController(this.controller.address, { from: owner })
            await this.fastPauseMints.modifyPauseKey(pauseKey2, true, { from: owner })
            await this.controller.setRegistry(this.registry.address, { from: owner })
            await this.token.transferOwnership(this.controller.address, { from: owner })
            await this.controller.issueClaimOwnership(this.token.address, { from: owner })
            await this.controller.setTrueUSD(this.token.address, { from: owner })
            await this.controller.setTusdRegistry(this.registry.address, { from: owner })
            await this.controller.setDateTime(this.dateTime.address, { from: owner })
            await this.controller.transferMintKey(mintKey, { from: owner })
            this.balanceSheet = await this.token.balances()
            this.allowanceSheet = await this.token.allowances()
            this.delegateContract = await DelegateBurnableMock.new({ from: owner })
            this.faultyDelegateContract1 = await FaultyDelegateBurnableMock1.new({ from: owner })
            this.faultyDelegateContract2 = await FaultyDelegateBurnableMock2.new({ from: owner })
            await this.registry.setAttribute(oneHundred, "hasPassedKYC/AML", 1, "notes", { from: owner })
            await this.registry.setAttribute(approver1, "isTUSDMintApprover", 1, "notes", { from: owner })
            await this.registry.setAttribute(approver2, "isTUSDMintApprover", 1, "notes", { from: owner })
            await this.registry.setAttribute(approver3, "isTUSDMintApprover", 1, "notes", { from: owner })
            await this.registry.setAttribute(pauseKey, "isTUSDMintChecker", 1, "notes", { from: owner })
            await this.registry.setAttribute(this.fastPauseMints.address, "isTUSDMintChecker", 1, "notes", { from: owner })
            const time = Number(await this.controller.returnTime())
            const weekday = Number(await this.dateTime.getWeekday(time))
            if (weekday === 0 || weekday === 6 || weekday === 5){
                await increaseTime(duration.days(3))
            }

        })

        describe('Request and Finalize Mints', function () {

            beforeEach(async function () {
                await this.controller.setMintLimit(30*10**18, { from: owner })
                await this.controller.setSmallMintThreshold(11*10**18, { from: owner })
                await this.controller.setMinimalApprovals(2,3, { from: owner })
            })

            it('non mintKey/owner cannot request mint', async function () {
                await assertRevert(this.controller.requestMint(oneHundred, 10*10**18 , { from: otherAddress }))
            })

            it('request a mint', async function () {
                await this.controller.requestMint(oneHundred, 10*10**18 , { from: owner })
                const mintOperation = await this.controller.mintOperations(0)
                assert.equal(mintOperation[0], oneHundred)
                assert.equal(Number(mintOperation[1]), 10*10**18)
                assert.equal(Number(mintOperation[4]), 0,"numberOfApprovals not 0")
            })

            it('request mint then revoke it', async function () {
                await this.controller.requestMint(oneHundred, 10*10**18 , { from: mintKey })
                const { logs } = await this.controller.revokeMint(0, {from: mintKey})
                assert.equal(logs.length, 1)
                assert.equal(logs[0].event, 'RevokeMint')
                assert.equal(logs[0].args.opIndex, 0,"wrong opIndex")
                const mintOperation = await this.controller.mintOperations(0)
                assert.equal(mintOperation[0], "0x0000000000000000000000000000000000000000","to address not 0")
                assert.equal(Number(mintOperation[1]), 0,"value not 0")
                assert.equal(Number(mintOperation[3]), 0,"timeRequested not 0")
                assert.equal(Number(mintOperation[4]), 0,"numberOfApprovals not 0")
            })

  
            it('fails to mint when over the 24hour limit', async function () {
                 await this.controller.requestMint(oneHundred, 20*10**18 , { from: mintKey })
                 await assertRevert(this.controller.requestMint(oneHundred, 20*10**18 , { from: mintKey }))
            })

            it('manually reset 24hour limit', async function () {
                await this.controller.requestMint(oneHundred, 20*10**18 , { from: mintKey })
                await assertRevert(this.controller.requestMint(oneHundred, 20*10**18 , { from: mintKey }))
                await this.controller.resetMintedToday({ from: owner })
                await this.controller.requestMint(oneHundred, 20*10**18 , { from: mintKey })
            })

            it('reset 24hour limit after reset time', async function () {
                await this.controller.requestMint(oneHundred, 20*10**18 , { from: mintKey })
                await assertRevert(this.controller.requestMint(oneHundred, 20*10**18 , { from: mintKey }))
                await increaseTime(duration.hours(25))
                const time = Number(await this.controller.returnTime())
                const weekday = Number(await this.dateTime.getWeekday(time))
                if (weekday === 0 || weekday === 6){
                    await assertRevert(this.controller.requestMint(oneHundred, 20*10**18 , { from: mintKey }))
                } else {
                    await this.controller.requestMint(oneHundred, 20*10**18 , { from: mintKey })
                }
            })

            it('cannot mint on weekends', async function(){
                let time = Number(await this.controller.returnTime())
                let weekday = Number(await this.dateTime.getWeekday(time))
                if (weekday !== 0 && weekday !== 6){
                    let notOnWeekend = true
                    while (notOnWeekend){
                        await increaseTime(duration.days(1))
                        time = Number(await this.controller.returnTime())
                        weekday = Number(await this.dateTime.getWeekday(time))
                        if (weekday === 6){ notOnWeekend = false}
                    }
                }
                await assertRevert(this.controller.requestMint(oneHundred, 20*10**18 , { from: mintKey }))
                await increaseTime(duration.days(1))
                await assertRevert(this.controller.requestMint(oneHundred, 20*10**18 , { from: mintKey }))
                await increaseTime(duration.days(1))
                await this.controller.requestMint(oneHundred, 20*10**18 , { from: mintKey })
    
            })

            it('owner can mint on weekends', async function(){
                let time = Number(await this.controller.returnTime())
                let weekday = Number(await this.dateTime.getWeekday(time))
                if (weekday !== 0 && weekday !== 6){
                    let notOnWeekend = true
                    while (notOnWeekend){
                        await increaseTime(duration.days(1))
                        time = Number(await this.controller.returnTime())
                        weekday = Number(await this.dateTime.getWeekday(time))
                        if (weekday === 6){ notOnWeekend = false}
                    }
                }
                await this.controller.requestMint(oneHundred, 20*10**18 , { from: owner })
                await this.controller.finalizeMint(0 , { from: owner })
            })

            it('pause key sets today as holiday, but owner can still mint', async function () {
                const time = Number(await this.controller.returnTime()) + Number(await this.controller.timeZoneDiff())
                let today = new Date(time*1000)
                let day = today.getDate()
                let month = today.getMonth()+1 //January is 0!
                let year = today.getFullYear()
                await this.controller.addHoliday(year,month,day,{ from: pauseKey })
                await this.controller.requestMint(oneHundred, 10*10**18 , { from: owner })
            })



            it('fails to transfer mintkey to 0x0', async function () {
                await assertRevert(this.controller.transferMintKey("0x0000000000000000000000000000000000000000", { from: owner }))
            })


            it('non owner/mintkey cannot transfer mintkey', async function () {
                await assertRevert(this.controller.transferMintKey(oneHundred, { from: otherAddress }))
            })
        })

        describe('Emit Proper Event Logs', async function(){
            it("transfer mintkey should generate logs", async function(){
                const {logs} = await this.controller.transferMintKey(oneHundred, { from: owner })
                assert.equal(logs[0].event,"TransferMintKey");
                assert.equal(logs[0].args.previousMintKey,mintKey);
                assert.equal(logs[0].args.newMintKey,oneHundred);
            })

            it("pause mint should generate logs", async function(){
                const {logs} = await this.controller.pauseMints({ from: owner })
                assert.equal(logs[0].event,"AllMintsPaused");
                assert.equal(logs[0].args.status,true);
            })

            it("reseting mint limit should generate logs", async function(){
                const {logs} = await this.controller.resetMintedToday({ from: owner })
                assert.equal(logs[0].event,"MintLimitReset" )
                assert.equal(logs[0].args.sender, owner)
            })

            it("changing approval threshold should generate logs", async function(){
                const {logs} = await this.controller.setMinimalApprovals( 4, 5, { from: owner })
                assert.equal(logs[0].event,"ApprovalThresholdChanged" )
                assert.equal(Number(logs[0].args.smallMintApproval), 4)
                assert.equal(Number(logs[0].args.largeMintApproval), 5)
            })

            it("changing small mint threshold should generate logs", async function(){
                const {logs} = await this.controller.setSmallMintThreshold( 10, { from: owner })
                assert.equal(logs[0].event,"SmallMintThresholdChanged" )
                assert.equal(Number(logs[0].args.oldThreshold),0 )
                assert.equal(Number(logs[0].args.newThreshold), 10)
            })

            it("chaning daily mint limit should generate logs", async function(){
                const {logs} = await this.controller.setMintLimit( 10, { from: owner })
                assert.equal(logs[0].event,"DailyLimitChanged" )
                assert.equal(Number(logs[0].args.oldLimit), 0)
                assert.equal(Number(logs[0].args.newLimit), 10)
            })

            it("adding and removing holiday should generate logs", async function(){
                let {logs} = await this.controller.addHoliday(2018,1,1, { from: owner })
                assert.equal(logs[0].event,"HolidayModified" )
                assert.equal(Number(logs[0].args.year),2018 )
                assert.equal(Number(logs[0].args.month), 1)
                assert.equal(Number(logs[0].args.day), 1)
                assert.equal(logs[0].args.status, true)
                let receipt = await this.controller.removeHoliday(2018,1,1, { from: owner })
                logs = receipt["logs"]
                assert.equal(logs[0].event,"HolidayModified" )
                assert.equal(Number(logs[0].args.year),2018 )
                assert.equal(Number(logs[0].args.month), 1)
                assert.equal(Number(logs[0].args.day), 1)
                assert.equal(logs[0].args.status, false)
            })

            it("setting new date time contract should generate logs", async function(){
                const {logs} = await this.controller.setDateTime( oneHundred, { from: owner })
                assert.equal(logs[0].event,"DateTimeAddressSet" )
                assert.equal(logs[0].args.newDateTimeContract,oneHundred )
            })

            it("changing timezone should generate logs", async function(){
                const oldTimeZone = await this.controller.timeZoneDiff()
                const {logs} = await this.controller.setTimeZoneDiff( 8, { from: owner })
                assert.equal(logs[0].event,"TimeZoneChanged" )
                assert.equal(Number(logs[0].args.oldTimeZone), Number(oldTimeZone)/3600)
                assert.equal(Number(logs[0].args.newTimeZone),8)
            })

        })


        describe('Full mint process', function () {
            beforeEach(async function () {
                await this.controller.setMintLimit(100*10**18, { from: owner })
                await this.controller.setSmallMintThreshold(11*10**18, { from: owner })
                await this.controller.setMinimalApprovals(2,3, { from: owner })
            })

            it('have enought approvals for mints', async function(){
                let result = await this.controller.hasEnoughApproval(2,10*10**18)
                assert.equal(result,true)
                result = await this.controller.hasEnoughApproval(1,10*10**18)
                assert.equal(result,false)
                result = await this.controller.hasEnoughApproval(3,12*10**18)
                assert.equal(result,true)
                result = await this.controller.hasEnoughApproval(2,12*10**18)
                assert.equal(result,false)
            })

            it('owner can finalize before checktime/without approvals', async function(){
                await this.controller.requestMint(oneHundred, 10*10**18 , { from: mintKey })
                await this.controller.finalizeMint(0 , { from: owner })
            })


            it('cannot approve mint if not an approver', async function () {
                await this.controller.requestMint(oneHundred, 10*10**18 , { from: mintKey })
                await assertRevert(this.controller.approveMint(0 , { from: otherAddress }))
            })

            it('approve mint should generate logs', async function(){
                await this.controller.requestMint(oneHundred, 10*10**18 , { from: mintKey })
                const {logs} = await this.controller.approveMint(0 , { from: approver1 })
                assert.equal(logs[0].event,"MintApproved")
                assert.equal(logs[0].args.approver,approver1)
                assert.equal(Number(logs[0].args.opIndex),0)
            })
    
            it('cannot approve the same mint twice', async function () {
                await this.controller.requestMint(oneHundred, 10*10**18 , { from: mintKey })
                await this.controller.approveMint(0 , { from: approver1 })
                await assertRevert(this.controller.approveMint(0 , { from: approver1 }))
            })

            it('cannot request mint when mint paused', async function () {
                await this.controller.pauseMints({ from: pauseKey })
                await assertRevert(this.controller.requestMint(oneHundred, 10*10**18 , { from: mintKey }))
            })

            it('non pause key cannot pause mint', async function () {
                await assertRevert(this.controller.pauseMints({ from: otherAddress }))
            })

            it('pause key cannot unpause', async function () {
                await assertRevert(this.controller.unPauseMints({ from: pauseKey }))
            })

            it('owner pauses then unpause then mints', async function () {
                await this.controller.pauseMints({ from: owner })
                await this.controller.unPauseMints({ from: owner })
                await this.controller.requestMint(oneHundred, 10*10**18 , { from: mintKey })
            })

            it('pauseKey2 should be able to pause mints by sending in ether', async function(){
                await this.fastPauseMints.sendTransaction({from: pauseKey2, gas: 600000, value: 10});                  
                let paused = await this.controller.mintPaused()    
                assert.equal(paused, true)
                await assertRevert(this.controller.requestMint(oneHundred, 10*10**18 , { from: mintKey }))
                await assertRevert(this.fastPauseMints.sendTransaction({from: pauseKey, gas: 600000, value: 10}));                  
                await this.controller.unPauseMints({ from: owner })
                paused = await this.controller.mintPaused()  
                assert.equal(paused, false)  
                await this.fastPauseMints.modifyPauseKey(pauseKey2, false, { from: owner })
                await assertRevert(this.fastPauseMints.send(10, {from: pauseKey2}))
                await this.controller.requestMint(oneHundred, 10*10**18 , { from: mintKey })
            })


            it('pause key sets today as holiday, request mint fails', async function () {
                const time = Number(await this.controller.returnTime()) + Number(await this.controller.timeZoneDiff())
                let today = new Date(time*1000)
                let day = today.getDate()
                let month = today.getMonth()+1 //January is 0!
                let year = today.getFullYear()
                await this.controller.addHoliday(year,month,day,{ from: pauseKey })
                await assertRevert(this.controller.requestMint(oneHundred, 10*10**18 , { from: mintKey }))
            })


            it('pauseKey cannot remove holiday', async function () {
                let time = Number(await this.controller.returnTime()) + Number(await this.controller.timeZoneDiff())
                let today = new Date(time*1000)
                let day = today.getDate()
                let month = today.getMonth()+1 //January is 0!
                let year = today.getFullYear()

                await this.controller.addHoliday(year,month,day,{ from: pauseKey })
                await assertRevert(this.controller.removeHoliday(year,month,day,{ from: pauseKey }))
                this.controller.removeHoliday(year,month,day,{ from: owner })
            })

            it('cannot finalize without enough approvers', async function () {
                let time = Number(await this.controller.returnTime())
                let blockchainHour = Number(await this.dateTime.getHour(time))

                while (blockchainHour !== 8){
                    await increaseTime(duration.hours(1))
                    time = Number(await this.controller.returnTime()) 
                    blockchainHour = Number(await this.dateTime.getHour(time))
                }
                await this.controller.requestMint(oneHundred, 10*10**18 , { from: mintKey })
                await this.controller.approveMint(0 , { from: approver1 })
                await increaseTime(duration.hours(5))
                await assertRevert(this.controller.finalizeMint(0 , { from: mintKey }))
            })

            it('cannot finalize a large amount without enough approvers', async function(){
                let time = Number(await this.controller.returnTime())
                let blockchainHour = Number(await this.dateTime.getHour(time))

                while (blockchainHour !== 8){
                    await increaseTime(duration.hours(1))
                    time = Number(await this.controller.returnTime()) 
                    blockchainHour = Number(await this.dateTime.getHour(time))
                }
                await this.controller.requestMint(oneHundred, 30*10**18 , { from: mintKey })
                await this.controller.approveMint(0 , { from: approver1 })
                await this.controller.approveMint(0 , { from: approver2 })
                await increaseTime(duration.hours(5))
                await assertRevert(this.controller.finalizeMint(0 , { from: mintKey }))
            })       

            it('finalize a large amount', async function(){
                let time = Number(await this.controller.returnTime())
                let blockchainHour = Number(await this.dateTime.getHour(time))

                while (blockchainHour !== 8){
                    await increaseTime(duration.hours(1))
                    time = Number(await this.controller.returnTime()) 
                    blockchainHour = Number(await this.dateTime.getHour(time))
                }

                await this.controller.requestMint(oneHundred, 30*10**18 , { from: mintKey })
                await this.controller.approveMint(0 , { from: approver1 })
                await this.controller.approveMint(0 , { from: approver2 })
                await this.controller.approveMint(0 , { from: approver3 })
                await increaseTime(duration.hours(5))                


                const {logs}= await this.controller.finalizeMint(0 , { from: mintKey })
                assert.equal(logs[0].event,"FinalizeMint")
                assert.equal(logs[0].args.to,oneHundred)
                assert.equal(logs[0].args.mintKey,mintKey)
                assert.equal(Number(logs[0].args.value),30*10**18)
                assert.equal(Number(logs[0].args.opIndex),0)
            })

            it('pause key can pause specific mint', async function(){
                let time = Number(await this.controller.returnTime())
                let blockchainHour = Number(await this.dateTime.getHour(time))

                while (blockchainHour !== 8){
                    await increaseTime(duration.hours(1))
                    time = Number(await this.controller.returnTime()) 
                    blockchainHour = Number(await this.dateTime.getHour(time))
                }

                await this.controller.requestMint(oneHundred, 10*10**18 , { from: mintKey })
                await this.controller.approveMint(0 , { from: approver1 })
                await this.controller.approveMint(0 , { from: approver2 })
                await this.controller.approveMint(0 , { from: approver3 })
                await increaseTime(duration.hours(5))
                let {logs}= await this.controller.pauseMint(0 , { from: pauseKey })
                assert.equal(logs[0].event,"MintPaused")
                assert.equal(Number(logs[0].args.opIndex),0)
                assert.equal(logs[0].args.status,true)
                await assertRevert(this.controller.finalizeMint(0 , { from: mintKey }))
                await assertRevert(this.controller.unpauseMint(0 , { from: pauseKey }))
                let receipt = await this.controller.unpauseMint(0 , { from: owner })
                logs = receipt["logs"]
                assert.equal(logs[0].event,"MintPaused")
                assert.equal(Number(logs[0].args.opIndex),0)
                assert.equal(logs[0].args.status,false)
                await this.controller.finalizeMint(0 , { from: mintKey })
            })

            it('cannot finalize after all request invalidated', async function(){
                let time = Number(await this.controller.returnTime())
                let blockchainHour = Number(await this.dateTime.getHour(time))

                while (blockchainHour !== 8){
                    await increaseTime(duration.hours(1))
                    time = Number(await this.controller.returnTime()) 
                    blockchainHour = Number(await this.dateTime.getHour(time))
                }
                await this.controller.requestMint(oneHundred, 10*10**18 , { from: mintKey })
                await this.controller.requestMint(oneHundred, 20*10**18 , { from: mintKey })
                await this.controller.approveMint(0 , { from: approver1 })
                await this.controller.approveMint(0 , { from: approver2 })
                await this.controller.approveMint(0 , { from: approver3 })
                await this.controller.approveMint(1 , { from: approver1 })
                await this.controller.approveMint(1 , { from: approver2 })
                await this.controller.approveMint(1 , { from: approver3 })
                await this.controller.invalidateAllPendingMints({from: owner})
                await increaseTime(duration.hours(5))
                await assertRevert(this.controller.finalizeMint(0 , { from: mintKey }))
            })


            it('does the entire mint process', async function () {
                let time = Number(await this.controller.returnTime())
                let blockchainHour = Number(await this.dateTime.getHour(time))

                const kycStatus = await this.registry.hasAttribute(oneHundred, "hasPassedKYC/AML")
                assert.equal(kycStatus,true,"failed to set kycAML status to true")
                while (blockchainHour !== 8){
                    await increaseTime(duration.hours(1))
                    time = Number(await this.controller.returnTime()) 
                    blockchainHour = Number(await this.dateTime.getHour(time))
                }

                await this.controller.requestMint(oneHundred, 10*10**18 , { from: mintKey })                
                await this.controller.approveMint(0 , { from: approver1 })
                await this.controller.approveMint(0 , { from: approver2 })
                const mintOperation = await this.controller.mintOperations(0)
                assert.equal(Number(mintOperation[4]), 2,"numberOfApprovals != 2")
                assert.equal(Number(mintOperation[1]), 10*10**18,"wrong mint amount")
                await increaseTime(duration.hours(5))
                await this.controller.finalizeMint(0 , { from: mintKey })

            })
            it('cannot finalize right after request', async function () {
                await this.controller.requestMint(oneHundred, 10*10**18 , { from: mintKey })                
                await this.controller.approveMint(0 , { from: approver1 })
                await this.controller.approveMint(0 , { from: approver2 })
                await assertRevert(this.controller.finalizeMint(0 , { from: mintKey }))
            })


            it('always able to finalize mint from a day ago', async function () {
                let time = Number(await this.controller.returnTime())
                let blockchainHour = Number(await this.dateTime.getHour(time))
                while (blockchainHour !== 10){
                    await increaseTime(duration.hours(1))
                    time = Number(await this.controller.returnTime())
                    blockchainHour = Number(await this.dateTime.getHour(time))
                }


                time = Number(await this.controller.returnTime())
                let blockchainYear = Number(await this.dateTime.getYear(time))
                let blockchainMonth = Number(await this.dateTime.getMonth(time))
                let blockchainDay = Number(await this.dateTime.getDay(time))
                let timeDifference = 8 //hours because at this point the blockchain date is past nov 5th. which is post daylight saving
                let requestEpochTime = new Date(blockchainYear,blockchainMonth-1,blockchainDay-1,9-timeDifference,29).getTime()/1000
                let result = await this.controller.enoughTimePassed(requestEpochTime)
                assert.equal(result, true)
                requestEpochTime = new Date(blockchainYear,blockchainMonth-1,blockchainDay-1,10-timeDifference,32).getTime()/1000
                result = await this.controller.enoughTimePassed(requestEpochTime)
                assert.equal(result, true)
                requestEpochTime = new Date(blockchainYear,blockchainMonth-1,blockchainDay-1,15-timeDifference,28).getTime()/1000
                result = await this.controller.enoughTimePassed(requestEpochTime)
                assert.equal(result, true)
                requestEpochTime = new Date(blockchainYear,blockchainMonth-1,blockchainDay-1,15-timeDifference,35).getTime()/1000
                result = await this.controller.enoughTimePassed(requestEpochTime)
                assert.equal(result, false)
                requestEpochTime = new Date(blockchainYear,blockchainMonth-1,blockchainDay-1,21-timeDifference,34).getTime()/1000
                result = await this.controller.enoughTimePassed(requestEpochTime)
                assert.equal(result, false)
            })

            it ('enoughTimePassed behaves properly', async function(){
                let time = Number(await this.controller.returnTime())
                let blockchainHour = Number(await this.dateTime.getHour(time))
                while (blockchainHour !== 13){
                    await increaseTime(duration.hours(1))
                    time = Number(await this.controller.returnTime())
                    blockchainHour = Number(await this.dateTime.getHour(time))
                }

                time = Number(await this.controller.returnTime())
                let blockchainYear = Number(await this.dateTime.getYear(time))
                let blockchainMonth = Number(await this.dateTime.getMonth(time))
                let blockchainDay = Number(await this.dateTime.getDay(time))
                let timeDifference = 8 //hours because at this point the blockchain date is past nov 5th. which is post daylight saving

                let requestEpochTime = new Date(blockchainYear,blockchainMonth-1,blockchainDay,15-timeDifference,28).getTime()/1000
                let result = await this.controller.enoughTimePassed(requestEpochTime)
                assert.equal(result, false)
                requestEpochTime = new Date(blockchainYear,blockchainMonth-1,blockchainDay,9-timeDifference,28).getTime()/1000
                result = await this.controller.enoughTimePassed(requestEpochTime)
                assert.equal(result, true)
                requestEpochTime = new Date(blockchainYear,blockchainMonth-1,blockchainDay,9-timeDifference,45).getTime()/1000
                result = await this.controller.enoughTimePassed(requestEpochTime)
                assert.equal(result, false)

                while (blockchainHour !== 18){
                    await increaseTime(duration.hours(1))
                    time = Number(await this.controller.returnTime())
                    blockchainHour = Number(await this.dateTime.getHour(time))
                }

                requestEpochTime = new Date(blockchainYear,blockchainMonth-1,blockchainDay,9-timeDifference,45).getTime()/1000
                result = await this.controller.enoughTimePassed(requestEpochTime)
                assert.equal(result, true)
                requestEpochTime = new Date(blockchainYear,blockchainMonth-1,blockchainDay,15-timeDifference,28).getTime()/1000
                result = await this.controller.enoughTimePassed(requestEpochTime)
                assert.equal(result, true)
                requestEpochTime = new Date(blockchainYear,blockchainMonth-1,blockchainDay,15-timeDifference,35).getTime()/1000
                result = await this.controller.enoughTimePassed(requestEpochTime)
                assert.equal(result, false)
                requestEpochTime = new Date(blockchainYear,blockchainMonth-1,blockchainDay,16-timeDifference,35).getTime()/1000
                result = await this.controller.enoughTimePassed(requestEpochTime)
                assert.equal(result, false)
            })

            it('does the entire mint process finalize within the day', async function () {
                let time = Number(await this.controller.returnTime()) 
                //increase time until time equals 9:20
                let blockchainHour = Number(await this.dateTime.getHour(time))
                let blockchainMinute = Number(await this.dateTime.getMinute(time))
                while (blockchainMinute !== 20){
                    await increaseTime(duration.minutes(1))
                    time = Number(await this.controller.returnTime())
                    blockchainMinute = Number(await this.dateTime.getMinute(time))
                }

                while (blockchainHour !== 9){
                    await increaseTime(duration.hours(1))
                    time = Number(await this.controller.returnTime()) 
                    blockchainHour = Number(await this.dateTime.getHour(time))
                }
                await this.controller.requestMint(oneHundred, 10*10**18 , { from: mintKey })   
                await this.controller.approveMint(0 , { from: approver1 })
                await this.controller.approveMint(0 , { from: approver2 })
                await increaseTime(duration.hours(3))

                await this.controller.finalizeMint(0 , { from: mintKey })
            })

            it('mint fails if not enough time for checker to pause', async function () {
                let time = Number(await this.controller.returnTime()) 
                //increase time until time equals 9:23
                let blockchainHour = Number(await this.dateTime.getHour(time))
                let blockchainMinute = Number(await this.dateTime.getMinute(time))
                while (blockchainMinute !== 23){
                    await increaseTime(duration.minutes(1))
                    time = Number(await this.controller.returnTime())
                    blockchainMinute = Number(await this.dateTime.getMinute(time))
                }

                while (blockchainHour !== 9){
                    await increaseTime(duration.hours(1))
                    time = Number(await this.controller.returnTime())
                    blockchainHour = Number(await this.dateTime.getHour(time))
                }
                time = Number(await this.controller.returnTime())
                blockchainHour = Number(await this.dateTime.getHour(time))
                blockchainMinute = Number(await this.dateTime.getMinute(time))
                await this.controller.requestMint(oneHundred, 10*10**18 , { from: mintKey })   
                await this.controller.approveMint(0 , { from: approver1 })
                await this.controller.approveMint(0 , { from: approver2 })
                await increaseTime(duration.hours(1))
                await assertRevert(this.controller.finalizeMint(0 , { from: mintKey }))
            })

            it('mint fails if the request mint is within 30 mins before checktime', async function () {
                let time = Number(await this.controller.returnTime()) 
                //increase time until time equals 9:40
                let blockchainMinute = Number(await this.dateTime.getMinute(time))
                while (blockchainMinute !== 40){
                    await increaseTime(duration.minutes(1))
                    time = Number(await this.controller.returnTime())
                    blockchainMinute = Number(await this.dateTime.getMinute(time))
                }

                time = Number(await this.controller.returnTime()) 
                let blockchainHour = Number(await this.dateTime.getHour(time))
                while (blockchainHour !== 9){
                    await increaseTime(duration.hours(1))
                    time = Number(await this.controller.returnTime())
                    blockchainHour = Number(await this.dateTime.getHour(time))
                }

                await this.controller.requestMint(oneHundred, 10*10**18 , { from: mintKey })   
                await this.controller.approveMint(0 , { from: approver1 })
                await this.controller.approveMint(0 , { from: approver2 })
                await increaseTime(duration.hours(1))
                await assertRevert(this.controller.finalizeMint(0 , { from: mintKey }))
            })

            it('mint process after timezone shift', async function(){
                await this.controller.setTimeZoneDiff(8, { from: owner })
                let time = Number(await this.controller.returnTime()) 
                //increase time until time equals 9:20
                let blockchainMinute = Number(await this.dateTime.getMinute(time))
                while (blockchainMinute !== 20){
                    await increaseTime(duration.minutes(1))
                    time = Number(await this.controller.returnTime())
                    blockchainMinute = Number(await this.dateTime.getMinute(time))
                }

                time = Number(await this.controller.returnTime()) 
                let blockchainHour = Number(await this.dateTime.getHour(time))
                while (blockchainHour !== 9){
                    await increaseTime(duration.hours(1))
                    time = Number(await this.controller.returnTime()) 
                    blockchainHour = Number(await this.dateTime.getHour(time))
                }
                await this.controller.requestMint(oneHundred, 10*10**18 , { from: mintKey })
                await this.controller.approveMint(0 , { from: approver1 })
                await this.controller.approveMint(0 , { from: approver2 })

                await increaseTime(duration.hours(3))
                await this.controller.finalizeMint(0 , { from: mintKey })

            })
        })

        describe('setDelegatedFrom', function () {
            it('sets delegatedFrom', async function () {
                await this.controller.setDelegatedFrom(oneHundred, { from: owner })

                const addr = await this.token.delegatedFrom()
                assert.equal(addr, oneHundred)
            })

            it('cannot be called by non-owner', async function () {
                await assertRevert(this.controller.setDelegatedFrom(oneHundred, { from: otherAddress }))
            })
        })

        describe('changeTokenName', function () {
            it('sets the token name', async function () {
                await this.controller.changeTokenName("FooCoin", "FCN", { from: owner })

                const name = await this.token.name()
                assert.equal(name, "FooCoin")
                const symbol = await this.token.symbol()
                assert.equal(symbol, "FCN")
            })

            it('cannot be called by non-owner', async function () {
                await assertRevert(this.controller.changeTokenName("FooCoin", "FCN", { from: otherAddress }))
            })
        })

        describe('setBurnBounds', function () {
            it('sets burnBounds', async function () {
                await this.controller.setBurnBounds(3*10**18, 4*10**18, { from: owner })

                const min = await this.token.burnMin()
                assert.equal(min, 3*10**18)
                const max = await this.token.burnMax()
                assert.equal(max, 4*10**18)
            })

            it('cannot be called by non Owner', async function () {
                await assertRevert(this.controller.setBurnBounds(3*10**18, 4*10**18, { from: otherAddress }))
            })

            it('cannot be called by non Owner', async function () {
                await assertRevert(this.controller.setBurnBounds(3*10**18, 4*10**18, { from: otherAddress }))
            })
        })

        describe('changeStaker', function () {
            it('sets staker', async function () {
                await this.controller.changeStaker(oneHundred, { from: owner })

                const staker = await this.token.staker()
                assert.equal(staker, oneHundred)
            })

            it('cannot be called by non-owner', async function () {
                await assertRevert(this.controller.changeStaker(oneHundred, { from: otherAddress }))
            })
        })

        describe('delegateToNewContract', function () {
            it('sets delegate', async function () {
                await this.controller.delegateToNewContract(this.delegateContract.address,
                                                            this.balanceSheet,
                                                            this.allowanceSheet, { from: owner })
                const delegate = await this.token.delegate()

                assert.equal(delegate, this.delegateContract.address)
                let balanceOwner = await BalanceSheet.at(this.balanceSheet).owner()
                let allowanceOwner = await AllowanceSheet.at(this.allowanceSheet).owner()


                assert.equal(balanceOwner, this.delegateContract.address)
                assert.equal(allowanceOwner, this.delegateContract.address)

            })

            it('cannot be called by non-owner', async function () {
                await assertRevert(this.controller.delegateToNewContract(this.delegateContract.address,
                                                            this.balanceSheet,
                                                            this.allowanceSheet, { from: otherAddress }))
            })

            it('cannot set delegate with balancesheet is not owned', async function () {
                let balanceSheetAddr = "0x123"
                let allowanceSheetAddr = "0x234"
                await assertRevert(this.controller.delegateToNewContract(this.delegateContract.address,
                                                            balanceSheetAddr,
                                                            allowanceSheetAddr, { from: owner }))
            })

            it('fails when new delegate contract doesnt implement setBalanceSheet() ', async function () {
                await assertRevert(this.controller.delegateToNewContract(this.faultyDelegateContract1.address,
                                                            this.balanceSheet,
                                                            this.allowanceSheet, { from: owner }))
            })

            it('fails when new delegate contract doesnt implement setAllowanceSheet() ', async function () {
                await assertRevert(this.controller.delegateToNewContract(this.faultyDelegateContract2.address,
                                                            this.balanceSheet,
                                                            this.allowanceSheet, { from: owner }))
            })
        })

        describe('pause trueUSD and wipe accounts', function(){
            beforeEach(async function(){
                this.fastPauseTrueUSD = await FastPauseTrueUSD.new(pauseKey, this.controller.address, { from: owner })
                await this.controller.setTrueUsdFastPause(this.fastPauseTrueUSD.address, { from: owner })
            })

            it('timeLockControler can pause TrueUSD transfers', async function(){
                await this.token.transfer(mintKey, 10*10**18, { from: oneHundred })
                await this.controller.pauseTrueUSD({ from: owner })
                await assertRevert(this.token.transfer(mintKey, 40*10**18, { from: oneHundred }))
            })

            it('timeLockControler can unpause TrueUSD transfers', async function(){
                await this.controller.pauseTrueUSD({ from: owner })
                await assertRevert(this.token.transfer(mintKey, 40*10**18, { from: oneHundred }))
                await this.controller.unpauseTrueUSD({ from: owner })
                await this.token.transfer(mintKey, 40*10**18, { from: oneHundred })
            })

            it('trueUsdPauser can pause TrueUSD by sending ether to fastPause contract', async function(){
                await this.fastPauseTrueUSD.sendTransaction({from: pauseKey, gas: 600000, value: 10});                  
                const paused = await this.token.paused();
                assert.equal(paused, true)               
            })

            it('non pauser cannot pause TrueUSD ', async function(){
                await assertRevert(this.controller.pauseTrueUSD({ from: mintKey }));                  
            })

            it('non pauser cannot pause TrueUSD by sending ether to fastPause contract', async function(){
                await assertRevert(this.fastPauseTrueUSD.sendTransaction({from: pauseKey2, gas: 600000, value: 10}));                  
            })

            it('timeLockControler can wipe blacklisted account', async function(){
                await this.token.transfer(this.token.address, 40*10**18, { from: oneHundred })
                await assertBalance(this.token, this.token.address, 40000000000000000000)
                await this.registry.setAttribute(this.token.address, "isBlacklisted", 1, "notes", { from: owner })
                await this.controller.wipeBlackListedTrueUSD(this.token.address, { from: owner })
                await assertBalance(this.token, this.token.address, 0)
            })

            it('timeLockController can set GlobalPause', async function(){
                this.globalPause = await GlobalPause.new({ from: owner })
                await this.globalPause.pauseAllTokens(true, { from: owner })
                await this.controller.setGlobalPause(this.globalPause.address, { from: owner })
                await assertRevert(this.token.transfer(mintKey, 40*10**18, { from: oneHundred }))
                await this.globalPause.pauseAllTokens(false, { from: owner })
                await this.token.transfer(mintKey, 40*10**18, { from: oneHundred })
                await this.globalPause.updateForkStatus(false, { from: owner })
                await assertRevert(this.token.transfer(mintKey, 40*10**18, { from: oneHundred }))
                await this.globalPause.updateForkStatus(true, { from: owner })
                await this.token.transfer(mintKey, 40*10**18, { from: oneHundred })
            })
        })


        describe('requestReclaimContract', function () {
            it('reclaims the contract', async function () {
                const balances = await this.token.balances()
                let balanceOwner = await BalanceSheet.at(balances).owner()
                assert.equal(balanceOwner, this.token.address)

                await this.controller.requestReclaimContract(balances, { from: owner })
                await this.controller.issueClaimOwnership(balances, { from: owner })
                balanceOwner = await BalanceSheet.at(balances).owner()
                assert.equal(balanceOwner, this.controller.address)
            })

            it('emits an event', async function () {
                const balances = await this.token.balances()
                const { logs } = await this.controller.requestReclaimContract(balances, { from: owner })

                assert.equal(logs.length, 1)
                assert.equal(logs[0].event, 'RequestReclaimContract')
                assert.equal(logs[0].args.other, balances)
            })

            it('cannot be called by non-owner', async function () {
                const balances = await this.token.balances()
                await assertRevert(this.controller.requestReclaimContract(balances, { from: mintKey }))
            })
        })

        describe('requestReclaimEther', function () {
            it('reclaims ether', async function () {
                const forceEther = await ForceEther.new({ from: oneHundred, value: "10000000000000000000" })
                await forceEther.destroyAndSend(this.token.address)
                const balance1 = web3.fromWei(web3.eth.getBalance(owner), 'ether').toNumber()
                await this.controller.requestReclaimEther({ from: owner })
                const balance2 = web3.fromWei(web3.eth.getBalance(owner), 'ether').toNumber()
                assert.isAbove(balance2, balance1)
            })

            it('cannot be called by non-owner', async function () {
                const forceEther = await ForceEther.new({ from: oneHundred, value: "10000000000000000000" })
                await forceEther.destroyAndSend(this.token.address)
                await assertRevert(this.controller.requestReclaimEther({ from: otherAddress }))
            })
        })

        describe('requestReclaimToken', function () {
            it('reclaims token', async function () {
                await this.token.transfer(this.token.address, 40*10**18, { from: oneHundred })
                await this.controller.requestReclaimToken(this.token.address, { from: owner })
                await assertBalance(this.token, owner, 40*10**18)
            })

            it('cannot be called by non-owner', async function () {
                await this.token.transfer(this.token.address, 40*10**18, { from: oneHundred })
                await assertRevert(this.controller.requestReclaimToken(this.token.address, { from: otherAddress }))
            })
        })

        describe('Staking Fees', function () {
            it('changes fees', async function () {
                await this.controller.changeStakingFees(1, 2, 3, 4, 5, 6, 7, 8, { from: owner })
                const transferFeeNumerator = await this.token.transferFeeNumerator()
                assert.equal(transferFeeNumerator, 1)
                const transferFeeDenominator = await this.token.transferFeeDenominator()
                assert.equal(transferFeeDenominator, 2)
                const mintFeeNumerator = await this.token.mintFeeNumerator()
                assert.equal(mintFeeNumerator, 3)
                const mintFeeDenominator = await this.token.mintFeeDenominator()
                assert.equal(mintFeeDenominator, 4)
                const mintFeeFlat = await this.token.mintFeeFlat()
                assert.equal(mintFeeFlat, 5)
                const burnFeeNumerator = await this.token.burnFeeNumerator()
                assert.equal(burnFeeNumerator, 6)
                const burnFeeDenominator = await this.token.burnFeeDenominator()
                assert.equal(burnFeeDenominator, 7)
                const burnFeeFlat = await this.token.burnFeeFlat()
                assert.equal(burnFeeFlat, 8)
            })

            it('cannot be called by non-owner', async function () {
                await assertRevert(this.controller.changeStakingFees(1, 2, 3, 4, 5, 6, 7, 8, { from: otherAddress }))
            })
        })



        describe('Full delegation process', function () {
            beforeEach(async function () {
                this.newToken = await TrueUSD.new({ from: owner })
                await this.newToken.setDelegatedFrom(this.token.address, { from: owner })
                await this.newToken.setTotalSupply(100*10**18, { from: owner })
                await assertRevert(this.newToken.setTotalSupply(10*10**18, { from: owner }))
                await this.newToken.setBurnBounds(10*10**18, 20*10**18, { from: owner })
                await this.newToken.setGlobalPause(this.globalPause.address, { from: owner })    
                await this.newToken.transferOwnership(this.controller.address, { from: owner })
                await this.controller.issueClaimOwnership(this.newToken.address, { from: owner })
                await this.controller.delegateToNewContract(this.newToken.address,
                    this.balanceSheet,
                    this.allowanceSheet, { from: owner })
                await this.controller.setTrueUSD(this.newToken.address, { from: owner })
                await this.controller.setTusdRegistry(this.registry.address, { from: owner })  
                await this.controller.changeStakingFees(0, 1, 0, 1, 0, 0, 1, 0, { from: owner })
  
            })

            describe('Base contract behaves well', function () {
                it('delegation set properly', async function(){
                    assert.equal(await this.token.delegate(),this.newToken.address)
                    assert.equal(await this.token.eventDelegateor(),this.newToken.address)
                    assert.equal(await this.newToken.eventDelegateor(),this.token.address)
                    assert.equal(await this.newToken.delegatedFrom(),this.token.address)
                })

                it('checks for totalSupply', async function(){
                    const totalSupply = await this.token.totalSupply()
                    assert.equal(Number(totalSupply),100000000000000000000)
                })

                it('transfer token from one account to another', async function(){
                    assertBalance(this.token, oneHundred, 100*10**18)
                    await this.token.transfer(otherAddress, 10*10**18, { from: oneHundred }) 
                    assertBalance(this.token, otherAddress, 10*10**18)
                })

                it('transferFrom token from one account to another', async function(){
                    await this.token.approve(spender, 10*10**18, { from: oneHundred })
                    const allowance = await this.token.allowance(oneHundred, spender)
                    assert.equal(Number(allowance),10*10**18)
                    await this.token.transferFrom(oneHundred, otherAddress, 10*10**18, { from: spender })
                    assertBalance(this.token, otherAddress, 10*10**18)
                })

                it('burns from an account', async function(){
                    await this.registry.setAttribute(oneHundred, "canBurn", 1, "notes", { from: owner })
                    await this.token.burn(10*10**18, "burn", { from: oneHundred })
                    assertBalance(this.token, oneHundred, 90*10**18)
                })

                it('increaseApproval and decreaseApproval of an address', async function(){
                    await this.token.increaseApproval(spender, 10*10**18, { from: oneHundred })
                    let allowance = await this.token.allowance(oneHundred, spender)
                    assert.equal(Number(allowance),10*10**18)
                    await this.token.decreaseApproval(spender, 10*10**18, { from: oneHundred })
                    allowance = await this.token.allowance(oneHundred, spender)
                    assert.equal(Number(allowance),0)
                })
            })
            describe('New contract behaves well', function () {
                it('cannot set totalsupply again', async function(){
                    await assertRevert(this.newToken.setTotalSupply(10, { from: owner }))
                })

                it('checks for totalSupply', async function(){
                    const totalSupply = await this.newToken.totalSupply()
                    assert.equal(Number(totalSupply),100*10**18)
                })

                it('transfer token from one account to another', async function(){
                    assertBalance(this.newToken, oneHundred, 100*10**18)
                    await this.token.transfer(otherAddress, 10*10**18, { from: oneHundred }) 
                    assertBalance(this.newToken, otherAddress, 10*10**18)
                })

                it('transferFrom token from one account to another', async function(){
                    await this.newToken.approve(spender, 10*10**18, { from: oneHundred })
                    const allowance = await this.newToken.allowance(oneHundred, spender)
                    assert.equal(Number(allowance),10*10**18)
                    await this.newToken.transferFrom(oneHundred, otherAddress, 10*10**18, { from: spender })
                    assertBalance(this.newToken, otherAddress, 10*10**18)
                })

                it('burns from an account', async function(){
                    await this.registry.setAttribute(oneHundred, "canBurn", 1, "notes", { from: owner })
                    await this.newToken.burn(10*10**18, "burn", { from: oneHundred })
                    assertBalance(this.newToken, oneHundred, 90*10**18)
                })

                it('increaseApproval and decreaseApproval of an address', async function(){
                    await this.newToken.increaseApproval(spender, 10*10**18, { from: oneHundred })
                    let allowance = await this.newToken.allowance(oneHundred, spender)
                    assert.equal(Number(allowance),10*10**18)
                    await this.newToken.decreaseApproval(spender, 10*10**18, { from: oneHundred })
                    allowance = await this.newToken.allowance(oneHundred, spender)
                    assert.equal(Number(allowance),0)
                })

            })
        })
    })

})
