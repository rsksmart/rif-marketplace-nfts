pragma solidity ^0.5.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@rsksmart/erc677/contracts/IERC677.sol";
import "@openzeppelin/contracts/token/ERC777/IERC777.sol";

import "@rsksmart/erc677/contracts/ERC677TransferReceiver.sol";

import "@openzeppelin/contracts/GSN/Context.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";
import "solidity-bytes-utils/contracts/BytesLib.sol";

contract ERC721SimplePlacements is Context, ERC677TransferReceiver, Ownable {
    IERC721 token;

    using BytesLib for bytes;

    struct Placement {
        address paymentToken;
        uint256 cost;
    }

    event PaymentTokenWhitelistChanged(address indexed paymentToken, bool isERC20, bool isERC677, bool isERC777);
    event UpdatePlacement(uint256 indexed tokenId, address paymentToken, uint256 cost);

    mapping (address => bool) private _whitelistedERC20;
    mapping (address => bool) private _whitelistedERC677;
    mapping (address => bool) private _whitelistedERC777;

    mapping (uint256 => Placement) private _placements;

    modifier onlyWhitelistedPaymentTokens(address paymentToken) {
        require(
            _whitelistedERC20[paymentToken] ||
            _whitelistedERC677[paymentToken] ||
            _whitelistedERC777[paymentToken],
            "Payment token not allowed."
        );
        _;
    }

    constructor(IERC721 _token) public {
        token = _token;
    }

    /////////////////////////
    // Tokens whitelisting //
    /////////////////////////

    function setWhitelistedPaymentToken(address paymentToken, bool isERC20, bool isERC677, bool isERC777) public onlyOwner {
        _whitelistedERC20[paymentToken] = isERC20;
        _whitelistedERC677[paymentToken] = isERC677;
        _whitelistedERC777[paymentToken] = isERC777;

        emit PaymentTokenWhitelistChanged(paymentToken, isERC20, isERC677, isERC777);
    }

    function whitelistedPaymentToken(address paymentToken) public view returns (bool, bool, bool) {
        return (
            _whitelistedERC20[paymentToken],
            _whitelistedERC677[paymentToken],
            _whitelistedERC777[paymentToken]
        );
    }

    /////////////
    // Placing //
    /////////////

    function place(uint256 tokenId, address paymentToken, uint256 cost) external onlyWhitelistedPaymentTokens(paymentToken) {
        require(token.getApproved(tokenId) == address(this), "Not approved to transfer.");

        address tokenOwner = token.ownerOf(tokenId);
        require(
            tokenOwner == _msgSender() || token.isApprovedForAll(tokenOwner, _msgSender()),
            "Not approved or owner."
        );

        _setPlacement(tokenId, paymentToken, cost);
    }

    function placement(uint256 tokenId) external view returns(address, uint256) {
        Placement memory _placement = _getPlacement(tokenId);
        return (_placement.paymentToken, _placement.cost);
    }

    function unplace(uint256 tokenId) external {
        require(!(token.getApproved(tokenId) == address(this)), "Approved to transfer.");

        _setPlacement(tokenId, address(0), 0);
    }

    ////////////
    // Buying //
    ////////////

    // With ERC-20
    function buy(uint256 tokenId) external {
        Placement memory _placement = _getPlacement(tokenId);

        address owner = token.ownerOf(tokenId);

        require(
            IERC20(_placement.paymentToken).transferFrom(_msgSender(), owner, _placement.cost),
            "Payment token transfer error."
        );

        _afterBuyTransfer(owner, _msgSender(), tokenId);
    }

    // With ERC-677
    function tokenFallback(address from, uint256 amount, bytes calldata data) external returns (bool) {
        uint256 tokenId = data.toUint(0);

        Placement memory _placement = _getPlacement(tokenId);

        require(_msgSender() == _placement.paymentToken, "Only from payment token.");

        address owner = token.ownerOf(tokenId);

        require(
            IERC677(_placement.paymentToken).transfer(owner, _placement.cost),
            "Payment token transfer error."
        );

        _afterBuyTransfer(owner, from, tokenId);
    }

    // With ERC-777

    function _getPlacement(uint256 tokenId) private view returns(Placement memory _placement) {
        _placement = _placements[tokenId];
        require(_placement.cost > 0, "Token not placed.");
    }

    function _setPlacement(uint256 tokenId, address paymentToken, uint256 cost) private {
        emit UpdatePlacement(tokenId, paymentToken, cost);
        Placement storage _placement = _placements[tokenId];
        _placement.paymentToken = paymentToken;
        _placement.cost = cost;
    }

    function _afterBuyTransfer(address owner, address newOwner, uint256 tokenId) private {
        token.transferFrom(owner, newOwner, tokenId);
        _setPlacement(tokenId, address(0), 0);
    }
}
