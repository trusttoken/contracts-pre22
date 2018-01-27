var AddressList = artifacts.require("AddressList");
var TrueUSD = artifacts.require("TrueUSD");
var TimeLockedController = artifacts.require("TimeLockedController");
var AddressValidation = artifacts.require("AddressValidation");
var Web3 = require('web3');

var canMintWhiteList, canBurnWhiteList

module.exports = async function(deployer) {
  await deployer;
  const addressValidation = await AddressValidation.new()
  console.log("addressValidation Address: ", addressValidation.address )
  const mintWhiteList = await AddressList.new("mintWhiteList", false)
  console.log("mintWhiteList Address: ", mintWhiteList.address)
  const canBurnWhiteList = await AddressList.new("canBurnWhiteList", false)
  console.log("canBurnWhiteList Address: ", canBurnWhiteList.address)
  const blackList = await AddressList.new("blackList", true)
  console.log("blackList Address: ", blackList.address)
  const trueUSD = await TrueUSD.new(mintWhiteList.address, canBurnWhiteList.address, blackList.address, {gas: 5000000})
  console.log("trueUSD Address: ", trueUSD.address)
  const timeLockedController = await TimeLockedController.new(trueUSD.address, canBurnWhiteList.address, mintWhiteList.address, blackList.address)
  console.log("timeLockedController Address: ", timeLockedController.address)

  await mintWhiteList.transferOwnership(timeLockedController.address, {gas: 3000000})
  await timeLockedController.issueClaimOwnership(mintWhiteList.address)
  await canBurnWhiteList.transferOwnership(timeLockedController.address, {gas: 3000000})
  await timeLockedController.issueClaimOwnership(canBurnWhiteList.address)
  await blackList.transferOwnership(timeLockedController.address, {gas: 3000000})
  await timeLockedController.issueClaimOwnership(blackList.address)
  await trueUSD.changeInsurer("0x960Ab0dea96ab2dB293F162e6047306154588E8B", {gas: 3000000})
  await trueUSD.transferOwnership(timeLockedController.address, {gas: 3000000})
  await timeLockedController.issueClaimOwnership(trueUSD.address)
  console.log("Ownership successfully transferred")
  await timeLockedController.transferAdminship("0xFdBCF49d3C47E20545E14046C4ECe9c02457646f", {gas: 3000000})
};
