const { expect, assert } = require('chai');
const { ethers } = require('hardhat');

const waffle = require('ethereum-waffle');
const MockProvider = waffle.MockProvider;
const deployContract = waffle.deployContract;
const solidity = waffle.solidity;
const createFixtureLoader = waffle.createFixtureLoader;
const ethersContract = require('ethers');
const Contract = ethersContract.Contract;

const fixtures = require('./fixtures');

describe('Parachute SPT Calls', async () => {
    const provider = new MockProvider();
    const [wallet, otherA, otherB] = provider.getWallets();

    let par;
    let usdc;
    let weth;
    let spt;
    let sptCall;
    let parPair;
    let usdcPair;
    let pckFactory;

    it('has deployed the setup', async () => {
        const fixture = await fixtures.sptCallFixture(provider, [wallet, otherA, otherB]);
        par = fixture.par;
        usdc = fixture.usdc;
        weth = fixture.weth;
        spt = fixture.spt;
        sptCall = fixture.sptCall;
        parPair = fixture.parPair;
        usdcPair = fixture.usdcPair;
        pckFactory = fixture.pckFactory;
        expect(await sptCall.asset()).to.eq(par.address);
        expect(await sptCall.pymtCurrency()).to.eq(usdc.address);
        expect(await sptCall.spt()).to.eq(spt.address);
        expect(await sptCall.weth()).to.eq(weth.address);
        expect(await sptCall.uniFactory()).to.eq(pckFactory.address);
        console.log(parPair.address);
        expect(await sptCall.assetPair()).to.eq(parPair.address);
        expect(await sptCall.paymentPair()).to.eq(usdcPair.address);
        expect(await sptCall.cashCloseOn()).to.eq(true);
        
    });

    // let callParams = {

    // }
    // it('creates a new single ask', async (callParams) => {

    // })
})