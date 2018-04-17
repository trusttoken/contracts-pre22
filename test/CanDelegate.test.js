import canDelegateTests from './CanDelegate'
const CanDelegateMock = artifacts.require('CanDelegateMock')

contract('CanDelegate', function (accounts) {
    const _ = accounts[0]
    const owners = [accounts[1], accounts[2], accounts[3]]
    const oneHundreds = [accounts[4], accounts[5], accounts[6]]
    const anotherAccounts = [accounts[7], accounts[8], accounts[9]]

    beforeEach(async function () {
        this.token = await CanDelegateMock.new(oneHundreds[0], 100, { from: owners[0] })
    })

    canDelegateTests([owners[0], oneHundreds[0], anotherAccounts[0]])
})