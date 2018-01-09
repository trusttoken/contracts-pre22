var WhiteList = artifacts.require("Whitelist");
var TrueUSD = artifacts.require("TrueUSD");
var TimeLockedAdmin = artifacts.require("TimeLockedAdmin");
var Web3 = require('web3');

var canMintWhiteList, canBurnWhiteList

module.exports = async function(deployer) {
  await deployer;
  const mintWhiteList = await WhiteList.new("mintWhiteList")
  console.log("mintWhiteList Address: ", mintWhiteList.address)
  const canBurnWhiteList = await WhiteList.new("canBurnWhiteList")
  console.log("canBurnWhiteList Address: ", canBurnWhiteList.address)
  const trueUSD = await TrueUSD.new(mintWhiteList.address, canBurnWhiteList.address)
  console.log("trueUSD Address: ", trueUSD.address)
  const timeLockedAdmin = await TimeLockedAdmin.new(trueUSD.address)
  console.log("timeLockedAdmin Address: ", timeLockedAdmin.address)
};