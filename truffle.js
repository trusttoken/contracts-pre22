require('babel-register');
require('babel-polyfill');

var HDWalletProvider = require("truffle-hdwallet-provider");

module.exports = {
  networks: {
    development: {
      host: "localhost",
      port: 8545,
      gas: 6600000,
      network_id: "*" // Match any network id
    },
    ropsten: {
      provider: new HDWalletProvider(process.env.MNEMONIC, "https://ropsten.infura.io/"),
      network_id: "3",
      gas: 6600000,
      gasPrice: 22000000000 // Specified in Wei
    },
    rinkeby: {
      provider: new HDWalletProvider(process.env.MNEMONIC, "https://rinkeby.infura.io/"),
      network_id: "4",
      gas: 6600000,
      gasPrice: 22000000000 // Specified in Wei
    },
    production: {
      provider: new HDWalletProvider(process.env.MNEMONIC, "https://mainnet.infura.io/dYWKKqsJkbv9cZlQFEpI "),
      network_id: "1",
      gas: 6600000,
      gasPrice: 7000000000
    },
  }
};
