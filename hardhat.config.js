require('@nomiclabs/hardhat-etherscan');
require('@nomiclabs/hardhat-waffle');
const networks = require('./networks');
const api = require('./apiKeys');

module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.13",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          }
        },
      },
      {
        version: "0.5.16",
      }
    ]
  },
  networks: {
    bsc: {
      url: networks.bsc.url,
    }
  },
  etherscan: {
    apiKey: {
      bsc: api.bsc,
    }
  }
};
