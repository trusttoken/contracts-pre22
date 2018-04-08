import assertRevert from './helpers/assertRevert'
import mintableTokenTests from './token/MintableToken';
import burnableTokenTests from './token/BurnableToken';
import standardTokenTests from './token/StandardToken';
import basicTokenTests from './token/BasicToken';

function tokenWithFeesTests([_, owner, oneHundred, anotherAccount]) {
    describe('--TokenWithFees Tests--', function () {
        describe('fees are initially set to 0', function () {
            basicTokenTests([_, owner, oneHundred, anotherAccount])
            standardTokenTests([_, owner, oneHundred, anotherAccount])
            burnableTokenTests([_, owner, oneHundred, anotherAccount])
            mintableTokenTests([_, owner, oneHundred, anotherAccount])
        })
    })
}

export default tokenWithFeesTests