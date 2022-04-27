const { expect, assert } = require('chai');
const { ethers } = require('hardhat');

const waffle = require('ethereum-waffle');
const MockProvider = waffle.MockProvider;
const deployContract = waffle.deployContract;
const solidity = waffle.solidity;
const createFixtureLoader = waffle.createFixtureLoader;
const ethersContract = require('ethers');
const Contract = ethersContract.Contract;
const BigNumber = ethersContract.BigNumber;

const fixtures = require('./fixtures');
const constants = require('./constants');

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
    let fixture

    it('has deployed the setup', async () => {
        fixture = await fixtures.sptCallFixture(provider, [wallet, otherA, otherB]);
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
        expect(await sptCall.assetPair()).to.eq(parPair.address);
        expect(await sptCall.paymentPair()).to.eq(usdcPair.address);
        expect(await sptCall.cashCloseOn()).to.eq(true);
    });

    it('creates two new single asks', async () => {
        let expiry = constants.IN_TEN_MINS;
        console.log(`in ten mins: ${expiry}`);
        let assetAmount = constants.E18_100;
        let strike = constants.E18_01;
        let price = constants.E18_10;
        // creat a new ask
        await expect(sptCall.newAsk(assetAmount, strike, price, expiry))
        .to.emit(sptCall, 'NewAsk')
        .withArgs('1', assetAmount, strike, price, expiry);
        // test the following:
        // asset amount is in the sptCall address
        let currentBalance = await par.balanceOf(sptCall.address);
        expect(currentBalance).to.eq(assetAmount);
        // check the struct is created
        const call = await sptCall.calls(1);
        expect(call[0]).to.eq(wallet.address);
        expect(call[1]).to.eq(assetAmount);
        expect(call[2]).to.eq(strike);
        expect(call[3]).to.eq(constants.E18_10);
        expect(call[4]).to.eq(price);
        expect(call[5]).to.eq(expiry);
        expect(call[6]).to.eq(false);
        expect(call[7]).to.eq(true);
        expect(call[8]).to.eq(wallet.address);
        expect(call[9]).to.eq(false);
        // check that the call is pushed into the array
        let callInArray = await sptCall.newCalls(0);
        expect(callInArray).to.eq('1');
        assetAmount = constants.E18_10;
        await expect(sptCall.newAsk(assetAmount, strike, price, expiry))
        .to.emit(sptCall, 'NewAsk')
        .withArgs('2', assetAmount, strike, price, expiry);
        callInArray = await sptCall.newCalls(1);
        expect(callInArray).to.eq('2');
        let callArray = await sptCall.getAllNewCalls();
        expect(callArray.length).to.eq(2);
        let newBalance = await par.balanceOf(sptCall.address);
        expect((newBalance - currentBalance).toString()).to.eq(assetAmount);
     });

     it('creates bulk newAsks', async () => {
        let expiry = constants.IN_FIVE_MINS;
        let expiryArray = [expiry, expiry, expiry, expiry, expiry, expiry, expiry, expiry, expiry, expiry];
        let assetAmount = constants.E18_100;
        let assetArray = [assetAmount, assetAmount, assetAmount, assetAmount, assetAmount, assetAmount, assetAmount, assetAmount, assetAmount, assetAmount];
        let strike = constants.E18_1;
        let strikeArray = [strike, strike, strike, strike, strike, strike, strike, strike, strike, strike];
        let price = constants.E18_1;
        let priceArray = [price, price, price, price, price, price, price, price, price, price];
        await sptCall.bulkNewAsk(assetArray, strikeArray, priceArray, expiryArray);
        // check the balance change

        callArray = await sptCall.getAllNewCalls();
        const bulkCalls = await sptCall.getNewCallsByDetails(assetAmount, strike, price, expiry);
        console.log(bulkCalls);
        expect(callArray.length).to.eq(12);
        for (i = 3; i <= callArray.length; i++) {
            //skip 1 and 2 since we created those earlier
            //check that we created all 10 calls with the right struct
            let call = await sptCall.calls(i);
            expect(call[0]).to.eq(wallet.address);
            expect(call[1]).to.eq(assetAmount);
            expect(call[2]).to.eq(strike);
            expect(call[3]).to.eq(constants.E18_100);
            expect(call[4]).to.eq(price);
            expect(call[5]).to.eq(expiry);
            expect(call[6]).to.eq(false);
            expect(call[7]).to.eq(true);
            expect(call[8]).to.eq(wallet.address);
            expect(call[9]).to.eq(false);
        }
     });
     it('cancels a new ask, index 7', async () => {
        console.log(`get index of item 7: ${await sptCall.newCallsIndex(7)}`);
        await expect(sptCall.cancelNewAsk('7'))
        .to.emit(sptCall, 'OptionCancelled')
        .withArgs('7');
        let assetAmount = constants.E18_100;
        let strike = constants.E18_1;
        let price = constants.E18_1;
        let expiry = constants.IN_FIVE_MINS;
        const bulkCalls = await sptCall.getNewCallsByDetails(assetAmount, strike, price, expiry);
        console.log(bulkCalls);
        //check call 7
        let call = await sptCall.calls('7');
        expect(call[0]).to.eq(wallet.address);
        // check the booleans update
        expect(call[7]).to.eq(false);
        expect(call[9]).to.eq(true);
        //check that its been removed from the array and mapping
        let callArray = await sptCall.getAllNewCalls();
        expect(callArray.length).to.eq(11);
        for (i = 0; i < callArray.length; i++) {
            let callId = await sptCall.newCalls(i);
            // just confirm it never equals 7
            expect(callId).to.not.eq('7');
        }
     });
    it('buys a new option', async () => {
        // buy call option 0
        let call = await sptCall.calls(1);
        const buyReceipt = await sptCall.connect(otherA).buyNewOption('1');
        await expect(buyReceipt).to.emit(sptCall, 'NewOptionBought').withArgs('1')
        .to.emit(spt, 'Transfer').withArgs(otherA.address, constants.ZERO_ADDRESS, call[4]); 
        call = await sptCall.calls(1);
        expect(call[6]).to.eq(true);
        expect(call[7]).to.eq(false);
        expect(call[8]).to.eq(otherA.address);
        expect(call[9]).to.eq(false);
        //expect them to have a balance now
        expect(await sptCall.balanceOf(otherA.address)).to.eq(1);
        const ownerArray = await sptCall.getAllOwnersCalls(otherA.address);
        expect(ownerArray.length).to.eq(1);
        console.log(ownerArray[0]);
      });
    it('physically exercises an option', async () => {
        const exercise = await sptCall.connect(otherA).exercise('1');
        await expect(exercise).to.emit(sptCall, 'OptionExercised').withArgs('1', false);
        expect(await sptCall.balanceOf(otherA.address)).to.eq(0);
    });
    it('cash closes an option', async() => {
        await sptCall.connect(otherB).buyNewOption('2');
        let call = await sptCall.calls(1);
        const cashClose = sptCall.connect(otherB).cashClose('2', true);
        await expect(cashClose).to.emit(sptCall, 'OptionExercised').withArgs('2', true);
    });
    it('returns and expired options', async () => {
        let expiry = (Math.round(Date.now() / 1000) + (5)).toString()
        await sptCall.newAsk(constants.E18_10, constants.E18_10, constants.E18_10, expiry);
        const callArray = await sptCall.getAllNewCalls();
        let c = await sptCall.newCalls(callArray.length - 1);
        await sptCall.connect(otherA).buyNewOption(c);
        await new Promise((resolve) => setTimeout(resolve, 6000));
        await sptCall.returnExpired(c);
    });
});