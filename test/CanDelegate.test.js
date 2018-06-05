import assertRevert from './helpers/assertRevert'
import canDelegateTests from './CanDelegate'
const CanDelegateMock = artifacts.require('CanDelegateMock')
const StandardDelegateMock = artifacts.require('StandardDelegateMock')

contract('CanDelegate', function (accounts) {
    const _ = accounts[0]
    const owners = [accounts[1], accounts[2], accounts[3]]
    const oneHundreds = [accounts[4], accounts[5], accounts[6]]
    const anotherAccounts = [accounts[7], accounts[8], accounts[9]]

    beforeEach(async function () {
        this.token = await CanDelegateMock.new(oneHundreds[0], 100*10**18, { from: owners[0] })
    })

    canDelegateTests([owners[0], oneHundreds[0], anotherAccounts[0]])

    it('other test', async function () {
        const delegate = await StandardDelegateMock.new(oneHundreds[0], 100*10**18, { from: owners[0] })
        await delegate.setDelegatedFrom(anotherAccounts[0], { from: owners[0] })
        await assertRevert(delegate.delegateTransfer(anotherAccounts[0], 10*10**18, 0x0, { from: anotherAccounts[0] }))
    })
})
