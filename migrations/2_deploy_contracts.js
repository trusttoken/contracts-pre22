var AddressList = artifacts.require("AddressList");
var TrueUSD = artifacts.require("TrueUSD");
var TimeLockedAdmin = artifacts.require("TimeLockedAdmin");
var AddressValidation = artifacts.require("AddressValidation");
var Web3 = require('web3');

var canMintWhiteList, canBurnWhiteList

module.exports = async function(deployer) {
  await deployer;
  const addressValidation = await AddressValidation.new()
  const mintWhiteList = await AddressList.new("mintWhiteList", false)
  console.log("mintWhiteList Address: ", mintWhiteList.address)
  const canBurnWhiteList = await AddressList.new("canBurnWhiteList", false)
  console.log("canBurnWhiteList Address: ", canBurnWhiteList.address)
  const blackList = await AddressList.new("blackList", true)
  console.log("blackList Address: ", blackList.address)
  const trueUSD = await TrueUSD.new(mintWhiteList.address, canBurnWhiteList.address, blackList.address)
  console.log("trueUSD Address: ", trueUSD.address)
  const timeLockedAdmin = await TimeLockedAdmin.new(trueUSD.address, canBurnWhiteList.address, mintWhiteList.address, blackList.address)
  console.log("timeLockedAdmin Address: ", timeLockedAdmin.address)

  await mintWhiteList.transferOwnership(timeLockedAdmin.address, {gas: 3000000})
  await canBurnWhiteList.transferOwnership(timeLockedAdmin.address, {gas: 3000000})
  await blackList.transferOwnership(timeLockedAdmin.address, {gas: 3000000})
  await trueUSD.transferOwnership(timeLockedAdmin.address, {gas: 3000000})
};
