import { Wallet, ethers } from 'ethers'

export const setupDeployer = (wallet: Wallet) => async (contractName: string, ...args) => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const contractJson = require(`../build/${contractName}.json`)
  const deployTransaction = new ethers.ContractFactory(
    contractJson.abi,
    contractJson.bytecode,
  ).getDeployTransaction(...args, { gasLimit: 4004588 })

  let transaction
  let receipt

  let transactionSuccess = false
  while (!transactionSuccess) {
    try {
      transaction = await wallet.sendTransaction(deployTransaction)
      transactionSuccess = true
    } catch (e) {
      console.log(JSON.stringify(e))
      console.log('Retrying')
    }
  }

  let awaitingSuccess = false
  while (!awaitingSuccess) {
    try {
      receipt = await wallet.provider.waitForTransaction(transaction.hash)
      awaitingSuccess = true
    } catch (e) {
      console.log(JSON.stringify(e))
      console.log('Retrying')
    }
  }

  console.log(`${contractName} address: ${receipt.contractAddress}`)
  return new ethers.Contract(receipt.contractAddress, contractJson.abi, wallet)
}

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
