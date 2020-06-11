pragma solidity ^0.5.11;

import "../ERC721SimplePlacementsV1.sol";

contract DummyVersion is ERC721SimplePlacementsV1 {
    uint public v;

    event Log();

    function initialize() public {
        emit Log();
    }

    function setV(uint _v) public {
        v = _v;
    }

}
