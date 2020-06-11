pragma solidity ^0.5.11;

import "@openzeppelin/contracts/token/ERC721/ERC721Mintable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Mintable.sol";
import "@rsksmart/erc677/contracts/ERC677.sol";

import "@openzeppelin/contracts/token/ERC777/ERC777.sol";
import "@openzeppelin/contracts/access/roles/MinterRole.sol";

import "@openzeppelin/upgrades/contracts/upgradeability/ProxyFactory.sol";
import "@openzeppelin/upgrades/contracts/upgradeability/ProxyAdmin.sol";

/**
 * @dev Extension of {ERC777} that adds a set of accounts with the {MinterRole},
 * which have permission to mint (create) new tokens as they see fit.
 *
 * At construction, the deployer of the contract is the only minter.
 */
contract ERC777Mintable is ERC777, MinterRole {
    constructor(
        string memory name,
        string memory symbol,
        address[] memory defaultOperators
    ) public ERC777(name, symbol, defaultOperators) {}
    /**
     * @dev See {ERC777-_mint}.
     *
     * Requirements:
     *
     * - the caller must have the {MinterRole}.
     */
    function mint(address account, uint256 amount) public onlyMinter returns (bool) {
        _mint(account, account, amount, bytes(''), bytes(''));
        return true;
    }
}

contract Imports {
    constructor() internal {
        revert("This contract is used to import dependencies. Do not use.");
    }
}
