import { Wallet, ethers, ContractFactory } from 'ethers'
import { deployContract } from 'ethereum-waffle'
import fs from 'fs'
import readline from 'readline'

export const txnArgs = { gasLimit: 2_000_000, gasPrice: 16_000_000_000 }

// eslint-disable-next-line @typescript-eslint/no-var-requires
export const getContractJSON = (contractName: string) => require(`../build/${contractName}.json`)

const confirmDeploy = async (contractName: string) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise<boolean>(resolve => {
    rl.question(`Deploy ${contractName}? (Y/n) `, (answer) => {
      rl.close()
      if (['n', 'no'].includes(answer.toLowerCase())) {
        resolve(false)
      } else {
        resolve(true)
      }
    })
  })
}

export const setupDeployer = (wallet: Wallet) => async (contractName: string, ...args) => {
  const contractJson = getContractJSON(contractName)
  if (await confirmDeploy(contractName)) {
    const contract = await deployContract(wallet, contractJson, args, txnArgs)
    console.log(`${contractName} address: ${contract.address}`)
    return contract
  } else {
    process.exit(0)
  }
}

export const deployBehindCustomProxy = (proxyName: string) => async (wallet: Wallet, contractName: string, ...args) => {
  const deploy = setupDeployer(wallet)
  const implementation = await deploy(contractName, ...args)
  const proxy = await deploy(proxyName)
  const contract = implementation.attach(proxy.address)
  console.log(`deployed ${contractName}Proxy at: `, contract.address)

  return [implementation, proxy, contract]
}

export const deployBehindProxy = deployBehindCustomProxy('OwnedUpgradeabilityProxy')
export const deployBehindTimeProxy = deployBehindCustomProxy('TimeOwnedUpgradeabilityProxy')

export const getContract = (wallet: ethers.Wallet) => (contractName: string, contractAddress: string) => {
  const contractJson = getContractJSON(contractName)
  return new ethers.Contract(contractAddress, contractJson.abi, wallet)
}

export const validatePrivateKey = (subject: string) => {
  if (!(/^0x[0-9-a-fA-F]{64}$/.test(subject))) throw new Error('Pass proper private key')
}

export const validateAddress = (subject: string) => {
  try {
    ethers.utils.getAddress(subject)
  } catch (e) {
    throw new Error('Pass proper deploy helper address')
  }
}

export type Newable<T> = { new (...args: any[]): T };

export const setupDeploy = (wallet: Wallet) => async <T extends ContractFactory>(Factory: Newable<T>, ...args: Parameters<T['deploy']>): Promise<ReturnType<T['deploy']>> => {
  const contract = await new Factory(wallet).deploy(...args)
  await contract.deployed()
  return contract
}

export const saveDeployResult = (fileName: string) => async (result: unknown) => {
  console.log('saving results...')
  if (!fs.existsSync('./scripts/deploy')) {
    fs.mkdirSync('./scripts/deploy')
  }
  fs.writeFileSync(`./scripts/deploy/${fileName}.json`, JSON.stringify(result, null, 2))
}

export { ask } from './ask'
export { toTrustToken } from './toTrustToken'
