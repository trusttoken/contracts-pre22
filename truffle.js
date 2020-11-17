module.exports = {
  compilers: {
    solc: {
      version: "0.6.10",
      settings: {
        optimizer: {
          enabled: true,
          runs: 20000   // Optimize for how many times you intend to run the code
        }
      }
    }
  }
};
