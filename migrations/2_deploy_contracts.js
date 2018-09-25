// const BalanceSheet = artifacts.require("BalanceSheet");
// const AllowanceSheet = artifacts.require("AllowanceSheet");
// const TrueUSD = artifacts.require("TrueUSD");
// const TimeLockedController = artifacts.require("TimeLockedController");
// const DateTimeMock = artifacts.require("DateTimeMock");
// const Registry = artifacts.require("Registry");
// const FastPauseMints = artifacts.require("FastPauseMints")
// const pauseKey = "0x75f87fbbf0d57c24d76046ec023d611db8652034"
// const mintKey = "0x75f87fbbf0d57c24d76046ec023d611db8652034"
// const approver1 = "0x75f87fbbf0d57c24d76046ec023d611db8652034"
// const approver2 = "0x88990c90d5e6345adfe45d21e7547d405727d2aa"
// const approver3 = "0x5ae70e90105e3a7ec9bfda781ec4f80b00ead2a2"
// const user = "0x5ae70e90105e3a7ec9bfda781ec4f80b00ead2a2"

module.exports = async (deployer, network, accounts)=> {
  // let balanceSheet, allowanceSheet,trueUSD,timeLockedController,dateTime, registry, fastPauseMints;

  // deployer.then(async ()=>{
  // console.log("deploying BalanceSheet")
  // balanceSheet = BalanceSheet.at("0xd343e626d36e6e653b17abc9c76421d1180f44ed")//await BalanceSheet.new();
  // console.log("deploying AllowanceSheet")
  // allowanceSheet = AllowanceSheet.at("0xd2e62312ef99dfed58e0e7353063895add27e728")//await AllowanceSheet.new();
  // console.log("deploying TrueUSD")
  // trueUSD = TrueUSD.at("0xaeb5ddbeb7f855aa44a40b0d17c742031642414b")//await TrueUSD.new();
  // console.log("deploying TimeLockedController")
  // timeLockedController = TimeLockedController.at("0xf2b3bf1917d2a7890820a70edac8fb85a8211b59")//await TimeLockedController.new();
  // console.log("deploying DateTime")
  // dateTime = DateTimeMock.at("0x45f51f427d0f5ef9044e054081320e21d40b3516")//await DateTimeMock.new();
  // console.log("deploying registry")
  // registry = Registry.at("0xb8ba104c9479faa475d00bfe789693c0a25f6ca8")//await Registry.new();
  // console.log("deploying FastPauseMints")
  // fastPauseMints = FastPauseMints.at("0x99dd152342291cd31ddccbf635f94c0cf217d4d2")//await FastPauseMints.new(); 
  // console.log("######################")
  // console.log("tusd Address", trueUSD.address)
  // console.log("controller address", timeLockedController.address)
  // console.log("registry Address", registry.address)
  // console.log("fastPauseMints Address", fastPauseMints.address)
  // console.log("dateTime Address", dateTime.address)
  // console.log("balanceSheet Address", balanceSheet.address)
  // console.log("allowanceSheet Address", allowanceSheet.address)

  // console.log("transfer balanceSheet and allowanceSheet to TrueUSD")
  // await balanceSheet.transferOwnership(trueUSD.address)
  // await allowanceSheet.transferOwnership(trueUSD.address)
  // await trueUSD.setBalanceSheet(balanceSheet.address)
  // await trueUSD.setAllowanceSheet(allowanceSheet.address)
  // console.log("transfer trueUSD to timeLockedController")
  // await trueUSD.transferOwnership(timeLockedController.address)
  // await timeLockedController.issueClaimOwnership(trueUSD.address)
  // await timeLockedController.setTrueUSD(trueUSD.address)
  // console.log("configure controller");
  // await timeLockedController.setDateTime(dateTime.address);
  // await timeLockedController.setTusdRegistry(registry.address);
  // await timeLockedController.setRegistry(registry.address)
  // await timeLockedController.addMintCheckTime(10,0)
  // await timeLockedController.addMintCheckTime(17,0)
  // await timeLockedController.setMintLimit(100000)
  // await timeLockedController.setSmallMintThreshold(10000)
  // await timeLockedController.setMinimalApprovals(1,2)
  // await timeLockedController.addHoliday(2018,9,4)
  // await timeLockedController.setBurnBounds(100,300)
  // console.log("set permissions")
  // await timeLockedController.transferMintKey(mintKey)
  // await registry.setAttribute(approver1, "isTUSDMintApprover", 1, "notes")
  // await registry.setAttribute(approver2, "isTUSDMintApprover", 1, "notes")
  // await registry.setAttribute(approver3, "isTUSDMintApprover", 1, "notes")
  // await registry.setAttribute(pauseKey, "isTUSDMintChecker", 1, "notes")
  // await registry.setAttribute(user, "hasPassedKYC/AML", 1, "notes",)
  // await registry.setAttribute(user, "noFees", 1, "notes")
  // console.log("configure fastPauseMints");
  // await fastPauseMints.modifyPauseKey(pauseKey, true)
  // await fastPauseMints.setController(timeLockedController.address)
  // await registry.setAttribute(fastPauseMints.address, "isTUSDMintChecker", 1, "notes")
  // console.log("######################")
  // console.log("tusd Address", trueUSD.address)
  // console.log("controller address", timeLockedController.address)
  // console.log("registry Address", registry.address)
  // console.log("fastPauseMints Address", fastPauseMints.address)
  // })




};
// const BalanceSheet = artifacts.require("BalanceSheet");
// const AllowanceSheet = artifacts.require("AllowanceSheet");
// const TrueUSD = artifacts.require("TrueUSD");
// const TimeLockedController = artifacts.require("TimeLockedController");
// const DateTimeMock = artifacts.require("DateTimeMock");
// const Registry = artifacts.require("Registry");
// const FastPauseMints = artifacts.require("FastPauseMints")
// const pauseKey = "0x75f87fbbf0d57c24d76046ec023d611db8652034"
// const mintKey = "0x75f87fbbf0d57c24d76046ec023d611db8652034"
// const approver1 = "0x75f87fbbf0d57c24d76046ec023d611db8652034"
// const approver2 = "0x88990c90d5e6345adfe45d21e7547d405727d2aa"
// const approver3 = "0x5ae70e90105e3a7ec9bfda781ec4f80b00ead2a2"
// const user = "0x5ae70e90105e3a7ec9bfda781ec4f80b00ead2a2"

module.exports = async (deployer, network, accounts)=> {
  // let balanceSheet, allowanceSheet,trueUSD,timeLockedController,dateTime, registry, fastPauseMints;

  // deployer.then(async ()=>{
  // console.log("deploying BalanceSheet")
  // balanceSheet = BalanceSheet.at("0xd343e626d36e6e653b17abc9c76421d1180f44ed")//await BalanceSheet.new();
  // console.log("deploying AllowanceSheet")
  // allowanceSheet = AllowanceSheet.at("0xd2e62312ef99dfed58e0e7353063895add27e728")//await AllowanceSheet.new();
  // console.log("deploying TrueUSD")
  // trueUSD = TrueUSD.at("0xaeb5ddbeb7f855aa44a40b0d17c742031642414b")//await TrueUSD.new();
  // console.log("deploying TimeLockedController")
  // timeLockedController = TimeLockedController.at("0xf2b3bf1917d2a7890820a70edac8fb85a8211b59")//await TimeLockedController.new();
  // console.log("deploying DateTime")
  // dateTime = DateTimeMock.at("0x45f51f427d0f5ef9044e054081320e21d40b3516")//await DateTimeMock.new();
  // console.log("deploying registry")
  // registry = Registry.at("0xb8ba104c9479faa475d00bfe789693c0a25f6ca8")//await Registry.new();
  // console.log("deploying FastPauseMints")
  // fastPauseMints = FastPauseMints.at("0x99dd152342291cd31ddccbf635f94c0cf217d4d2")//await FastPauseMints.new(); 
  // console.log("######################")
  // console.log("tusd Address", trueUSD.address)
  // console.log("controller address", timeLockedController.address)
  // console.log("registry Address", registry.address)
  // console.log("fastPauseMints Address", fastPauseMints.address)
  // console.log("dateTime Address", dateTime.address)
  // console.log("balanceSheet Address", balanceSheet.address)
  // console.log("allowanceSheet Address", allowanceSheet.address)

  // console.log("transfer balanceSheet and allowanceSheet to TrueUSD")
  // await balanceSheet.transferOwnership(trueUSD.address)
  // await allowanceSheet.transferOwnership(trueUSD.address)
  // await trueUSD.setBalanceSheet(balanceSheet.address)
  // await trueUSD.setAllowanceSheet(allowanceSheet.address)
  // console.log("transfer trueUSD to timeLockedController")
  // await trueUSD.transferOwnership(timeLockedController.address)
  // await timeLockedController.issueClaimOwnership(trueUSD.address)
  // await timeLockedController.setTrueUSD(trueUSD.address)
  // console.log("configure controller");
  // await timeLockedController.setDateTime(dateTime.address);
  // await timeLockedController.setTusdRegistry(registry.address);
  // await timeLockedController.setRegistry(registry.address)
  // await timeLockedController.addMintCheckTime(10,0)
  // await timeLockedController.addMintCheckTime(17,0)
  // await timeLockedController.setMintLimit(100000)
  // await timeLockedController.setSmallMintThreshold(10000)
  // await timeLockedController.setMinimalApprovals(1,2)
  // await timeLockedController.addHoliday(2018,9,4)
  // await timeLockedController.setBurnBounds(100,300)
  // console.log("set permissions")
  // await timeLockedController.transferMintKey(mintKey)
  // await registry.setAttribute(approver1, "isTUSDMintApprover", 1, "notes")
  // await registry.setAttribute(approver2, "isTUSDMintApprover", 1, "notes")
  // await registry.setAttribute(approver3, "isTUSDMintApprover", 1, "notes")
  // await registry.setAttribute(pauseKey, "isTUSDMintChecker", 1, "notes")
  // await registry.setAttribute(user, "hasPassedKYC/AML", 1, "notes",)
  // await registry.setAttribute(user, "noFees", 1, "notes")
  // console.log("configure fastPauseMints");
  // await fastPauseMints.modifyPauseKey(pauseKey, true)
  // await fastPauseMints.setController(timeLockedController.address)
  // await registry.setAttribute(fastPauseMints.address, "isTUSDMintChecker", 1, "notes")
  // console.log("######################")
  // console.log("tusd Address", trueUSD.address)
  // console.log("controller address", timeLockedController.address)
  // console.log("registry Address", registry.address)
  // console.log("fastPauseMints Address", fastPauseMints.address)
  // })
};
