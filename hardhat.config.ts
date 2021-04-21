import "hardhat-typechain";
import "@nomiclabs/hardhat-waffle"

module.exports = {
  paths: {
    sources: "./contracts",
    artifacts: "./build",
    cache: "./cache",
  },
  networks: {
    hardhat: {
      initialDate: "2020-01-01T00:00:00",
    },
  },
  typechain: {
    outDir: "build/types",
    target: "ethers-v5",
  },
  solidity: {
    version: "0.6.10",
    settings: {
      optimizer: {
        enabled: true,
        runs: 20000,
      },
    },
  },
}
