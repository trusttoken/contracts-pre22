var AddressList = artifacts.require("AddressList");
var TrueUSD = artifacts.require("TrueUSD");
var TimeLockedAdmin = artifacts.require("TimeLockedAdmin");
var Web3 = require('web3');

var canMintWhiteList, canBurnWhiteList

module.exports = async function(deployer) {
  await deployer;
  const mintWhiteList = await AddressList.new("mintWhiteList")
  console.log("mintWhiteList Address: ", mintWhiteList.address)
  const canBurnWhiteList = await AddressList.new("canBurnWhiteList")
  console.log("canBurnWhiteList Address: ", canBurnWhiteList.address)
  const blackList = await AddressList.new("blackList")
  console.log("blackList Address: ", blackList.address)
  const trueUSD = await TrueUSD.new(mintWhiteList.address, canBurnWhiteList.address, blackList.address)
  console.log("trueUSD Address: ", trueUSD.address)
  const timeLockedAdmin = await TimeLockedAdmin.new(trueUSD.address, canBurnWhiteList.address, mintWhiteList.address, blackList.address)
  console.log("timeLockedAdmin Address: ", timeLockedAdmin.address)
};
