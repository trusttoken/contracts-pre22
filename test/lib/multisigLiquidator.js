const { uint256Bytes32 } = require('./abi.js')

async function signAction(account, validator, nonce, action) {
    assert(action.startsWith('0x'))
    const data = validator + uint256Bytes32(nonce) + action.slice(2)
    const hash = web3.utils.sha3(data)
    const sig = await web3.eth.sign(hash, account)
    return sig.replace(new RegExp('00$'), '1b').replace(new RegExp('01$'), '1c')
}

module.exports = {
    signAction,
}
