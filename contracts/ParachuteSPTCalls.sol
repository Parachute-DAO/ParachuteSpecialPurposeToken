// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.13;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import './interfaces/Decimals.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import './interfaces/IWETH.sol';
import './interfaces/ISPT.sol';
import './interfaces/IUniswapV2Factory.sol';
import './interfaces/IUniswapV2Pair.sol';
import './interfaces/UniswapV2Library.sol';


contract ParachuteSPTCalls is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    address public asset;
    address public pymtCurrency;
    address public spt; //special purpose token address
    uint public assetDecimals;
    address public paymentPair;
    address public assetPair;
    address payable public weth;
    uint public c = 0;
    address public uniFactory;
    bool public cashCloseOn;
    

    constructor(address _asset, address _pymtCurrency, address _spt, address payable _weth, address _uniFactory) {
        asset = _asset;
        pymtCurrency = _pymtCurrency;
        spt = _spt;
        weth = _weth;
        uniFactory = _uniFactory;
        assetDecimals = Decimals(_asset).decimals();
        paymentPair = IUniswapV2Factory(uniFactory).getPair(weth, pymtCurrency);
        assetPair = IUniswapV2Factory(uniFactory).getPair(weth, asset);
        if (paymentPair != address(0x0) && assetPair != address(0x0)){
            //if neither of the currencies is weth then we can test if both asset and payment have a pair with weth
            cashCloseOn = true;
        } else {
            cashCloseOn = false;
        }
    }
    
    struct Call {
        address payable short;
        uint assetAmt;
        uint strike;
        uint totalPurch;
        uint price;
        uint expiry;
        bool open;
        bool tradeable;
        address payable long;
        bool exercised;
    }

    
    mapping (uint => Call) public calls;



    //internal and setup functions

    receive() external payable {    
    }

    function depositPymt(address _token, address _sender, uint _amt) internal {
        SafeERC20.safeTransferFrom(IERC20(_token), _sender, address(this), _amt);
    }

    function withdrawPymt(address _token, address payable to, uint _amt) internal {
        SafeERC20.safeTransfer(IERC20(_token), to, _amt);
    }

    function transferPymt(address _token, address from, address payable to, uint _amt) internal {
        SafeERC20.safeTransferFrom(IERC20(_token), from, to, _amt);         
    
    }

    //function to write a new call
    function newAsk(uint _assetAmt, uint _strike, uint _price, uint _expiry) public onlyOwner {
        uint _totalPurch = (_assetAmt * _strike) / (10 ** assetDecimals);
        require(_totalPurch > 0, "totalPurchase error: too small amount");
        uint balCheck = IERC20(asset).balanceOf(msg.sender);
        require(balCheck >= _assetAmt, "not enough to sell this call option");
        depositPymt(asset, msg.sender, _assetAmt);
        calls[c++] = Call(payable(msg.sender), _assetAmt, _strike, _totalPurch, _price, _expiry, false, true, payable(msg.sender), false);
        emit NewAsk(c -1, _assetAmt, _strike, _price, _expiry);
    }

    function bulkNewAsk(uint[] memory _assetAmt, uint[] memory _strike, uint[] memory _price, uint[] memory _expiry) public onlyOwner {
        require(_assetAmt.length == _strike.length && _strike.length == _price.length &&  _strike.length== _expiry.length);
        uint totalAmt;
        for (uint i = 0; i < _assetAmt.length; i++) {
            totalAmt += _assetAmt[i];
            uint _totalPurch = (_assetAmt[i] * _strike[i]) / (10 ** assetDecimals);
            calls[c++] = Call(payable(msg.sender), _assetAmt[i], _strike[i], _totalPurch, _price[i], _expiry[i], false, true, payable(msg.sender), false);
            emit NewAsk(c -1, _assetAmt[i], _strike[i], _price[i], _expiry[i]);
        }
        /// @dev bulk deposit the total amount
        depositPymt(asset, msg.sender, totalAmt);
    }

    function cancelNewAsk(uint _c) public nonReentrant onlyOwner {
        Call storage call = calls[_c];
        require(msg.sender == call.short && msg.sender == call.long, "only short can change an ask");
        require(!call.open, "call already open");
        require(!call.exercised, "call already exercised");
        call.tradeable = false;
        call.exercised = true;
        withdrawPymt(asset, call.short, call.assetAmt);
        emit OptionCancelled(_c);
    }

    //function to purchase a new call that hasn't changed hands yet
    function buyNewOption(uint _c) public {
        Call storage call = calls[_c];
        require(msg.sender != call.short, "this is your lost chicken");
        require(call.short != address(0x0) && call.short == call.long, "not your chicken");
        require(call.expiry > block.timestamp, "This call is already expired");
        require(!call.exercised, "This has already been exercised");
        require(call.tradeable, "This isnt tradeable yet");
        require(!call.open, "This call is already open");
        uint balCheck = IERC20(spt).balanceOf(msg.sender); //pulls SPT instead of payment currency
        require(balCheck >= call.price, "not enough to buy this call option");
        ISPT(spt).burn(msg.sender, call.price); //burns the tokens  
        call.open = true;
        call.long = payable(msg.sender);
        call.tradeable = false;
        emit NewOptionBought(_c);
    }

    function exercise(uint _c) public nonReentrant {
        Call storage call = calls[_c];
        require(call.open, "This isnt open");
        require(call.expiry >= block.timestamp, "This call is already expired");
        require(!call.exercised, "This has already been exercised!");
        require(msg.sender == call.long, "You dont own this call");
        uint balCheck = IERC20(pymtCurrency).balanceOf(msg.sender);
        require(balCheck >= call.totalPurch, "not enough to exercise this call option");
        call.exercised = true;
        call.open = false;
        call.tradeable = false;
        transferPymt(pymtCurrency, msg.sender, call.short, call.totalPurch);   
        withdrawPymt(asset, call.long, call.assetAmt);
        emit OptionExercised(_c, false);
    }

    //this is the exercise alternative for ppl who want to receive payment currency instead of the underlying asset
    function cashClose(uint _c, bool cashBack) public nonReentrant {
        require(cashCloseOn, "c: this pair cannot be cash closed");
        Call storage call = calls[_c];
        require(call.open, "c: This isnt open");
        require(call.expiry >= block.timestamp, "c: This call is already expired");
        require(!call.exercised, "c: This has already been exercised!");
        require(msg.sender == call.long, "c: You dont own this call");
        (uint assetIn,) = getTo(call.totalPurch);
        require(assetIn < (call.assetAmt), "c: Underlying is not in the money");
        call.exercised = true;
        call.open = false;
        call.tradeable = false;
        //swap(asset, call.totalPurch, assetIn, call.short);
        swapTo(call.totalPurch, call.short);     
        call.assetAmt -= assetIn;
        if (cashBack) {
            swapFrom(call.assetAmt, call.long);
        } else {
            withdrawPymt(asset, call.long, call.assetAmt);
        }
        
        emit OptionExercised(_c, true);
    }

    function returnExpired(uint _c) public nonReentrant onlyOwner {
        Call storage call = calls[_c];
        require(!call.exercised, "This has been exercised");
        require(call.expiry < block.timestamp, "Not expired yet"); 
        require(msg.sender == call.short, "You cant do that");
        call.tradeable = false;
        call.open = false;
        call.exercised = true;
        withdrawPymt(asset, call.short, call.assetAmt);
        emit OptionReturned(_c);
    }


    //************SWAP SPECIFIC FUNCTIONS USED FOR THE CASH CLOSE METHODS***********************/

    //primary function to swap asset into pymtCurrency to payoff the short
    function swapTo(uint amountOut, address to) internal {
        (uint tokenIn, uint wethIn) = getTo(amountOut);
        swap(assetPair, asset, wethIn, tokenIn, address(this)); //sends asset token into the pair, and delivers weth to us
        swap(paymentPair, weth, amountOut, wethIn, to); //swaps to send the just received wethIn and finally gets the USD Out
    }

    //secondary function to convert profit from remaining asset into pymtCurrency
    function swapFrom(uint amountIn, address to) internal {
        (uint cashOut, uint wethOut) = getFrom(amountIn);
        swap(assetPair, asset, wethOut, amountIn, address(this)); //send it to this address
        swap(paymentPair, weth, cashOut, wethOut, to); 
    }


    //function to swap from this contract to uniswap pool
    function swap(address pair, address token, uint out, uint _in, address to) internal {
        SafeERC20.safeTransfer(IERC20(token), pair, _in); //sends the asset amount in to the swap
        address token0 = IUniswapV2Pair(pair).token0();
        if (token == token0) {
            IUniswapV2Pair(pair).swap(0, out, to, new bytes(0));
        } else {
            IUniswapV2Pair(pair).swap(out, 0, to, new bytes(0));
        }
        
    }

    //primary function to get the amounts in required to pay off the short position total purchase
    //amount out is the total purchase necessary
    function getTo(uint amountOut) public view returns (uint amountIn, uint wethIn) {
        wethIn = estIn(amountOut, paymentPair, pymtCurrency);       
        amountIn = estIn(wethIn, assetPair, weth);

    }

    //secondary function to pay off the remaining profit to the long position
    function getFrom(uint amountIn) public view returns (uint cashOut, uint wethOut) {
        wethOut = estCashOut(amountIn, assetPair, weth);
        cashOut = estCashOut(wethOut, paymentPair, pymtCurrency);
    }

    

    function estCashOut(uint amountIn, address pair, address token) public view returns (uint amountOut) {
        (uint resA, uint resB,) = IUniswapV2Pair(pair).getReserves();
        address token1 = IUniswapV2Pair(pair).token1();
        amountOut = (token1 == token) ? UniswapV2Library.getAmountOut(amountIn, resA, resB) : UniswapV2Library.getAmountOut(amountIn, resB, resA);
    }

    function estIn(uint amountOut, address pair, address token) public view returns (uint amountIn) {
        (uint resA, uint resB,) = IUniswapV2Pair(pair).getReserves();
        address token1 = IUniswapV2Pair(pair).token1();
        amountIn = (token1 == token) ? UniswapV2Library.getAmountIn(amountOut, resA, resB) : UniswapV2Library.getAmountIn(amountOut, resB, resA);
    }



    event NewAsk(uint _i, uint _assetAmt, uint _strike, uint _price, uint _expiry);
    event NewOptionBought(uint _i);
    event OptionExercised(uint _i, bool cashClosed);
    event OptionReturned(uint _i);
    event OptionCancelled(uint _i);
}