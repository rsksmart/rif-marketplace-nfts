pragma solidity ^0.5.17;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/introspection/IERC1820Registry.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@rsksmart/erc677/contracts/IERC677.sol";
import "@openzeppelin/contracts/token/ERC777/IERC777.sol";
import "@rsksmart/erc677/contracts/ERC677TransferReceiver.sol";
import "@openzeppelin/contracts/token/ERC777/IERC777Recipient.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/GSN/Context.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/lifecycle/Pausable.sol";

import "solidity-bytes-utils/contracts/BytesLib.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";

 /**
 * @title ERC721SimplePlacementsV1
 * @dev An NFTS Exchange contract to buy and sell tokens on multiple currencies.
 * This can be implemented using an openzeppelin/upgrades v2.8 proxy contract.
 */
contract ERC721SimplePlacementsV1 is Initializable, ERC677TransferReceiver, IERC777Recipient, Ownable, Pausable {
    IERC1820Registry constant internal ERC1820_REGISTRY = IERC1820Registry(0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24);

    IERC721 public token;

    using BytesLib for bytes;

    struct Placement {
        address paymentToken;
        uint256 cost;
    }

    event PaymentTokenWhitelistChanged(address indexed paymentToken, bool isERC20, bool isERC677, bool isERC777);
    event TokenPlaced(uint256 indexed tokenId, address indexed paymentToken, uint256 cost);
    event TokenUnplaced(uint256 indexed tokenId);
    event TokenSold(uint256 indexed tokenId, address indexed newOwner);

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

    function initialize(IERC721 _token, address owner) public initializer {
        token = _token;
        ERC1820_REGISTRY.setInterfaceImplementer(address(this), keccak256("ERC777TokensRecipient"), address(this));
        Ownable.initialize(owner);
        Pausable.initialize(owner);
    }

    /////////////////////////
    // Tokens whitelisting //
    /////////////////////////

    function setWhitelistedPaymentToken(address paymentToken, bool isERC20, bool isERC677, bool isERC777) external onlyOwner {
        _whitelistedERC20[paymentToken] = isERC20;
        _whitelistedERC677[paymentToken] = isERC677;
        _whitelistedERC777[paymentToken] = isERC777;

        emit PaymentTokenWhitelistChanged(paymentToken, isERC20, isERC677, isERC777);
    }

    function whitelistedPaymentToken(address paymentToken) external view returns (bool, bool, bool) {
        return (
            _whitelistedERC20[paymentToken],
            _whitelistedERC677[paymentToken],
            _whitelistedERC777[paymentToken]
        );
    }

    function allowGasPayments(bool allowance) external onlyOwner {
        isGasPaymentAllowed = allowance;
    }

    /////////////
    // Placing //
    /////////////

    function place(uint256 tokenId, address paymentToken, uint256 cost) external whenNotPaused onlyWhitelistedPaymentTokens(paymentToken) {
        require(token.getApproved(tokenId) == address(this), "Not approved to transfer.");
        require(cost > 0, "Cost should be greater than zero.");
       
        address tokenOwner = token.ownerOf(tokenId);
        require(
            tokenOwner == _msgSender() || token.isApprovedForAll(tokenOwner, _msgSender()),
            "Not approved or owner."
        );

        _setPlacement(tokenId, paymentToken, cost);

        emit TokenPlaced(tokenId, paymentToken, cost);
    }

    function placement(uint256 tokenId) external view returns(address, uint256) {
        Placement memory _placement = _getPlacement(tokenId);
        return (_placement.paymentToken, _placement.cost);
    }

    function unplace(uint256 tokenId) external {
        require(!(token.getApproved(tokenId) == address(this)), "Approved to transfer.");

        _setPlacement(tokenId, address(0), 0);

        emit TokenUnplaced(tokenId);
    }

    ////////////
    // Buying //
    ////////////

    // With ERC-20 or gas
    function buy(uint256 tokenId) external payable whenNotPaused {
        Placement memory _placement = _getPlacement(tokenId);

        address payable owner = address(uint160(token.ownerOf(tokenId)));

        // Check valid transaction
        require(token.getApproved(tokenId) == address(this), "Not approved to transfer.");
        if(_placement.paymentToken == address(0)) {
            require(isGasPaymentAllowed, "Wrong purchase method.");
            require(msg.value == _placement.cost, "Transfer amount is not correct.");
        } else {
            require(_whitelistedERC20[_placement.paymentToken], "Wrong purchase method.");
        }

        // Transfer token
        _transfer(owner, _msgSender(), tokenId);
        
        // Process Payment
        if(_placement.paymentToken == address(0)) {
            owner.transfer(_placement.cost);
        } else {
          require(
                IERC20(_placement.paymentToken).transferFrom(_msgSender(), owner, _placement.cost),
                "Payment token transfer error."
            );
        }
    }

    // With ERC-677
    function tokenFallback(address from, uint256 amount, bytes calldata data) external whenNotPaused returns (bool) {
        uint256 tokenId = data.toUint(0);

        Placement memory _placement = _getPlacement(tokenId);

        // Check valid transaction
        require(token.getApproved(tokenId) == address(this), "Not approved to transfer.");
        require(_whitelistedERC677[_placement.paymentToken], "Wrong purchase method.");
        require(_msgSender() == _placement.paymentToken, "Only from payment token.");
        require(amount == _placement.cost, "Transfer amount is not correct.");

        address owner = token.ownerOf(tokenId);

        // Transfer token
        _transfer(owner, from, tokenId);

        // Process payment
        require(
            IERC677(_placement.paymentToken).transfer(owner, _placement.cost),
            "Payment token transfer error."
        );
    }

    // With ERC-777
    function tokensReceived(
        address /* operator */,
        address from,
        address /* to */,
        uint256 amount,
        bytes calldata userData,
        bytes calldata /* operatorData */
    ) external whenNotPaused {
        uint256 tokenId = userData.toUint(0);

        Placement memory _placement = _getPlacement(tokenId);

        // Check valid transaction
        require(token.getApproved(tokenId) == address(this), "Not approved to transfer.");
        require(_whitelistedERC777[_placement.paymentToken], "Wrong purchase method.");
        require(_msgSender() == _placement.paymentToken, "Only from payment token.");
        require(amount == _placement.cost, "Transfer amount is not correct.");

        address owner = token.ownerOf(tokenId);

        // Transfer token
        _transfer(owner, from, tokenId);

        // Process payment
        IERC777(_placement.paymentToken).send(owner, _placement.cost, bytes(''));
    }

    function _getPlacement(uint256 tokenId) internal view returns(Placement memory _placement) {
        _placement = _placements[tokenId];
        require(_placement.cost > 0, "Token not placed.");
    }

    function _setPlacement(uint256 tokenId, address paymentToken, uint256 cost) private {
        Placement storage _placement = _placements[tokenId];
        _placement.paymentToken = paymentToken;
        _placement.cost = cost;
    }

    function _transfer(address owner, address newOwner, uint256 tokenId) private {
        _setPlacement(tokenId, address(0), 0);
        _transferToNewOwner(owner, newOwner, tokenId);
        emit TokenSold(tokenId, newOwner);
    }

    //_transferToNewOwner: Tranfers the token to the new owner.
    // This function may be overriden depending on the type of Token being transferred,
    // which may require additional steps or specific actions.
    function _transferToNewOwner(address owner, address newOwner, uint256 tokenId) internal {
        token.safeTransferFrom(owner, newOwner, tokenId);
    }
}
