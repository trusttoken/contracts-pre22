import "hardhat-typechain";
import "@nomiclabs/hardhat-waffle"
import "solidity-coverage"
import "./abi-exporter"
import "tsconfig-paths/register";

import mocharc from "./.mocharc.json"

module.exports = {
  paths: {
    sources: "./contracts",
    artifacts: "./build",
    cache: "./cache",
  },
  abiExporter: {
    path: './build',
    flat: true,
    spacing: 2
  },
  networks: {
    hardhat: {
      initialDate: "2020-01-01T00:00:00",
      allowUnlimitedContractSize: true,
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
  mocha: {
    ...mocharc
  }
}
