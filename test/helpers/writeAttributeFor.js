const canWriteTo = Buffer.from(web3.utils.sha3("canWriteTo-").slice(2), 'hex');

function writeAttributeFor(attribute) {
  let bytes = Buffer.from(attribute.slice(2), 'hex');
  for (let index = 0; index < canWriteTo.length; index++) {
    bytes[index] ^= canWriteTo[index];
  }
  return web3.utils.sha3('0x' + bytes.toString('hex'));
}

module.exports = writeAttributeFor;
