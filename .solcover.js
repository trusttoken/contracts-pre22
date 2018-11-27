module.exports = {
    testCommand: 'node --max-old-space-size=4096 ../node_modules/.bin/truffle test --network coverage',
    compileCommand: 'node --max-old-space-size=4096 ../node_modules/.bin/truffle compile --network coverage',
    skipFiles: ['Migrations.sol', 'mocks', 'deployed/V1.sol', 'deployed/0x8dd5fbCe2F6a956C3022bA3663759011Dd51e73E.sol', 'deployed/0x9978d2D229A69B3aEf93420D132aB22b44e3578F.sol'],
    copyPackages: ['openzeppelin-solidity'],
}
