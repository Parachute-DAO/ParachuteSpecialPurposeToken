const { expect } = require('chai');
const { ethers } = require('hardhat');

const waffle = require('ethereum-waffle');
const MockProvider = waffle.MockProvider;
const deployContract = waffle.deployContract;
const solidity = waffle.solidity;
const ethersContract = require('ethers');
const Contract = ethersContract.Contract;
const WETH = require('@thenextblock/hardhat-weth');
const constants = require('./constants');

const Token = require('../artifacts/contracts/token/Token.sol/Token.json');
const SPT = require('../artifacts/contracts/token/Special_Purpose_Token.sol/Special_Purpose_Token.json');
const SPTCall = require('../artifacts/contracts/ParachuteSPTCalls.sol/ParachuteSPTCalls.json');
const PancakeFactory = require('../artifacts/contracts/Pancake/contracts/PancakeFactory.sol/PancakeFactory.json');
const PancakePair = require('../artifacts/contracts/Pancake/contracts/PancakePair.sol/PancakePair.json');

async function tokenFixture(provider, [wallet], name, symbol, mintAmount) {
    const token = await deployContract(wallet, Token, [name, symbol, mintAmount]);
    return token;
}

async function sptFixture(provider, [wallet, receiverA, receiverB]) {
    const spt = await deployContract(wallet, SPT);
    //mint the SPTs to various wallets
    await spt.mintTo([receiverA.address, receiverB.address], [constants.E18_100, constants.E18_100]);
    return spt;
}

async function pckFactoryFixture(provider, [wallet]) {
    const pckFactory = await deployContract(wallet, PancakeFactory, [wallet.address]);
    return pckFactory;
}

async function pckPairs(provider, [wallet]) {
    const pckFactory = await pckFactoryFixture(provider, [wallet]);
    const par = await tokenFixture(provider, [wallet], 'parachute', 'par', constants.E18_10000);
    const usdc = await tokenFixture(provider, [wallet], 'usdc', 'usdc', constants.E18_10000);
    const weth = await WETH.deployWeth(wallet)
    await pckFactory.createPair(par.address, weth.address);
    const parPairAddress = await  pckFactory.getPair(par.address, weth.address);
    const parPair = new ethers.Contract(parPairAddress, PancakePair.abi, wallet);
    await pckFactory.createPair(usdc.address, weth.address);
    const usdcPairAddress = await pckFactory.getPair(usdc.address, weth.address);
    const usdcPair = new ethers.Contract(usdcPairAddress, PancakePair.abi, wallet);
    await par.approve(parPairAddress, constants.E18_10000);
    await usdc.approve(usdcPairAddress, constants.E18_10000);
    // await par.transfer(parPairAddress, constants.E18_10000);
    // await weth.transfer(parPairAddress, constants.E18_10000);
    // await parPair.mint(wallet.address);

    // await usdc.transfer(usdcPairAddress, constants.E18_1000);
    // await weth.transfer(usdcPairAddress, constants.E18_1000);
    // await usdcPair.mint(wallet.address);
    return {
        pckFactory,
        parPair,
        usdcPair,
        par,
        usdc,
    }
}

async function sptCallFixture(provider, [wallet, otherA, otherB]) {
    const weth = await WETH.deployWeth(wallet);
    const spt = await sptFixture(provider, [wallet, otherA, otherB]);
    const pancakeSetup = await pckPairs(provider, [wallet]);
    const par = pancakeSetup.par;
    const usdc = pancakeSetup.usdc;
    const sptCall = await deployContract(wallet, SPTCall, [par.address, usdc.address, spt.address, weth.address, pancakeSetup.pckFactory.address]);
    await pancakeSetup.par.approve(sptCall.address, constants.E18_10000);
    await pancakeSetup.usdc.approve(sptCall.address, constants.E18_10000);
    await spt.approve(sptCall.address, constants.E18_10000);
    return {
        par: pancakeSetup.par,
        parPair: pancakeSetup.parPair,
        usdc: pancakeSetup.usdc,
        usdcPair: pancakeSetup.usdcPair,
        pckFactory: pancakeSetup.pckFactory,
        spt,
        sptCall,
        weth,
    }
}
module.exports = {
    sptCallFixture,
}