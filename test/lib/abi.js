const BYTES12_ZERO = '000000000000000000000000'
function uint256Bytes32(uint256) {
    let bytes = uint256.toString(16)
    if (bytes.length < 64) {
        bytes = '0'.repeat(64 - bytes.length) + bytes
    }
    assert(bytes.length == 64)
    return bytes
}

function addressBytes32(address) {
    let bytes =  BYTES12_ZERO + address.slice(2)
    assert(bytes.length == 64)
    return bytes
}


module.exports = {
    uint256Bytes32,
    addressBytes32,
}
