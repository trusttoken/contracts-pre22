var WhiteList = artifacts.require("Whitelist");
var TrueUSD = artifacts.require("TrueUSD");
var Web3 = require('web3');

var canMintWhiteList, canBurnWhiteList

module.exports = async function(deployer) {
  await deployer;
  const mintWhiteList = await WhiteList.new("mintWhiteList")
  const canBurnWhiteList = await WhiteList.new("canBurnWhiteList")
  const trueUSD = await TrueUSD.new(mintWhiteList.address, canBurnWhiteList.address)
};