const ERC20_INTERFACE_ID = '0x36372b07'
const ORDER_TYPEHASH = web3.utils.sha3('Order(uint256 nonce,uint256 expiry,Party signer,Party sender,Party affiliate)Party(bytes4 kind,address wallet,address token,uint256 amount,uint256 id)')
const PARTY_TYPEHASH = web3.utils.sha3('Party(bytes4 kind,address wallet,address token,uint256 amount,uint256 id)')
const EIP712_DOMAIN_TYPEHASH = web3.utils.sha3('EIP712Domain(string name,string version,address verifyingContract)')
const DOMAIN_NAME = 'SWAP'
const DOMAIN_VERSION = '2'
//const SIG191_VERSION = '0x01'
const SIG191_VERSION = '0x45'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const { uint256Bytes32, addressBytes32 } = require('./abi.js')

function hashParty(party) {
    let input = (PARTY_TYPEHASH
        + ERC20_INTERFACE_ID.slice(2) + '0'.repeat(56)
        + addressBytes32(party['wallet'])
        + addressBytes32(party['token'])
        + uint256Bytes32(party['amount'])
        + uint256Bytes32(0)
    )
    return web3.utils.sha3(input)
}

function hashOrder(order) {
    let input = (ORDER_TYPEHASH
        + uint256Bytes32(order.nonce)
        + uint256Bytes32(order.expiry)
        + hashParty(order.signer).slice(2)
        + hashParty(order.sender).slice(2)
        + hashParty(order.affiliate).slice(2)
    )
    let result =  web3.utils.sha3(input)
    return result
}

function hashDomain(verifyingContract) {
    domain = (EIP712_DOMAIN_TYPEHASH +
        web3.utils.sha3(DOMAIN_NAME).slice(2) +
        web3.utils.sha3(DOMAIN_VERSION).slice(2) +
        addressBytes32(verifyingContract)
    )
    let result = web3.utils.sha3(domain)
    return result
}

function canonicalParty(party) {
    return (
        ERC20_INTERFACE_ID.slice(2) + '0'.repeat(56) +
        addressBytes32(party.wallet) +
        addressBytes32(party.token) + 
        uint256Bytes32(party.amount) +
        uint256Bytes32(0)
    )
}

const ZERO_PARTY = {
    wallet: ZERO_ADDRESS,
    token: ZERO_ADDRESS,
    amount: 0
}


class Order {
    constructor(nonce, expiry, verifyingContractAddress, makerAddress, makerTokenAmount, makerTokenAddress, takerAddress, takerTokenAmount, takerTokenAddress) {
        this.verifyingContract = verifyingContractAddress
        this.nonce = nonce
        this.expiry = expiry
        this.signer = {
            wallet: makerAddress,
            amount: makerTokenAmount,
            token: makerTokenAddress,
        }
        this.sender = {
            wallet: takerAddress,
            amount: takerTokenAmount,
            token: takerTokenAddress,
        }
        this.affiliate = ZERO_PARTY
        this.signatory = this.signer.wallet
    }
    get signingData() {
        return ('0x1901' +
            hashDomain(this.verifyingContract).slice(2) +
            hashOrder(this).slice(2)
        )
    }
    get signingHash() {
        return web3.utils.sha3(this.signingData)
    }
    async sign(signatory) {
        if (signatory) {
            this.signatory = signatory
        }
        const sig = await web3.eth.sign(this.signingHash, this.signatory)
        this.r = sig.slice(2, 66)
        this.s = sig.slice(66, 130)
        assert(parseInt(this.s.slice(0,1)) < 8)
        this.v = parseInt(sig.slice(130))
        if (this.v < 27) {
            this.v += 27
        }
        /*
        console.log({
            v: this.v,
            r: this.r,
            s: this.s,
            signingData: this.signingData,
            signingHash: this.signingHash,
            wallet: this.signer.wallet
        })
        */
        return sig
    }
    get abiV2Bytes() {
        return (
            uint256Bytes32(this.nonce) +
            uint256Bytes32(this.expiry) +
            canonicalParty(this.signer) + 
            canonicalParty(this.sender) +
            canonicalParty(this.affiliate) +
            addressBytes32(this.signatory) +
            addressBytes32(this.verifyingContract) +
            uint256Bytes32(SIG191_VERSION) +
            uint256Bytes32(this.v) +
            this.r +
            this.s
        )
    }
    get web3Tuple() {
        return [
            this.nonce,
            this.expiry,
            [
                ERC20_INTERFACE_ID,
                this.signer.wallet,
                this.signer.token,
                this.signer.amount,
                0
            ],
            [
                ERC20_INTERFACE_ID,
                this.sender.wallet,
                this.sender.token,
                this.sender.amount,
                0
            ],
            [
                ERC20_INTERFACE_ID,
                ZERO_ADDRESS,
                ZERO_ADDRESS,
                0,
                0
            ],
            [
                this.signatory,
                this.verifyingContract,
                SIG191_VERSION,
                this.v,
                '0x'+this.r,
                '0x'+this.s
            ]
        ]
    }
}

/*
console.log('ORDER_TYPEHASH', ORDER_TYPEHASH)
console.log('PARTY_TYPEHASH', PARTY_TYPEHASH)
console.log('DOMAIN_TYPEHASH', EIP712_DOMAIN_TYPEHASH)
console.log('ZERO_PARTY_HASH', hashParty(ZERO_PARTY))
*/

module.exports = {
    Order,
    hashDomain,
}
