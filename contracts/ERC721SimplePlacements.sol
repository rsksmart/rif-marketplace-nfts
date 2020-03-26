pragma solidity ^0.5.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import "@openzeppelin/contracts/introspection/IERC1820Registry.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@rsksmart/erc677/contracts/IERC677.sol";
import "@openzeppelin/contracts/token/ERC777/IERC777.sol";

import "@rsksmart/erc677/contracts/ERC677TransferReceiver.sol";
import "@openzeppelin/contracts/token/ERC777/IERC777Recipient.sol";

import "@openzeppelin/contracts/GSN/Context.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";
import "solidity-bytes-utils/contracts/BytesLib.sol";

contract ERC721SimplePlacements is Context, ERC677TransferReceiver, IERC777Recipient, Ownable {
    IERC1820Registry constant internal ERC1820_REGISTRY = IERC1820Registry(0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24);

    IERC721 token;

    using BytesLib for bytes;

    struct Placement {
        address paymentToken;
        uint256 cost;
    }

    event PaymentTokenWhitelistChanged(address indexed paymentToken, bool isERC20, bool isERC677, bool isERC777);
    event UpdatePlacement(uint256 indexed tokenId, address indexed paymentToken, uint256 cost);

    mapping (address => bool) private _whitelistedERC20;
    mapping (address => bool) private _whitelistedERC677;
    mapping (address => bool) private _whitelistedERC777;

    bool public isGasPaymentAllowed;

    mapping (uint256 => Placement) private _placements;

    modifier onlyWhitelistedPaymentTokens(address paymentToken) {
        require(
            paymentToken != address(0) ? (
                _whitelistedERC20[paymentToken] ||
                _whitelistedERC677[paymentToken] ||
                _whitelistedERC777[paymentToken]
            ) : isGasPaymentAllowed,
            "Payment token not allowed."
        );
        _;
    }

    constructor(IERC721 _token) public {
        token = _token;
        ERC1820_REGISTRY.setInterfaceImplementer(address(this), keccak256("ERC777Token"), address(this));
        ERC1820_REGISTRY.setInterfaceImplementer(address(this), keccak256("ERC20Token"), address(this));
        ERC1820_REGISTRY.setInterfaceImplementer(address(this), keccak256("ERC777TokensRecipient"), address(this));
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

    function allowGasPayments(bool allowance) public onlyOwner {
        isGasPaymentAllowed = allowance;
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

    // With ERC-20 or gas
    function buy(uint256 tokenId) external payable {
        Placement memory _placement = _getPlacement(tokenId);

        address payable owner = address(uint160(token.ownerOf(tokenId)));

        if(_placement.paymentToken == address(0)) {
            require(isGasPaymentAllowed, "Wrong purchase method.");

            require(msg.value >= _placement.cost, "Transfer amount is not enough.");

            owner.transfer(_placement.cost);
        } else {
            require(_whitelistedERC20[_placement.paymentToken], "Wrong purchase method.");

            require(
                IERC20(_placement.paymentToken).transferFrom(_msgSender(), owner, _placement.cost),
                "Payment token transfer error."
            );
        }

        _afterBuyTransfer(owner, _msgSender(), tokenId);
    }

    // With ERC-677
    function tokenFallback(address from, uint256 /* amount */, bytes calldata data) external returns (bool) {
        uint256 tokenId = data.toUint(0);

        Placement memory _placement = _getPlacement(tokenId);

        require(_whitelistedERC677[_placement.paymentToken], "Wrong purchase method.");
        require(msg.sender == _placement.paymentToken, "Only from payment token.");

        address owner = token.ownerOf(tokenId);

        require(
            IERC677(_placement.paymentToken).transfer(owner, _placement.cost),
            "Payment token transfer error."
        );

        _afterBuyTransfer(owner, from, tokenId);
    }

    // With ERC-777
    function tokensReceived(
        address /* operator */,
        address from,
        address /* to */,
        uint256 /* amount */,
        bytes calldata userData,
        bytes calldata /* operatorData */
    ) external {
        uint256 tokenId = userData.toUint(0);

        Placement memory _placement = _getPlacement(tokenId);

        require(_whitelistedERC777[_placement.paymentToken], "Wrong purchase method.");
        require(msg.sender == _placement.paymentToken, "Only from payment token.");

        address owner = token.ownerOf(tokenId);

        IERC777(_placement.paymentToken).send(owner, _placement.cost, bytes(''));

        _afterBuyTransfer(owner, from, tokenId);
    }

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
