var WhiteList = artifacts.require("Whitelist");
var TrueUSD = artifacts.require("TrueUSD");
var LimitedAdmin = artifacts.require("LimitedAdmin");
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
  const limitedAdmin = await LimitedAdmin.new(trueUSD.address)
  console.log("limitedAdmin Address: ", limitedAdmin.address)
};