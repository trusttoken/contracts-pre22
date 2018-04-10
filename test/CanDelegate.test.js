import canDelegateTests from './CanDelegate'
const CanDelegateMock = artifacts.require('CanDelegateMock')
const StandardDelegateMock = artifacts.require('StandardDelegateMock')

contract('CanDelegate', function (accounts) {
    const _ = accounts[0]
    const owners = [accounts[1], accounts[2], accounts[3]]
    const oneHundreds = [accounts[4], accounts[5], accounts[6]]
    const anotherAccounts = [accounts[7], accounts[8], accounts[9]]

    beforeEach(async function () {
        this.token = await CanDelegateMock.new(oneHundreds[0], 100, { from: owners[0] })
        // this.token2 = await StandardDelegateMock.new(oneHundreds[1], 100, { from: owners[1] })
    })

    canDelegateTests([owners[0], oneHundreds[0], anotherAccounts[0]])

    // describe('chaining three contracts', function () {
    //     beforeEach(async function () {
    //         this.token.delegateToNewContract(this.token2.address, { from: owners[0] })
    //         this.token2.setDelegatedFrom(this.token.address, { from: owners[1] })
    //     })

    //     describe('first contract behaves', function () {
    //         it('temp', async function () {
    //             const balance = await this.token.balanceOf(oneHundreds[1])
    //             assert.equal(balance, 100)
    //             await this.token.burn(100, { from: oneHundreds[1] })
    //             // await this.token.transfer(anotherAccounts[2], 100, { from: oneHundreds[2] })
    //         })

    //         // basicTokenTests([owners[2], oneHundreds[2], anotherAccounts[2]])
    //     })
    // })

})