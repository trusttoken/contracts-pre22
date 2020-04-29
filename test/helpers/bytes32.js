module.exports = function bytes32 (str) {
  const Web3 = require('web3')
  const web3 = new Web3
  return web3.utils.padRight(web3.utils.toHex(str), 64)
}
