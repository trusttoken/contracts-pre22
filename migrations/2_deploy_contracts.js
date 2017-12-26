var WhiteList = artifacts.require("Whitelist");
var TrueUSD = artifacts.require("TrueUSD");
var Web3 = require('web3');

var canMintWhiteList, canBurnWhiteList

module.exports = async function(deployer) {
  await deployer;
  const minWhiteList = await WhiteList.new("mintWhiteList")
  const canBurnWhiteList = await WhiteList.new("canBurnWhiteList")
  const trueUSD = await TrueUSD.new(minWhiteList.address, canBurnWhiteList.address)
  console.log("Addresses are: ", minWhiteList.address, canBurnWhiteList.address, trueUSD.address)
};