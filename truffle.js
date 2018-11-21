require('babel-register');
require('babel-polyfill');

var HDWalletProvider = require("truffle-hdwallet-provider");

module.exports = {
  solc: {
    optimizer: {
      enabled: true,
      runs: 2000000000
    }
  },
  networks: {
    development: {
      host: "localhost",
      port: 8545,
      gas: 7990000,
      gasPrice: 1, // Specified in Wei
      network_id: "*" // Match any network id
    },
    ropsten: {
      provider: new HDWalletProvider(process.env.MNEMONIC, "https://ropsten.infura.io/"),
      network_id: "3",
      gas: 7990000,
      gasPrice: 22000000000 // Specified in Wei
    },
    kovan: {
      provider: new HDWalletProvider(process.env.MNEMONIC, "https://kovan.infura.io/"),
      network_id: "42",
      gas: 7200000,
      gasPrice: 22000000000 // Specified in Wei
    },
    coverage: {
      host: "localhost",
      network_id: "*",
      port: 8525,
      gas: 10000000000000,
      gasPrice: 0x01,
    },
    rinkeby: {
      provider: new HDWalletProvider(process.env.MNEMONIC, "https://rinkeby.infura.io/"),
      network_id: "4",
      gas: 7200000,
      gasPrice: 22000000000 // Specified in Wei
    },
    production: {
      provider: new HDWalletProvider(process.env.MNEMONIC, "https://mainnet.infura.io/dYWKKqsJkbv9cZlQFEpI "),
      network_id: "1",
      gas: 7990000,
      gasPrice: 7000000000
    },
  }
};
