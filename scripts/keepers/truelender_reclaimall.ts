const { ethers } = require("ethers");
const { DefenderRelaySigner, DefenderRelayProvider } = require('defender-relay-client/lib/ethers');

// Definition for TrueLenderReclaimer
const ABI = [{"inputs": [{"internalType": "contract TrueLender","name": "lender","type": "address"}],"stateMutability": "nonpayable","type": "constructor"},{"anonymous": false,"inputs": [{"indexed": true,"internalType": "address","name": "loanToken","type": "address"}],"name": "Reclaimed","type": "event"},{"inputs": [],"name": "_lender","outputs": [{"internalType": "contract TrueLender","name": "","type": "address"}],"stateMutability": "view","type": "function"},{"inputs": [],"name": "reclaimAll","outputs": [],"stateMutability": "nonpayable","type": "function"}];
const ADDRESS = '0xTODO_FILL_THIS_IN';

// Work on job using a Defender relay signer
async function reclaimAll(signer, address) {
  const contract = new ethers.Contract(address, ABI, signer);
  const tx = await contract.reclaimAll();
  console.log(`Reclaimed all: ${tx.hash}`);
}

// Entrypoint for the Autotask
exports.handler = async function(credentials) {
  const provider = new DefenderRelayProvider(credentials);;
  const signer = new DefenderRelaySigner(credentials, provider, { speed: 'fastest' });
  await reclaimAll(signer, ADDRESS);
}

// Unit testing
exports.main = reclaimAll;

// To run locally (this code will not be executed in Autotasks)
if (require.main === module) {
  require('dotenv').config();
  const { API_KEY: apiKey, API_SECRET: apiSecret } = process.env;
  exports.handler({ apiKey, apiSecret })
    .then(() => process.exit(0))
    .catch(error => { console.error(error); process.exit(1); });
}