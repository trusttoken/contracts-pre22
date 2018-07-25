import assertRevert from './helpers/assertRevert'
import expectThrow from './helpers/expectThrow'
import assertBalance from './helpers/assertBalance'
import increaseTime, { duration } from './helpers/increaseTime'
import { throws } from 'assert';
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

contract('TimeLockedController', function (accounts) {

    describe('--TimeLockedController Tests--', function () {
        const [_, owner, oneHundred, mintKey, pauseKey, approver1, approver2, approver3] = accounts

        beforeEach(async function () {
            this.registry = await Registry.new({ from: owner })
            this.dateTime = await DateTimeMock.new({ from: owner })
            this.token = await TrueUSDMock.new(oneHundred, 100*10**18, { from: owner })
            await this.token.setRegistry(this.registry.address, { from: owner })
            this.controller = await TimeLockedController.new({ from: owner })
            await this.controller.setRegistry(this.registry.address, { from: owner })
            await this.controller.setRegistry(this.registry.address, { from: owner })
            // await this.registry.transferOwnership(this.controller.address, { from: owner })
            await this.token.transferOwnership(this.controller.address, { from: owner })
            // await this.controller.issueClaimOwnership(this.registry.address, { from: owner })
            await this.controller.issueClaimOwnership(this.token.address, { from: owner })
            await this.controller.setTrueUSD(this.token.address, { from: owner })
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
            const time = Number(await this.controller.returnTime())
            const weekday = Number(await this.dateTime.getWeekday(time))
            if (weekday === 0 || weekday === 6 || weekday === 5){
                console.log("weekday: ", weekday)
                await increaseTime(duration.days(3))
            }

        })

        describe('add and remove MintCheckTime', function () {
            it('add mint checktime', async function () {
                await this.controller.addMintCheckTime(12,0, { from: owner })
                const numberOfCheckTimes = await this.controller.numberOfCheckTimes()
                const firstCheckTime = await this.controller.mintCheckTimes(0)
                assert.equal(Number(numberOfCheckTimes), 1)
                assert.equal(Number(firstCheckTime[0]), 12)
                assert.equal(Number(firstCheckTime[1]), 0)
            })

            it('emits an event', async function () {
                const { logs } = await this.controller.addMintCheckTime(11,0, { from: owner })

                assert.equal(logs.length, 1)
                assert.equal(logs[0].event, 'AddMintCheckTime')
                assert.equal(Number(logs[0].args.hour), 11)
                assert.equal(Number(logs[0].args.minute), 0)
            })

            it('cannot be called by non-owner', async function () {
                await assertRevert(this.controller.addMintCheckTime(11,0, { from: pauseKey }))
            })

            it('adds two mint checktimes and remove one', async function () {
                await this.controller.addMintCheckTime(13,0, { from: owner })
                await this.controller.addMintCheckTime(14,0, { from: owner })
                var numberOfCheckTimes = await this.controller.numberOfCheckTimes()
                assert.equal(Number(numberOfCheckTimes), 2)
                await this.controller.removeMintCheckTime(0, { from: owner })
                numberOfCheckTimes = await this.controller.numberOfCheckTimes()
                assert.equal(Number(numberOfCheckTimes), 1)
            })

            it('remove mint check time thats out of range', async function () {
                await this.controller.addMintCheckTime(8,0, { from: owner })
                await this.controller.addMintCheckTime(15,0, { from: owner })
                await this.controller.addMintCheckTime(20,0, { from: owner })
                //how do i know that it returned false here
                await this.controller.removeMintCheckTime(3, { from: owner })
                await this.controller.removeMintCheckTime(1, { from: owner })
                await this.controller.removeMintCheckTime(2, { from: owner })
            })

        })

        describe('Request and Finalize Mints', function () {

            beforeEach(async function () {
                await this.controller.setMintLimit(30*10**18, { from: owner })
                await this.controller.setSmallMintThreshold(11*10**18, { from: owner })
                await this.controller.setMinimalApprovals(2,3, { from: owner })
            })

            it('non mintKey/owner cannot request mint', async function () {
                await assertRevert(this.controller.requestMint(oneHundred, 10*10**18 , { from: pauseKey }))
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
                var time = Number(await this.controller.returnTime())
                var weekday = Number(await this.dateTime.getWeekday(time))
                if (weekday == 0 || weekday == 6){
                    await assertRevert(this.controller.requestMint(oneHundred, 20*10**18 , { from: mintKey }))
                } else{
                    await this.controller.requestMint(oneHundred, 20*10**18 , { from: mintKey })
                }
            })

            it('cannot mint on weekends', async function(){
                var time = Number(await this.controller.returnTime())
                var weekday = Number(await this.dateTime.getWeekday(time))
                if (weekday !== 0 && weekday !== 6){
                    let notOnWeekend = true;
                    while (notOnWeekend){
                        await increaseTime(duration.days(1))
                        time = Number(await this.controller.returnTime())
                        weekday = Number(await this.dateTime.getWeekday(time))
                        console.log("weekday: ", weekday)
                        if (weekday === 6){ notOnWeekend = false}
                    }
                }
                await assertRevert(this.controller.requestMint(oneHundred, 20*10**18 , { from: mintKey }))
                await increaseTime(duration.days(1))
                await assertRevert(this.controller.requestMint(oneHundred, 20*10**18 , { from: mintKey }))
                await increaseTime(duration.days(1))
                await this.controller.requestMint(oneHundred, 20*10**18 , { from: mintKey })
    
            })

            it('fails to transfer mintkey to 0x0', async function () {
                await assertRevert(this.controller.transferMintKey("0x0000000000000000000000000000000000000000", { from: owner }))
            })


            it('non owner/mintkey cannot transfer mintkey', async function () {
                await assertRevert(this.controller.transferMintKey(oneHundred, { from: mintKey }))
            })
        })


        describe('Full mint process', function () {
            beforeEach(async function () {
                await this.controller.addMintCheckTime(8,0, { from: owner })
                await this.controller.addMintCheckTime(20,0, { from: owner })
                await this.controller.setMintLimit(100*10**18, { from: owner })
                await this.controller.setSmallMintThreshold(11*10**18, { from: owner })
                await this.controller.setMinimalApprovals(2,3, { from: owner })
            })

            it('owner can finalize before checktime/without approvals', async function(){
                await this.controller.requestMint(oneHundred, 10*10**18 , { from: mintKey })
                await this.controller.finalizeMint(0 , { from: owner })
            })


            it('cannot approve mint if not an approver', async function () {
                await this.controller.requestMint(oneHundred, 10*10**18 , { from: mintKey })
                await assertRevert(this.controller.approveMint(0 , { from: pauseKey }))
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
                await assertRevert(this.controller.pauseMints({ from: oneHundred }))
            })

            it('pause key cannot unpause', async function () {
                await assertRevert(this.controller.unPauseMints({ from: pauseKey }))
            })

            it('owner pauses then unpause then mints', async function () {
                await this.controller.pauseMints({ from: owner })
                await this.controller.unPauseMints({ from: owner })
                await this.controller.requestMint(oneHundred, 10*10**18 , { from: mintKey })
            })

            it('pause key sets today as holiday, request mint fails', async function () {
                const time = Number(await this.controller.returnTime()) + Number(await this.controller.timeZoneDiff())
                var today = new Date(time*1000);
                var hour = today.getHours();
                var day = today.getDate();
                var month = today.getMonth()+1; //January is 0!
                var year = today.getFullYear();
                console.log("month: ",month," day: " ,day, " hour: ", hour)
                await this.controller.addHoliday(year,month,day,hour,{ from: pauseKey })
                await assertRevert(this.controller.requestMint(oneHundred, 10*10**18 , { from: mintKey }))
            })


            it('pauseKey cannot remove holiday', async function () {
                const time = Number(await this.controller.returnTime()) + Number(await this.controller.timeZoneDiff())
                var today = new Date(time*1000);
                var hour = today.getHours();
                var day = today.getDate();
                var month = today.getMonth()+1; //January is 0!
                var year = today.getFullYear();
                console.log("month: ",month," day: " ,day, " hour: ", hour)
                await this.controller.addHoliday(year,month,day,hour,{ from: pauseKey })
                await assertRevert(this.controller.removeHoliday(year,month,day,hour,{ from: pauseKey }))
                this.controller.removeHoliday(year,month,day,hour,{ from: owner })
                await this.controller.requestMint(oneHundred, 10*10**18 , { from: mintKey })
            })

            it('cannot finalize without enough approvers', async function () {
                await this.controller.requestMint(oneHundred, 10*10**18 , { from: mintKey })
                await this.controller.approveMint(0 , { from: approver1 })
                await increaseTime(duration.hours(15))
                await assertRevert(this.controller.finalizeMint(0 , { from: mintKey }))
            })

            it('cannot finalize a large amount without enough approvers', async function(){
                await this.controller.requestMint(oneHundred, 30*10**18 , { from: mintKey })
                await this.controller.approveMint(0 , { from: approver1 })
                await this.controller.approveMint(0 , { from: approver2 })
                await increaseTime(duration.hours(15))
                await assertRevert(this.controller.finalizeMint(0 , { from: mintKey }))
            })       

            it('finalize a large amount', async function(){
                await this.controller.requestMint(oneHundred, 30*10**18 , { from: mintKey })
                await this.controller.approveMint(0 , { from: approver1 })
                await this.controller.approveMint(0 , { from: approver2 })
                await this.controller.approveMint(0 , { from: approver3 })
                await increaseTime(duration.hours(15))
                await this.controller.finalizeMint(0 , { from: mintKey })
            })

            it('cannot finalize after all request invalidated', async function(){
                await this.controller.requestMint(oneHundred, 10*10**18 , { from: mintKey })
                await this.controller.requestMint(oneHundred, 20*10**18 , { from: mintKey })
                await this.controller.approveMint(0 , { from: approver1 })
                await this.controller.approveMint(0 , { from: approver2 })
                await this.controller.approveMint(0 , { from: approver3 })
                await this.controller.approveMint(1 , { from: approver1 })
                await this.controller.approveMint(1 , { from: approver2 })
                await this.controller.approveMint(1 , { from: approver3 })
                await this.controller.invalidateAllPendingMints({from: owner})
                await increaseTime(duration.hours(15))
                await assertRevert(this.controller.finalizeMint(0 , { from: mintKey }))
            })


            it('does the entire mint process', async function () {

                const kycStatus = await this.registry.hasAttribute(oneHundred, "hasPassedKYC/AML")
                assert.equal(kycStatus,true,"failed to set kycAML status to true")

                await this.controller.requestMint(oneHundred, 10*10**18 , { from: mintKey })                
                await this.controller.approveMint(0 , { from: approver1 })
                await this.controller.approveMint(0 , { from: approver2 })
                const mintOperation = await this.controller.mintOperations(0)
                assert.equal(Number(mintOperation[4]), 2,"numberOfApprovals != 2")
                assert.equal(Number(mintOperation[1]), 10*10**18,"wrong mint amount")
                await increaseTime(duration.hours(15))
                await this.controller.finalizeMint(0 , { from: mintKey })

            })
            it('cannot finalize right after request', async function () {
                await this.controller.requestMint(oneHundred, 10*10**18 , { from: mintKey })                
                await this.controller.approveMint(0 , { from: approver1 })
                await this.controller.approveMint(0 , { from: approver2 })
                await assertRevert(this.controller.finalizeMint(0 , { from: mintKey }))
            })


            it('always able to finalize mint from a day ago', async function () {
                var time = Number(await this.controller.returnTime())
                var blockchainHour = Number(await this.dateTime.getHour(time))
                while (blockchainHour != 9){
                    await increaseTime(duration.hours(1))
                    time = Number(await this.controller.returnTime())
                    blockchainHour = Number(await this.dateTime.getHour(time))
                }
                time = Number(await this.controller.returnTime())
                var blockchainYear = Number(await this.dateTime.getYear(time))
                var blockchainMonth = Number(await this.dateTime.getMonth(time))
                var blockchainDay = Number(await this.dateTime.getDay(time))

                var firstChecktimeToday = await this.controller.returnChecktime(0)
                var secondChecktimeToday = await this.controller.returnChecktime(1)
                var firstChecktimeYesterday = await this.controller.returnYesterdayChecktime(0)
                var secondChecktimeYesterday = await this.controller.returnYesterdayChecktime(1)
                console.log("firstChecktimeToday: ", firstChecktimeToday)
                console.log("secondChecktimeToday: ", secondChecktimeToday)
                console.log("firstChecktimeYesterday: ", firstChecktimeYesterday)
                console.log("secondChecktimeYesterday: ", secondChecktimeYesterday)

                var requestEpochTime = new Date(blockchainYear,blockchainMonth-1,blockchainDay-1,7,29).getTime()/1000
                var result = await this.controller.ableToFinalize(requestEpochTime)
                console.log(result)
                console.log("js epoch time: ", requestEpochTime)
                requestEpochTime = new Date(blockchainYear,blockchainMonth-1,blockchainDay-1,8,31).getTime()/1000
                result = await this.controller.ableToFinalize(requestEpochTime)
                console.log(result)
                console.log("js epoch time: ", requestEpochTime)
                requestEpochTime = new Date(blockchainYear,blockchainMonth-1,blockchainDay-1,10,32).getTime()/1000
                result = await this.controller.ableToFinalize(requestEpochTime)
                console.log(result)
                console.log("js epoch time: ", requestEpochTime)
                requestEpochTime = new Date(blockchainYear,blockchainMonth-1,blockchainDay-1,18,32).getTime()/1000
                result = await this.controller.ableToFinalize(requestEpochTime)
                console.log(result)
                console.log("js epoch time: ", requestEpochTime)
                requestEpochTime = new Date(blockchainYear,blockchainMonth-1,blockchainDay-1,21,34).getTime()/1000
                result = await this.controller.ableToFinalize(requestEpochTime)
                console.log(result)
                console.log("js epoch time: ", requestEpochTime)
                //86400
            })

            it("return checktimes", async function(){
                var firstChecktimeToday = await this.controller.returnChecktime(0)
                var secondChecktimeToday = await this.controller.returnChecktime(1)
                var firstChecktimeYesterday = await this.controller.returnYesterdayChecktime(0)
                var secondChecktimeYesterday = await this.controller.returnYesterdayChecktime(1)
                console.log("firstChecktimeToday: ", firstChecktimeToday)
                console.log("secondChecktimeToday: ", secondChecktimeToday)
                console.log("firstChecktimeYesterday: ", firstChecktimeYesterday)
                console.log("secondChecktimeYesterday: ", secondChecktimeYesterday)
            })

            it('does the entire mint process finalize within the day', async function () {
                var time = Number(await this.controller.returnTime())
                //increase time until time equals 7:28
                var blockchainHour = Number(await this.dateTime.getHour(time))
                var blockchainMinute = Number(await this.dateTime.getMinute(time))
                while (blockchainHour != 7){
                    await increaseTime(duration.hours(1))
                    time = Number(await this.controller.returnTime())
                    blockchainHour = Number(await this.dateTime.getHour(time))
                }
                while (blockchainMinute != 25){
                    await increaseTime(duration.minutes(1))
                    time = Number(await this.controller.returnTime())
                    blockchainMinute = Number(await this.dateTime.getMinute(time))
                }
                
                time = Number(await this.controller.returnTime())
                //increase time until time equals 7:28
                blockchainHour = Number(await this.dateTime.getHour(time))

                console.log("hour: ",blockchainHour," minute: ", blockchainMinute  )

                await this.controller.requestMint(oneHundred, 10*10**18 , { from: mintKey })   
                await this.controller.approveMint(0 , { from: approver1 })
                await this.controller.approveMint(0 , { from: approver2 })
                await increaseTime(duration.hours(3))
                time = Number(await this.controller.returnTime())
                blockchainHour = Number(await this.dateTime.getHour(time))
                blockchainMinute = Number(await this.dateTime.getMinute(time))
                
                var firstChecktimeToday = await this.controller.returnChecktime(0)
                var secondChecktimeToday = await this.controller.returnChecktime(1)
                var firstChecktimeYesterday = await this.controller.returnYesterdayChecktime(0)
                var secondChecktimeYesterday = await this.controller.returnYesterdayChecktime(1)
                console.log("firstChecktimeToday: ", firstChecktimeToday)
                console.log("secondChecktimeToday: ", secondChecktimeToday)
                console.log("firstChecktimeYesterday: ", firstChecktimeYesterday)
                console.log("secondChecktimeYesterday: ", secondChecktimeYesterday)

                console.log("hour: ",blockchainHour," minute: ", blockchainMinute  )

                await this.controller.finalizeMint(0 , { from: mintKey })
            })

            it('mint fails if not enought time for checker to pause', async function () {
                var time = Number(await this.controller.returnTime())
                //increase time until time equals 7:29
                var blockchainHour = Number(await this.dateTime.getHour(time))
                var blockchainMinute = Number(await this.dateTime.getMinute(time))
                while (blockchainHour != 6){
                    await increaseTime(duration.hours(1))
                    time = Number(await this.controller.returnTime())
                    blockchainHour = Number(await this.dateTime.getHour(time))
                }
                while (blockchainMinute != 28){
                    await increaseTime(duration.minutes(1))
                    time = Number(await this.controller.returnTime())
                    blockchainMinute = Number(await this.dateTime.getMinute(time))
                }

                console.log("hour: ",blockchainHour," minute: ", blockchainMinute  )
                time = Number(await this.controller.returnTime())
                const weekday = Number(await this.dateTime.getWeekday(time))

                await this.controller.requestMint(oneHundred, 10*10**18 , { from: mintKey })   
                await this.controller.approveMint(0 , { from: approver1 })
                await this.controller.approveMint(0 , { from: approver2 })
                await increaseTime(duration.hours(1))
                await assertRevert(this.controller.finalizeMint(0 , { from: mintKey }))
            })

            it('mint fails if the request mint is within 30 mins before checktime', async function () {
                var time = Number(await this.controller.returnTime())
                //increase time until time equals 7:29
                var blockchainHour = Number(await this.dateTime.getHour(time))
                var blockchainMinute = Number(await this.dateTime.getMinute(time))
                while (blockchainHour != 7){
                    await increaseTime(duration.hours(1))
                    time = Number(await this.controller.returnTime())
                    blockchainHour = Number(await this.dateTime.getHour(time))
                }
                while (blockchainMinute != 35){
                    await increaseTime(duration.minutes(1))
                    time = Number(await this.controller.returnTime())
                    blockchainMinute = Number(await this.dateTime.getMinute(time))
                }

                console.log("hour: ",blockchainHour," minute: ", blockchainMinute  )

                await this.controller.requestMint(oneHundred, 10*10**18 , { from: mintKey })   
                await this.controller.approveMint(0 , { from: approver1 })
                await this.controller.approveMint(0 , { from: approver2 })
                await increaseTime(duration.hours(1))
                await assertRevert(this.controller.finalizeMint(0 , { from: mintKey }))
            })





            //make sure to do one where the mint gets finalized next day
            //return false right after request
            //
            
        })



    //     describe('setDelegatedFrom', function () {
    //         it('sets delegatedFrom', async function () {
    //             await this.controller.setDelegatedFrom(oneHundred, { from: owner })

    //             const addr = await this.token.delegatedFrom()
    //             assert.equal(addr, oneHundred)
    //         })

    //         it('cannot be called by non-owner', async function () {
    //             await assertRevert(this.controller.setDelegatedFrom(oneHundred, { from: mintKey }))
    //         })
    //     })

    //     describe('changeTokenName', function () {
    //         it('sets the token name', async function () {
    //             await this.controller.changeTokenName("FooCoin", "FCN", { from: owner })

    //             const name = await this.token.name()
    //             assert.equal(name, "FooCoin")
    //             const symbol = await this.token.symbol()
    //             assert.equal(symbol, "FCN")
    //         })

    //         it('cannot be called by non-owner', async function () {
    //             await assertRevert(this.controller.changeTokenName("FooCoin", "FCN", { from: mintKey }))
    //         })
    //     })

    //     describe('setBurnBounds', function () {
    //         it('sets burnBounds', async function () {
    //             await this.controller.setBurnBounds(3*10**18, 4*10**18, { from: owner })

    //             const min = await this.token.burnMin()
    //             assert.equal(min, 3*10**18)
    //             const max = await this.token.burnMax()
    //             assert.equal(max, 4*10**18)
    //         })

    //         it('cannot be called by admin', async function () {
    //             await assertRevert(this.controller.setBurnBounds(3*10**18, 4*10**18, { from: mintKey }))
    //         })

    //         it('cannot be called by others', async function () {
    //             await assertRevert(this.controller.setBurnBounds(3*10**18, 4*10**18, { from: oneHundred }))
    //         })
    //     })

    //     describe('changeStaker', function () {
    //         it('sets staker', async function () {
    //             await this.controller.changeStaker(oneHundred, { from: owner })

    //             const staker = await this.token.staker()
    //             assert.equal(staker, oneHundred)
    //         })

    //         it('cannot be called by non-owner', async function () {
    //             await assertRevert(this.controller.changeStaker(oneHundred, { from: mintKey }))
    //         })
    //     })

    //     describe('delegateToNewContract', function () {
    //         it('sets delegate', async function () {
    //             await this.controller.delegateToNewContract(this.delegateContract.address,
    //                                                         this.balanceSheet,
    //                                                         this.allowanceSheet, { from: owner })
    //             const delegate = await this.token.delegate()

    //             assert.equal(delegate, this.delegateContract.address)
    //             let balanceOwner = await BalanceSheet.at(this.balanceSheet).owner()
    //             let allowanceOwner = await AllowanceSheet.at(this.allowanceSheet).owner()


    //             assert.equal(balanceOwner, this.delegateContract.address)
    //             assert.equal(allowanceOwner, this.delegateContract.address)

    //         })

    //         it('cannot be called by non-owner', async function () {
    //             await assertRevert(this.controller.delegateToNewContract(this.delegateContract.address,
    //                                                         this.balanceSheet,
    //                                                         this.allowanceSheet, { from: mintKey }))
    //         })

    //         it('cannot set delegate with balancesheet is not owned', async function () {
    //             let balanceSheetAddr = "0x123";
    //             let allowanceSheetAddr = "0x234"
    //             await assertRevert(this.controller.delegateToNewContract(this.delegateContract.address,
    //                                                         balanceSheetAddr,
    //                                                         allowanceSheetAddr, { from: owner }))
    //         })

    //         it('fails when new delegate contract doesnt implement setBalanceSheet() ', async function () {
    //             await assertRevert(this.controller.delegateToNewContract(this.faultyDelegateContract1.address,
    //                                                         this.balanceSheet,
    //                                                         this.allowanceSheet, { from: owner }))
    //         })

    //         it('fails when new delegate contract doesnt implement setAllowanceSheet() ', async function () {
    //             await assertRevert(this.controller.delegateToNewContract(this.faultyDelegateContract2.address,
    //                                                         this.balanceSheet,
    //                                                         this.allowanceSheet, { from: owner }))
    //         })


    //     })


    //     describe('requestReclaimContract', function () {
    //         it('reclaims the contract', async function () {
    //             const balances = await this.token.balances()
    //             let balanceOwner = await BalanceSheet.at(balances).owner()
    //             assert.equal(balanceOwner, this.token.address)

    //             await this.controller.requestReclaimContract(balances, { from: owner })
    //             await this.controller.issueClaimOwnership(balances, { from: owner })
    //             balanceOwner = await BalanceSheet.at(balances).owner()
    //             assert.equal(balanceOwner, this.controller.address)
    //         })

    //         it('emits an event', async function () {
    //             const balances = await this.token.balances()
    //             const { logs } = await this.controller.requestReclaimContract(balances, { from: owner })

    //             assert.equal(logs.length, 1)
    //             assert.equal(logs[0].event, 'RequestReclaimContract')
    //             assert.equal(logs[0].args.other, balances)
    //         })

    //         it('cannot be called by non-owner', async function () {
    //             const balances = await this.token.balances()
    //             await assertRevert(this.controller.requestReclaimContract(balances, { from: mintKey }))
    //         })
    //     })

    //     describe('requestReclaimEther', function () {
    //         it('reclaims ether', async function () {
    //             const balance1 = web3.fromWei(web3.eth.getBalance(oneHundred), 'ether').toNumber()
    //             const forceEther = await ForceEther.new({ from: oneHundred, value: "10000000000000000000" })
    //             await forceEther.destroyAndSend(this.token.address)
    //             const balance2 = web3.fromWei(web3.eth.getBalance(owner), 'ether').toNumber()
    //             await this.controller.requestReclaimEther({ from: owner })
    //             const balance3 = web3.fromWei(web3.eth.getBalance(owner), 'ether').toNumber()
    //             assert.isAbove(balance3, balance2)
    //         })

    //         it('cannot be called by non-owner', async function () {
    //             const forceEther = await ForceEther.new({ from: oneHundred, value: "10000000000000000000" })
    //             await forceEther.destroyAndSend(this.token.address)
    //             await assertRevert(this.controller.requestReclaimEther({ from: mintKey }))
    //         })
    //     })

    //     describe('requestReclaimToken', function () {
    //         it('reclaims token', async function () {
    //             await this.token.transfer(this.token.address, 40*10**18, { from: oneHundred })
    //             await this.controller.requestReclaimToken(this.token.address, { from: owner })
    //             await assertBalance(this.token, owner, 40*10**18)
    //         })

    //         it('cannot be called by non-owner', async function () {
    //             await this.token.transfer(this.token.address, 40*10**18, { from: oneHundred })
    //             await assertRevert(this.controller.requestReclaimToken(this.token.address, { from: mintKey }))
    //         })
    //     })

    //     describe('Staking Fees', function () {
    //         it('changes fees', async function () {
    //             await this.controller.changeStakingFees(1, 2, 3, 4, 5, 6, 7, 8, { from: owner })
    //             const transferFeeNumerator = await this.token.transferFeeNumerator()
    //             assert.equal(transferFeeNumerator, 1)
    //             const transferFeeDenominator = await this.token.transferFeeDenominator()
    //             assert.equal(transferFeeDenominator, 2)
    //             const mintFeeNumerator = await this.token.mintFeeNumerator()
    //             assert.equal(mintFeeNumerator, 3)
    //             const mintFeeDenominator = await this.token.mintFeeDenominator()
    //             assert.equal(mintFeeDenominator, 4)
    //             const mintFeeFlat = await this.token.mintFeeFlat()
    //             assert.equal(mintFeeFlat, 5)
    //             const burnFeeNumerator = await this.token.burnFeeNumerator()
    //             assert.equal(burnFeeNumerator, 6)
    //             const burnFeeDenominator = await this.token.burnFeeDenominator()
    //             assert.equal(burnFeeDenominator, 7)
    //             const burnFeeFlat = await this.token.burnFeeFlat()
    //             assert.equal(burnFeeFlat, 8)
    //         })

    //         it('cannot be called by non-owner', async function () {
    //             await assertRevert(this.controller.changeStakingFees(1, 2, 3, 4, 5, 6, 7, 8, { from: mintKey }))
    //         })
    //     })
    // })

    // describe('--TimeLockedController old test--', function () {
    //     it("should work", async function () {
    //         const registry = await Registry.new()
    //         const balances = await BalanceSheet.new()
    //         const allowances = await AllowanceSheet.new()
    //         const trueUSD = await TrueUSD.new()
    //         await balances.transferOwnership(trueUSD.address)
    //         await allowances.transferOwnership(trueUSD.address)
    //         await trueUSD.setBalanceSheet(balances.address)
    //         await trueUSD.setAllowanceSheet(allowances.address)
    //         await registry.setAttribute(accounts[3], "hasPassedKYC/AML", 1, "some notes", { from: accounts[0] })
    //         const timeLockedController = await TimeLockedController.new({ from: accounts[0] })
    //         await registry.transferOwnership(timeLockedController.address, { from: accounts[0] })
    //         await trueUSD.transferOwnership(timeLockedController.address, { from: accounts[0] })
    //         await timeLockedController.issueClaimOwnership(registry.address, { from: accounts[0] })
    //         await timeLockedController.issueClaimOwnership(trueUSD.address, { from: accounts[0] })
    //         await timeLockedController.setTrueUSD(trueUSD.address)
    //         await timeLockedController.setRegistry(registry.address, { from: accounts[0] })
    //         await assertRevert(trueUSD.mint(accounts[3], 10, { from: accounts[0] })) //user 0 is no longer the owner
    //         await timeLockedController.requestMint(accounts[3], 9, { from: accounts[0] })
    //         await timeLockedController.finalizeMint(0, { from: accounts[0] }) // the owner can finalize immediately
    //         await assertBalance(trueUSD, accounts[3], 9)
    //         await assertRevert(timeLockedController.requestMint(accounts[3], 200, { from: accounts[1] })) //user 1 is not (yet) the admin
    //         await timeLockedController.transferAdminship(accounts[1], { from: accounts[0] })
    //         await timeLockedController.requestMint(accounts[3], 200, { from: accounts[1] })
    //         await assertRevert(timeLockedController.finalizeMint(1, { from: accounts[3] })) //mint request cannot be finalized this early
    //         await increaseTime(duration.hours(12))
    //         await assertRevert(timeLockedController.finalizeMint(1, { from: accounts[3] })) //still not enough time has passed
    //         await increaseTime(duration.hours(12))
    //         await timeLockedController.finalizeMint(1, { from: accounts[1] }) //only target of mint can finalize
    //         await assertBalance(trueUSD, accounts[3], 209)
    //         await timeLockedController.requestMint(accounts[3], 3000, { from: accounts[1] })
    //         await timeLockedController.requestMint(accounts[3], 40000, { from: accounts[1] })
    //         await increaseTime(duration.days(1))
    //         await timeLockedController.finalizeMint(3, { from: accounts[1] })
    //         await assertRevert(timeLockedController.finalizeMint(3, { from: accounts[1] })) //can't double-finalize
    //         await assertBalance(trueUSD, accounts[3], 40209)
    //         await timeLockedController.transferAdminship(accounts[2], { from: accounts[0] })
    //         await assertRevert(timeLockedController.finalizeMint(2, { from: accounts[3] })) //can't finalize because admin has been changed
    //         await assertRevert(timeLockedController.transferChild(trueUSD.address, accounts[2], { from: accounts[1] })) //only owner
    //         await timeLockedController.requestMint(accounts[3], 500000, { from: accounts[2] })
    //         await timeLockedController.transferChild(trueUSD.address, accounts[2], { from: accounts[0] })
    //         await timeLockedController.transferChild(registry.address, accounts[2], { from: accounts[0] })
    //         await trueUSD.claimOwnership({ from: accounts[2] })
    //         await assertRevert(timeLockedController.finalizeMint(4, { from: accounts[2] })) //timeLockedController is no longer the owner of trueUSD
    //         await trueUSD.transferOwnership(timeLockedController.address, { from: accounts[2] })
    //         await timeLockedController.issueClaimOwnership(trueUSD.address, { from: accounts[0] })
    //         await increaseTime(duration.days(1))
    //         await timeLockedController.finalizeMint(4, { from: accounts[2] })
    //         await assertBalance(trueUSD, accounts[3], 540209)
    //     })
    // })
})
})
