var AddressList = artifacts.require("AddressList");
var BalanceSheet = artifacts.require("BalanceSheet");
var AllowanceSheet = artifacts.require("AllowanceSheet");
var TrueUSD = artifacts.require("TrueUSD");
var TimeLockedController = artifacts.require("TimeLockedController");
var AddressValidation = artifacts.require("AddressValidation");
var Web3 = require('web3');

module.exports = async function(deployer) {
  await deployer;

  console.log("Create the small contracts that TrueUSD depends on...")
  const addressValidation = await AddressValidation.new()
  console.log("addressValidation Address: ", addressValidation.address)
  const mintWhiteList = await AddressList.new("mintWhiteList", false)
  console.log("mintWhiteList Address: ", mintWhiteList.address)
  const canBurnWhiteList = await AddressList.new("canBurnWhiteList", false)
  console.log("canBurnWhiteList Address: ", canBurnWhiteList.address)
  const blackList = await AddressList.new("blackList", true)
  console.log("blackList Address: ", blackList.address)
  const noFeesList = await AddressList.new("noFeesList", false)
  console.log("noFeesList Address: ", noFeesList.address)
  const balances = await BalanceSheet.new()
  console.log("balanceSheet Address: ", balances.address)
  const allowances = await AllowanceSheet.new()
  console.log("allowanceSheet Address: ", allowances.address)

  console.log("Create and configure TrueUSD...")
  const trueUSD = await TrueUSD.new()
  console.log("trueUSD Address: ", trueUSD.address)
  await balances.transferOwnership(trueUSD.address)
  await allowances.transferOwnership(trueUSD.address)
  await trueUSD.setBalanceSheet(balances.address)
  await trueUSD.setAllowanceSheet(allowances.address)
  await trueUSD.setLists(mintWhiteList.address, canBurnWhiteList.address, blackList.address, noFeesList.address)
  await trueUSD.changeStaker("0x960Ab0dea96ab2dB293F162e6047306154588E8B")

  console.log("Create TimeLockedController and transfer ownership of other contracts to it...")
  const timeLockedController = await TimeLockedController.new(trueUSD.address)
  console.log("timeLockedController Address: ", timeLockedController.address)
  await mintWhiteList.transferOwnership(timeLockedController.address)
  await timeLockedController.issueClaimOwnership(mintWhiteList.address)
  await canBurnWhiteList.transferOwnership(timeLockedController.address)
  await timeLockedController.issueClaimOwnership(canBurnWhiteList.address)
  await blackList.transferOwnership(timeLockedController.address)
  await timeLockedController.issueClaimOwnership(blackList.address)
  await noFeesList.transferOwnership(timeLockedController.address)
  await timeLockedController.issueClaimOwnership(noFeesList.address)
  await trueUSD.transferOwnership(timeLockedController.address)
  await timeLockedController.issueClaimOwnership(trueUSD.address)

  console.log("Transfer admin/ownership of TimeLockedController...")
  await timeLockedController.transferAdminship("0xFdBCF49d3C47E20545E14046C4ECe9c02457646f")
  await timeLockedController.transferOwnership("0x8Dc4e7E8dD13FB489070d432Dfa89a0b93315d8B")

  console.log("Deployment successful")
};
