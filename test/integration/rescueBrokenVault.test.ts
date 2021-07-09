import { forkChain } from './suite'
import { setupDeploy } from 'scripts/utils'
import {
  Erc20__factory,
  OwnedUpgradeabilityProxy__factory,
  TrueFiVault__factory,
} from 'contracts'
import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'

use(solidity)

describe('rescueBrokenVault', () => {
  const TRU_ADDRESS = '0x4C19596f5aAfF459fA38B0f7eD92F11AE6543784'
  const VAULT_PROXY = '0xbf40E7162a3B00072EE151962296c2E1E71db519'
  const OWNER = '0xe3c9ec7A9137e282f33872De8dB735b9D6404942'
  const PROXY_OWNER = '0x16cea306506c387713c70b9c1205fd5ac997e78e'
  const provider = forkChain('https://eth-mainnet.alchemyapi.io/v2/Vc3xNXIWdxEbDOToa69DhWeyhgFVBDWl', [OWNER, PROXY_OWNER])
  const owner = provider.getSigner(OWNER)
  const powner = provider.getSigner(PROXY_OWNER)
  const deployContract = setupDeploy(owner)

  it('rescueBrokenVault', async () => {
    const tru = Erc20__factory.connect(TRU_ADDRESS, owner)
    const proxy = OwnedUpgradeabilityProxy__factory.connect(VAULT_PROXY, powner)
    const vault = TrueFiVault__factory.connect(VAULT_PROXY, owner)

    const originalProxyOwnerAmount = await tru.balanceOf(PROXY_OWNER)
    const originalVaultAmount = await tru.balanceOf(VAULT_PROXY)
    console.log(`original proxy owner amount: ${originalProxyOwnerAmount}`)
    console.log(`original vault amount: ${originalVaultAmount}`)

    const rescueImpl = await deployContract(TrueFiVault__factory)
    await vault.connect(owner).transferOwnership(PROXY_OWNER)
    await vault.connect(powner).claimOwnership()
    await proxy.upgradeTo(rescueImpl.address)
    await vault.withdrawToOwner()
    
    const finalProxyOwnerAmount = await tru.balanceOf(PROXY_OWNER)
    const finalVaultAmount = await tru.balanceOf(VAULT_PROXY)
    console.log(`final proxy owner amount: ${finalProxyOwnerAmount}`)
    console.log(`final vault amount: ${finalVaultAmount}`)

    expect(finalProxyOwnerAmount).to.equal(originalProxyOwnerAmount.add(originalVaultAmount))
    expect(finalVaultAmount).to.equal(0)
  })
})
