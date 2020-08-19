pragma solidity ^0.5.17;

import "./ERC721SimplePlacementsV1.sol";
import "@rsksmart/rns-registry/contracts/AbstractRNS.sol";
import "@rsksmart/rns-rskregistrar/contracts/AbstractNodeOwner.sol";
import "@ensdomains/resolver/contracts/profiles/AddrResolver.sol";

 /**
 * @title RNSSimplePlacementsV1
 * @dev An RNS Domains Exchange contract to buy and sell tokens on multiple currencies.
 * This can be implemented using an openzeppelin/upgrades v2.8 proxy contract.
 */
contract RNSSimplePlacementsV1 is ERC721SimplePlacementsV1 {
  bytes32 constant RSK_HASH = 0x0cd5c10192478cd220936e91293afc15e3f6de4d419de5de7506b679cbdd8ec4;

  AbstractRNS public rns;
  AddrResolver public resolver;

  function initialize(IERC721 _token, address owner, AbstractRNS _rns, AddrResolver _resolver) public initializer {
    ERC721SimplePlacementsV1.initialize(_token, owner);
    rns = _rns;
    resolver = _resolver;
  }

  //_transferToNewOwner: Tranfers the token to the new owner.
  // Overrides the generic implementation by cleaning up RNS specific domain settings
  function _transferToNewOwner(address owner, address newOwner, uint256 tokenId) internal {
    AbstractNodeOwner nodeOwner = AbstractNodeOwner(address(token));
    nodeOwner.transferFrom(owner, address(this), tokenId);
    nodeOwner.reclaim(tokenId, address(this));
    rns.setResolver(keccak256(abi.encodePacked(RSK_HASH, bytes32(tokenId))), address(resolver));
    resolver.setAddr(keccak256(abi.encodePacked(RSK_HASH, bytes32(tokenId))), newOwner);
    rns.setOwner(keccak256(abi.encodePacked(RSK_HASH, bytes32(tokenId))), newOwner);
    nodeOwner.transferFrom(address(this), newOwner, tokenId);
  }
}
