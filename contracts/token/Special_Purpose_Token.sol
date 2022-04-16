pragma solidity ^0.8.13;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract Special_Purpose_Token is Ownable, ERC20 {
    
    constructor (string memory _name, string memory _symbol) ERC20(_name, _symbol) {}
    function mintTo(address[] memory accounts, uint256[] memory amounts) public onlyOwner {
        uint256 acctLength = accounts.length;
        uint256 amtLength = amounts.length;
        require(acctLength == amtLength, "arrays size mismatch");
        for (uint256 i = 0; i < acctLength; i++) {
            _mint(accounts[i], amounts[i]);
        }
    }

    function burn(address account, uint256 amount) public {
        _burn(account, amount);
    }
}