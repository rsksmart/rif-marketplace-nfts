pragma solidity ^0.5.0;

import "@rsksmart/erc677/contracts/IERC677.sol";
import "@rsksmart/erc677/contracts/ERC677TransferReceiver.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/GSN/Context.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";
import "solidity-bytes-utils/contracts/BytesLib.sol";

contract ERC721SimplePlacements is Context, ERC677TransferReceiver, Ownable {
    IERC677 rif;
    IERC721 token;

    using BytesLib for bytes;

    event PaymentTokenWhitelistChanged(address indexed paymentToken, bool isERC20, bool isERC677, bool isERC777);
    event UpdatePlacement(uint256 indexed tokenId, uint256 cost);

    mapping (address => bool) private _whitelistedERC20;
    mapping (address => bool) private _whitelistedERC677;
    mapping (address => bool) private _whitelistedERC777;

    mapping (uint256 => uint256) private _placements;

    constructor(IERC677 _rif, IERC721 _token) public {
        rif = _rif;
        token = _token;
    }

    /////////////////////////
    // Tokens whitelisting //
    /////////////////////////

    function setWhitelisted(address paymentToken, bool isERC20, bool isERC677, bool isERC777) public onlyOwner {
        _whitelistedERC20[paymentToken] = isERC20;
        _whitelistedERC677[paymentToken] = isERC677;
        _whitelistedERC777[paymentToken] = isERC777;

        emit PaymentTokenWhitelistChanged(paymentToken, isERC20, isERC677, isERC777);
    }

    function whitelisted(address paymentToken) public view returns (bool, bool, bool) {
        return (
            _whitelistedERC20[paymentToken],
            _whitelistedERC677[paymentToken],
            _whitelistedERC777[paymentToken]
        );
    }

    /////////////
    // Placing //
    /////////////

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

    ////////////
    // Buying //
    ////////////

    // With ERC-20
    function buy(uint256 tokenId) external {
        address owner = token.ownerOf(tokenId);
        uint256 cost = _placement(tokenId);

        require(
            rif.transferFrom(_msgSender(), owner, cost),
            "RIF transfer error."
        );

        _afterBuyTransfer(owner, _msgSender(), tokenId);
    }

    // With ERC-677
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

    // With ERC-777

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
