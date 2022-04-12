require('@nomiclabs/hardhat-etherscan');
require('@nomiclabs/hardhat-waffle');
const networks = require('./networks');
const api = require('./apiKeys');

module.exports = {
  solidity: "0.8.13",
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
