const BN = web3.utils.toBN;
async function assertBalance(token, account, value) {
    let balance = await token.balanceOf.call(account)
    assert(BN(balance).eq(BN(value)), `${balance} should equal ${value}`)
}

export default assertBalance
