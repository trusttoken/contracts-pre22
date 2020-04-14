const setupDeployer = (ethers, wallet) => async (contractName, ...args) => {
    const contractJson = require(`../build/${contractName}.json`)
    const deployTransaction = new ethers.ContractFactory(
        contractJson.abi,
        contractJson.bytecode
    ).getDeployTransaction(...args)
    
    const transaction = await wallet.sendTransaction(deployTransaction, { gas: 40000000 })
    const receipt = await wallet.provider.waitForTransaction(transaction.hash)
    
    console.log(`${contractName} address: ${receipt.contractAddress}`)
    return new ethers.Contract(receipt.contractAddress, contractJson.abi, wallet) 
}

const validatePrivateKey = (subject) => {
    if (!(/^0x[0-9-a-fA-F]{64}$/.test(subject))) throw new Error('Pass proper private key')
}

module.exports =  {
    setupDeployer,
    validatePrivateKey,
}