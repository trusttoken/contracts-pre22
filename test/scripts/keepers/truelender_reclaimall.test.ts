import { expect } from 'chai'
import { Contract, Wallet, providers } from 'ethers'
import { MockTrueLender, MockTrueLenderFactory, TrueLenderReclaimer } from 'contracts'
import { beforeEachWithFixture } from 'utils'
import { main } from '../../../scripts/keepers/truelender_reclaimall'

describe('TrueLenderReclaimer keeper autotask', function() {
  let owner: Wallet
  let otherWallet: Wallet
  let provider: providers.JsonRpcProvider

  let lender: MockTrueLender
  let reclaimer: TrueLenderReclaimer

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner, otherWallet] = wallets
    provider = _provider

    lender = await new MockTrueLenderFactory(owner).deploy()
    reclaimer = await new TrueLenderReclaimer(lender.address)
  });

  // Emulates autotask run
  const run = () => main(otherWallet, reclaimer.address);

  it("triggers reclaimer", async function () {
    // const txCount = await lender.getTransactionCount();
    // await reclaimer.requestWork();
    // await run();
    // expect(await lender.getTransactionCount()).to.eq(txCount + 1);
    // expect(await reclaimer.needsWork()).to.be.false;
  });
});