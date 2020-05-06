const setupDeployer = (ethers, wallet) => async (contractName, ...args) => {
  const contractJson = require(`../build/${contractName}.json`)
  const deployTransaction = new ethers.ContractFactory(
    contractJson.abi,
    contractJson.bytecode,
  ).getDeployTransaction(...args)

  let transaction
  let receipt

  let transactionSuccess = false
  while (!transactionSuccess) {
    try {
      transaction = await wallet.sendTransaction(deployTransaction, { gas: 4004588 })
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

const getContract = (ethers, wallet) => async (contractName, contractAddress) => {
  const contractJson = require(`../build/${contractName}.json`)
  return new ethers.Contract(contractAddress, contractJson.abi, wallet)
}

const validatePrivateKey = (subject) => {
  if (!(/^0x[0-9-a-fA-F]{64}$/.test(subject))) throw new Error('Pass proper private key')
}

module.exports = {
  setupDeployer,
  getContract,
  validatePrivateKey,
}
