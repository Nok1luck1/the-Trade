require("@nomiclabs/hardhat-waffle");
require('@nomiclabs/hardhat-ethers');
require("@nomiclabs/hardhat-etherscan");
require('@openzeppelin/hardhat-upgrades');


const dotenv = require("dotenv");
dotenv.config({path: __dirname + '/.env'});
const {PRIVATE_KEY } = process.env;

task("accounts", "Prints the list of accounts", async () => {
  const accounts = await ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    localhost: {
      url: "http://127.0.0.1:7545"
    },
    polygonTest: {
      url: "https://polygon-mumbai.infura.io/v3/c0846c0936794c209285d51868f1ad77",
      chainId: 13881,
      gasPrice: 1900000000,
      accounts: [PRIVATE_KEY]
    },
    polygonMain: {
      url: "https://polygon-mainnet.infura.io/v3/c0846c0936794c209285d51868f1ad77",
      chainId: 89,
      gasPrice: 20e9,
      accounts: [PRIVATE_KEY]
    },
    hardhat: {
      blockGasLimit: 200e9,
      gasPrice: 875000000,
    },
    mainnetBSC: {
      url: "https://bsc-dataseed.binance.org/",
      chainId: 56,
      gasPrice: 20e9,
      accounts: [PRIVATE_KEY]
    },
    testnetBSC: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      gasPrice: 20e9,
      accounts: [PRIVATE_KEY]
    },
    rinkeby:{
      url:'https://rinkeby.infura.io/v3/c0846c0936794c209285d51868f1ad77',
      chainId:4,
      gasPrice: 1900000000,
      accounts:[PRIVATE_KEY]
    },
    goerli:{
      url:'https://goerli.infura.io/v3/c0846c0936794c209285d51868f1ad77',
      chainId:5,
      gasPrice: 200000000000,
      accounts:[PRIVATE_KEY]
    },
    ropsten:{
      url:'https://ropsten.infura.io/v3/c0846c0936794c209285d51868f1ad77',
      chainId:3,
      gasPrice: 1200000000,
      accounts:[PRIVATE_KEY]
    },
    palmTest:{
      url:'https://palm-testnet.infura.io/v3/c0846c0936794c209285d51868f1ad77',
      chainId:4,
      gasPrice: 1900000000,
      accounts:[PRIVATE_KEY]
    },
    nearTest:{
      url:'https://near-testnet.infura.io/v3/c0846c0936794c209285d51868f1ad77',
      chainId:4,
      gasPrice: 1900000000,
      accounts:[PRIVATE_KEY]
    },
    Starknet:{
      url:'https://starknet-mainnet.infura.io/v3/c0846c0936794c209285d51868f1ad77',
      chainId:4,
      gasPrice: 1900000000,
      accounts:[PRIVATE_KEY]
    },
    StarknetTest:{
      url:'https://starknet-goerli.infura.io/v3/c0846c0936794c209285d51868f1ad77',
      chainId:4,
      gasPrice: 1900000000,
      accounts:[PRIVATE_KEY]
    },
    Avaxfuji: {
      url: 'https://api.avax-test.network/ext/bc/C/rpc',
      chainId: 43113,
      accounts: [PRIVATE_KEY]
    },
    moonrivermain:{
      url:'https://rpc.moonriver.moonbeam.network',
      chainId:1285,
      accounts: [PRIVATE_KEY]
    },
    moonbeamtest:{
      url:'https://rpc.testnet.moonbeam.network',
      chainId:1287,
      accounts: [PRIVATE_KEY]
    }
  },
  etherscan: {
    apiKey:{
        ropsten: "H976DUPQP2KFCFB84ZTTC2GW6RHIHEEWRK",
        mainnet: "H976DUPQP2KFCFB84ZTTC2GW6RHIHEEWRK",
        ropsten: "H976DUPQP2KFCFB84ZTTC2GW6RHIHEEWRK",
        rinkeby: "H976DUPQP2KFCFB84ZTTC2GW6RHIHEEWRK",
        goerli: "H976DUPQP2KFCFB84ZTTC2GW6RHIHEEWRK",
        kovan: "H976DUPQP2KFCFB84ZTTC2GW6RHIHEEWRK",
        bsc: "WES9KS3YFTT6VZU92TRA3TIK3GBZI3E1U2",
        bscTestnet: "WES9KS3YFTT6VZU92TRA3TIK3GBZI3E1U2",
        heco: "6TJU13WA357W1YFIQI3S9HM2GVF1E7WZEI",
        hecoTestnet: "6TJU13WA357W1YFIQI3S9HM2GVF1E7WZEI",
        opera: "GW6QZKHE1NMBJF25YJBJCPUA1RMJA2DQNS",
        ftmTestnet: "GW6QZKHE1NMBJF25YJBJCPUA1RMJA2DQNS",
        optimisticEthereum: "KW65HGUSMTTVR8NDX9FJ986JTWC2HUY4UV",
        optimisticKovan: "KW65HGUSMTTVR8NDX9FJ986JTWC2HUY4UV",
        polygon: "YNW28KKR9B2IZ62ARK2SEIW2D41ZMWJD5R",
        polygonMumbai: "YNW28KKR9B2IZ62ARK2SEIW2D41ZMWJD5R",
        arbitrumOne: "NRFSTYK86TXES95DKF731NKWR3JNTTHS7K",
        arbitrumTestnet: "NRFSTYK86TXES95DKF731NKWR3JNTTHS7K",
        avalanche: "1KVXGRF1KI292HTYBQGGA5UB3UXGV29HI5",
        avalancheFujiTestnet: "1KVXGRF1KI292HTYBQGGA5UB3UXGV29HI5",
        moonriver: "U9VSKKU8STYVITYCFMP225JYXJPW9Q8453",
        moonbaseAlpha: "U9VSKKU8STYVITYCFMP225JYXJPW9Q8453S",
        xdai: "api-key",
        sokol: "api-key",
  },
  // gasReporter: {
  //   //coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  //   currency: "USD",
  //   //enabled: process.env.REPORT_GAS === "true",
  //   //excludeContracts: ["contracts/mocks/", "contracts/libraries/"],
  // }
  },
  solidity: {
    compilers: [
      {
        version: "0.8.9",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          }
        }
      },  
      
    ],
    outputSelection: {
      "*": {
        "*": ["storageLayout"]
      }
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  mocha: {
    //reporter: 'eth-gas-reporter',
    timeout: 200000
  }
};