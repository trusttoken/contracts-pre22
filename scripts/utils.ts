import { Wallet, ethers } from 'ethers'
import { deployContract } from 'ethereum-waffle'
import fs from 'fs'

export const setupDeployer = (wallet: Wallet) => async (contractName: string, ...args) => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const contractJson = require(`../build/${contractName}.json`)
  const contract = await deployContract(wallet, contractJson, args, { gasLimit: 4004588 })

  console.log(`${contractName} address: ${contract.address}`)
  return contract
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
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const contractJson = require(`../build/${contractName}.json`)
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

export const saveDeployResult = (fileName: string) => async (result: {}) => {
  console.log('saving results...')
  if (!fs.existsSync('./scripts/deploy')) {
    fs.mkdirSync('./scripts/deploy')
  }
  fs.writeFileSync(`./scripts/deploy/${fileName}.json`, JSON.stringify(result, null, 2))
}
