        describe('setDelegatedFrom', function () {
            it('sets delegatedFrom', async function () {
                await this.controller.setDelegatedFrom(oneHundred, { from: owner })

                const addr = await this.token.delegatedFrom()
                assert.equal(addr, oneHundred)
            })

            it('cannot be called by non-owner', async function () {
                await assertRevert(this.controller.setDelegatedFrom(oneHundred, { from: mintKey }))
            })
        })

        describe('changeTokenName', function () {
            it('sets the token name', async function () {
                await this.controller.changeTokenName("FooCoin", "FCN", { from: owner })

                const name = await this.token.name()
                assert.equal(name, "FooCoin")
                const symbol = await this.token.symbol()
                assert.equal(symbol, "FCN")
            })

            it('cannot be called by non-owner', async function () {
                await assertRevert(this.controller.changeTokenName("FooCoin", "FCN", { from: mintKey }))
            })
        })

        describe('setBurnBounds', function () {
            it('sets burnBounds', async function () {
                await this.controller.setBurnBounds(3*10**18, 4*10**18, { from: owner })

                const min = await this.token.burnMin()
                assert.equal(min, 3*10**18)
                const max = await this.token.burnMax()
                assert.equal(max, 4*10**18)
            })

            it('cannot be called by admin', async function () {
                await assertRevert(this.controller.setBurnBounds(3*10**18, 4*10**18, { from: mintKey }))
            })

            it('cannot be called by others', async function () {
                await assertRevert(this.controller.setBurnBounds(3*10**18, 4*10**18, { from: oneHundred }))
            })
        })

        describe('changeStaker', function () {
            it('sets staker', async function () {
                await this.controller.changeStaker(oneHundred, { from: owner })

                const staker = await this.token.staker()
                assert.equal(staker, oneHundred)
            })

            it('cannot be called by non-owner', async function () {
                await assertRevert(this.controller.changeStaker(oneHundred, { from: mintKey }))
            })
        })

        describe('delegateToNewContract', function () {
            it('sets delegate', async function () {
                await this.controller.delegateToNewContract(this.delegateContract.address,
                                                            this.balanceSheet,
                                                            this.allowanceSheet, { from: owner })
                const delegate = await this.token.delegate()

                assert.equal(delegate, this.delegateContract.address)
                let balanceOwner = await BalanceSheet.at(this.balanceSheet).owner()
                let allowanceOwner = await AllowanceSheet.at(this.allowanceSheet).owner()


                assert.equal(balanceOwner, this.delegateContract.address)
                assert.equal(allowanceOwner, this.delegateContract.address)

            })

            it('cannot be called by non-owner', async function () {
                await assertRevert(this.controller.delegateToNewContract(this.delegateContract.address,
                                                            this.balanceSheet,
                                                            this.allowanceSheet, { from: mintKey }))
            })

            it('cannot set delegate with balancesheet is not owned', async function () {
                let balanceSheetAddr = "0x123";
                let allowanceSheetAddr = "0x234"
                await assertRevert(this.controller.delegateToNewContract(this.delegateContract.address,
                                                            balanceSheetAddr,
                                                            allowanceSheetAddr, { from: owner }))
            })

            it('fails when new delegate contract doesnt implement setBalanceSheet() ', async function () {
                await assertRevert(this.controller.delegateToNewContract(this.faultyDelegateContract1.address,
                                                            this.balanceSheet,
                                                            this.allowanceSheet, { from: owner }))
            })

            it('fails when new delegate contract doesnt implement setAllowanceSheet() ', async function () {
                await assertRevert(this.controller.delegateToNewContract(this.faultyDelegateContract2.address,
                                                            this.balanceSheet,
                                                            this.allowanceSheet, { from: owner }))
            })


        })


        describe('requestReclaimContract', function () {
            it('reclaims the contract', async function () {
                const balances = await this.token.balances()
                let balanceOwner = await BalanceSheet.at(balances).owner()
                assert.equal(balanceOwner, this.token.address)

                await this.controller.requestReclaimContract(balances, { from: owner })
                await this.controller.issueClaimOwnership(balances, { from: owner })
                balanceOwner = await BalanceSheet.at(balances).owner()
                assert.equal(balanceOwner, this.controller.address)
            })

            it('emits an event', async function () {
                const balances = await this.token.balances()
                const { logs } = await this.controller.requestReclaimContract(balances, { from: owner })

                assert.equal(logs.length, 1)
                assert.equal(logs[0].event, 'RequestReclaimContract')
                assert.equal(logs[0].args.other, balances)
            })

            it('cannot be called by non-owner', async function () {
                const balances = await this.token.balances()
                await assertRevert(this.controller.requestReclaimContract(balances, { from: mintKey }))
            })
        })

        describe('requestReclaimEther', function () {
            it('reclaims ether', async function () {
                const balance1 = web3.fromWei(web3.eth.getBalance(oneHundred), 'ether').toNumber()
                const forceEther = await ForceEther.new({ from: oneHundred, value: "10000000000000000000" })
                await forceEther.destroyAndSend(this.token.address)
                const balance2 = web3.fromWei(web3.eth.getBalance(owner), 'ether').toNumber()
                await this.controller.requestReclaimEther({ from: owner })
                const balance3 = web3.fromWei(web3.eth.getBalance(owner), 'ether').toNumber()
                assert.isAbove(balance3, balance2)
            })

            it('cannot be called by non-owner', async function () {
                const forceEther = await ForceEther.new({ from: oneHundred, value: "10000000000000000000" })
                await forceEther.destroyAndSend(this.token.address)
                await assertRevert(this.controller.requestReclaimEther({ from: mintKey }))
            })
        })

        describe('requestReclaimToken', function () {
            it('reclaims token', async function () {
                await this.token.transfer(this.token.address, 40*10**18, { from: oneHundred })
                await this.controller.requestReclaimToken(this.token.address, { from: owner })
                await assertBalance(this.token, owner, 40*10**18)
            })

            it('cannot be called by non-owner', async function () {
                await this.token.transfer(this.token.address, 40*10**18, { from: oneHundred })
                await assertRevert(this.controller.requestReclaimToken(this.token.address, { from: mintKey }))
            })
        })

        describe('Staking Fees', function () {
            it('changes fees', async function () {
                await this.controller.changeStakingFees(1, 2, 3, 4, 5, 6, 7, 8, { from: owner })
                const transferFeeNumerator = await this.token.transferFeeNumerator()
                assert.equal(transferFeeNumerator, 1)
                const transferFeeDenominator = await this.token.transferFeeDenominator()
                assert.equal(transferFeeDenominator, 2)
                const mintFeeNumerator = await this.token.mintFeeNumerator()
                assert.equal(mintFeeNumerator, 3)
                const mintFeeDenominator = await this.token.mintFeeDenominator()
                assert.equal(mintFeeDenominator, 4)
                const mintFeeFlat = await this.token.mintFeeFlat()
                assert.equal(mintFeeFlat, 5)
                const burnFeeNumerator = await this.token.burnFeeNumerator()
                assert.equal(burnFeeNumerator, 6)
                const burnFeeDenominator = await this.token.burnFeeDenominator()
                assert.equal(burnFeeDenominator, 7)
                const burnFeeFlat = await this.token.burnFeeFlat()
                assert.equal(burnFeeFlat, 8)
            })

            it('cannot be called by non-owner', async function () {
                await assertRevert(this.controller.changeStakingFees(1, 2, 3, 4, 5, 6, 7, 8, { from: mintKey }))
            })
        })
    })
