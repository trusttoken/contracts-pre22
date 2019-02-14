module.exports = function bytes32(str) {
  return web3.utils.padRight(web3.utils.toHex(str), 64);
}
