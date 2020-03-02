pragma solidity ^0.5.0;

import "@rsksmart/erc677/contracts/IERC677.sol";
import "@rsksmart/erc677/contracts/ERC677TransferReceiver.sol";
import "@openzeppelin/contracts/token/erc721/IERC721.sol";
import "@openzeppelin/contracts/GSN/Context.sol";
import "solidity-bytes-utils/contracts/BytesLib.sol";

contract ERC721SimplePlacements is Context, ERC677TransferReceiver  {
    IERC677 rif;
    IERC721 token;

    using BytesLib for bytes;

    mapping (uint256 => uint256) private _placements;

    event UpdatePlacement(uint256 indexed tokenId, uint256 cost);

    constructor(IERC677 _rif, IERC721 _token) public {
        rif = _rif;
        token = _token;
    }

    function place(uint256 tokenId, uint256 cost) external {
        require(token.getApproved(tokenId) == address(this), "Not approved to transfer.");

        address tokenOwner = token.ownerOf(tokenId);
        require(
            tokenOwner == _msgSender() || token.isApprovedForAll(tokenOwner, _msgSender()),
            "Not approved or owner."
        );

        _setPlacement(tokenId, cost);
    }

    function placement(uint256 tokenId) external view returns(uint256) {
        return _placement(tokenId);
    }

    function unplace(uint256 tokenId) external {
        require(!(token.getApproved(tokenId) == address(this)), "Approved to transfer.");

        _setPlacement(tokenId, 0);
    }

    function buy(uint256 tokenId) external {
        address owner = token.ownerOf(tokenId);
        uint256 cost = _placement(tokenId);

        require(
            rif.transferFrom(_msgSender(), owner, cost),
            "RIF transfer error."
        );

        _afterBuyTransfer(owner, _msgSender(), tokenId);
    }

    function tokenFallback(address from, uint256 amount, bytes calldata data) external returns (bool) {
        require(_msgSender() == address(rif), "Only RIF token.");

        uint256 tokenId = data.toUint(0);
        address owner = token.ownerOf(tokenId);
        uint256 cost = _placement(tokenId);

        require(
            rif.transfer(owner, cost),
            "RIF transfer error."
        );

        _afterBuyTransfer(owner, from, tokenId);
    }

    function _placement(uint256 tokenId) private view returns(uint256) {
        require(_placements[tokenId] > 0, "Token not placed.");
        return _placements[tokenId];
    }

    function _setPlacement(uint256 tokenId, uint256 cost) private {
        emit UpdatePlacement(tokenId, cost);
        _placements[tokenId] = cost;
    }

    function _afterBuyTransfer(address owner, address newOwner, uint256 tokenId) private {
        token.transferFrom(owner, newOwner, tokenId);
        _setPlacement(tokenId, 0);
    }
}
