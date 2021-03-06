pragma solidity ^0.8.13;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract Token is ERC20 {
    
    constructor (string memory _name, string memory _symbol, uint256 amount) ERC20(_name, _symbol) {
        _mint(msg.sender, amount);
    }

    function mint(address _to, uint amount) public {
        _mint(_to, amount);
    }
}