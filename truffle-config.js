const HDWalletProvider = require('@truffle/hdwallet-provider');
const fs = require('fs');
const web3 = require('web3');
const mnemonic = fs.readFileSync("mnemonic").toString().trim();

module.exports = {
  networks: {
      development: {
         host: "127.0.0.1",
         port: 8545,
         network_id: "*"
      },
      localDeployment: {
          host: "127.0.0.1",
          port: 7545,
          network_id: "*"
      },
      fantomTestnet: {
          provider: () => new HDWalletProvider(mnemonic, 'https://rpc.testnet.fantom.network/'),
          network_id: 0xfa2,
          confirmation: 10,
          timeoutBlocks: 200,
          skipDryRun: true
      }
  },
  
  compilers: {
    solc: {
      version: "0.6.12"
    }
  }
};
