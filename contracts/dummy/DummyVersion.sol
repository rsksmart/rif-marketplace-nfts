pragma solidity ^0.5.17;

import "../ERC721SimplePlacementsV1.sol";

contract DummyVersion is ERC721SimplePlacementsV1 {
    uint public value;

    event Log();

    function initialize() external {
        emit Log();
    }

    function setValue(uint newValue) external {
        value = newValue;
    }
}
