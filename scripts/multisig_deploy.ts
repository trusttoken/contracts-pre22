/**
 * ts-node scripts/multisig_deploy.ts "{private_key}" "{network}"
 */
import { ethers, providers } from 'ethers'
import { MultiSigOwnerFactory } from '../build/types/MultiSigOwnerFactory'

async function deployMultisig () {
  const provider = new providers.InfuraProvider(process.argv[3], '81447a33c1cd4eb09efb1e8c388fb28e')
  const wallet = new ethers.Wallet(process.argv[2], provider)

  const multisigImp = await (await new MultiSigOwnerFactory(wallet).deploy()).deployed()
  console.log(multisigImp.address)
}

deployMultisig().catch(console.error)
