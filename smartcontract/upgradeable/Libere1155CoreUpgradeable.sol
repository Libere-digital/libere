// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155SupplyUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title Libere1155CoreUpgradeable
 * @notice UUPS Upgradeable version of Libere1155Core marketplace contract
 * @dev Implements ERC-1155 NFT marketplace with USDC/ETH payments and UUPS proxy pattern
 */
contract Libere1155CoreUpgradeable is
    Initializable,
    ERC1155SupplyUpgradeable,
    ERC2981Upgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    /* ---------------- Events ---------------- */
    event ItemCreated(uint256 indexed id, uint256 price, address indexed recipient, address indexed creator, uint96 royaltyBps, string metadataUri);
    event ItemPurchased(address indexed buyer, uint256 indexed id, uint256 amount, address paymentToken);
    event ItemPurchasedForLibrary(address indexed buyer, address indexed pool, uint256 indexed id, uint256 amount, address paymentToken);
    event Withdrawal(address indexed recipient, uint256 amount, address paymentToken);
    event PaymentTokenSet(address indexed token);
    event PlatformFeeSet(address indexed recipient, uint96 feeBps);
    event URISet(uint256 indexed id, string newUri);

    /* ---------------- Structs ---------------- */
    struct Item {
        uint256 price;
        address payable recipient;
        uint256 balance;
        bool exists;
    }

    /* ---------------- State Variables ---------------- */
    mapping(uint256 => Item) public items;
    mapping(uint256 => string) private tokenURIs;

    address public paymentToken;         // address(0)=ETH; else ERC20 (USDC)
    address public platformFeeRecipient; // optional
    uint96  public platformFeeBps;       // <= 10%
    uint256 private platformOwedETH;
    uint256 private platformOwedERC20;

    /* ---------------- Storage gap for future upgrades ---------------- */
    uint256[50] private __gap;

    /* ---------------- Constructor & Initializer ---------------- */

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the upgradeable contract
     * @param admin The address that will be the owner
     */
    function initialize(address admin) public initializer {
        __ERC1155_init("Libere1155Core");
        __ERC1155Supply_init();
        __ERC2981_init();
        __Ownable_init(admin);
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
    }

    /* ---------------- UUPS Authorization ---------------- */

    /**
     * @notice Authorize upgrade (only owner can upgrade)
     * @param newImplementation Address of new implementation contract
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /**
     * @notice Get contract version
     * @return Version string
     */
    function version() public pure virtual returns (string memory) {
        return "1.0.0";
    }

    /* ---------------- Admin Functions ---------------- */

    /**
     * @notice Set payment token (address(0) for ETH, or ERC20 address for stablecoin)
     * @param erc20 Address of ERC20 token (or address(0) for ETH)
     */
    function setPaymentToken(address erc20) external onlyOwner {
        paymentToken = erc20;
        emit PaymentTokenSet(erc20);
    }

    /**
     * @notice Set platform fee configuration
     * @param recipient Address to receive platform fees
     * @param feeBps Fee in basis points (max 1000 = 10%)
     */
    function setPlatformFee(address recipient, uint96 feeBps) external onlyOwner {
        require(feeBps <= 1000, "fee too high");
        platformFeeRecipient = recipient;
        platformFeeBps = feeBps;
        emit PlatformFeeSet(recipient, feeBps);
    }

    /* ---------------- Catalog Management ---------------- */

    /**
     * @notice Create a new item/book in the marketplace
     * @param id Unique token ID
     * @param price Price per item in wei (or USDC units)
     * @param recipient Address to receive sales proceeds
     * @param royaltyRecipient Address to receive royalties
     * @param royaltyBps Royalty in basis points (max 1000 = 10%)
     * @param metadataUri IPFS or HTTP URI for metadata
     */
    function createItem(
        uint256 id,
        uint256 price,
        address payable recipient,
        address royaltyRecipient,
        uint96 royaltyBps,
        string memory metadataUri
    ) external onlyOwner {
        require(!items[id].exists, "exists");
        require(recipient != address(0), "bad recipient");
        require(royaltyRecipient != address(0), "bad royalty recipient");
        require(royaltyBps <= 1000, "royalty too high");
        require(price > 0, "price=0");

        items[id] = Item({ price: price, recipient: recipient, balance: 0, exists: true });
        tokenURIs[id] = metadataUri;
        _setTokenRoyalty(id, royaltyRecipient, royaltyBps);

        emit ItemCreated(id, price, recipient, msg.sender, royaltyBps, metadataUri);
    }

    /* ---------------- Payment Functions ---------------- */

    /**
     * @notice Internal function to handle payment (ETH or ERC20)
     * @param total Total amount to charge
     */
    function _takePayment(uint256 total) internal {
        if (paymentToken == address(0)) {
            require(msg.value == total, "bad ETH");
        } else {
            require(msg.value == 0, "ETH not accepted");
            require(IERC20(paymentToken).transferFrom(msg.sender, address(this), total), "ERC20 transferFrom fail");
        }
    }

    /**
     * @notice Split payment between platform fee and item recipient
     * @param id Token ID
     * @param gross Gross payment amount
     */
    function _splitToBalances(uint256 id, uint256 gross) internal {
        uint256 fee = (platformFeeRecipient != address(0) && platformFeeBps > 0) ? (gross * platformFeeBps) / 10_000 : 0;
        uint256 net = gross - fee;
        items[id].balance += net;
        if (paymentToken == address(0)) platformOwedETH += fee; else platformOwedERC20 += fee;
    }

    /* ---------------- Purchase Functions ---------------- */

    /**
     * @notice Purchase item for self
     * @param id Token ID to purchase
     * @param amount Number of copies to purchase
     */
    function purchaseItem(uint256 id, uint256 amount) external payable nonReentrant {
        Item storage it = items[id]; require(it.exists, "no item"); require(amount > 0, "amount=0");
        uint256 total = it.price * amount; _takePayment(total);
        _mint(msg.sender, id, amount, "");
        _splitToBalances(id, total);
        emit ItemPurchased(msg.sender, id, amount, paymentToken);
    }

    /**
     * @notice Purchase item and donate to library pool
     * @param pool Address of library pool contract
     * @param id Token ID to purchase
     * @param amount Number of copies to purchase
     */
    function purchaseItemForLibrary(address pool, uint256 id, uint256 amount) external payable nonReentrant {
        require(pool != address(0), "bad pool");
        Item storage it = items[id]; require(it.exists, "no item"); require(amount > 0, "amount=0");
        uint256 total = it.price * amount; _takePayment(total);
        _mint(pool, id, amount, "");
        _splitToBalances(id, total);
        emit ItemPurchasedForLibrary(msg.sender, pool, id, amount, paymentToken);
    }

    /* ---------------- Withdrawal Functions ---------------- */

    /**
     * @notice Withdraw accumulated balance for an item (called by recipient)
     * @param id Token ID
     */
    function withdrawFunds(uint256 id) external nonReentrant {
        Item storage it = items[id]; require(it.exists, "no item"); require(msg.sender == it.recipient, "not recipient");
        uint256 amount = it.balance; require(amount > 0, "no funds"); it.balance = 0;
        if (paymentToken == address(0)) {
            (bool ok, ) = it.recipient.call{value: amount}(""); require(ok, "ETH withdraw fail");
        } else {
            require(IERC20(paymentToken).transfer(it.recipient, amount), "ERC20 withdraw fail");
        }
        emit Withdrawal(it.recipient, amount, paymentToken);
    }

    /**
     * @notice Withdraw accumulated platform fees
     */
    function withdrawPlatform() external nonReentrant {
        require(platformFeeRecipient != address(0), "no platform");
        if (paymentToken == address(0)) {
            uint256 amt = platformOwedETH; require(amt > 0, "no ETH"); platformOwedETH = 0;
            (bool ok, ) = platformFeeRecipient.call{value: amt}(""); require(ok, "ETH xfer fail");
        } else {
            uint256 amt = platformOwedERC20; require(amt > 0, "no ERC20"); platformOwedERC20 = 0;
            require(IERC20(paymentToken).transfer(platformFeeRecipient, amt), "ERC20 xfer fail");
        }
    }

    /* ---------------- Metadata Functions ---------------- */

    /**
     * @notice Get URI for token metadata
     * @param id Token ID
     * @return URI string
     */
    function uri(uint256 id) public view override returns (string memory) {
        return tokenURIs[id];
    }

    /**
     * @notice Update URI for a token (admin only)
     * @param id Token ID
     * @param newUri New URI string
     */
    function setURI(uint256 id, string memory newUri) external onlyOwner {
        require(items[id].exists, "no item");
        tokenURIs[id] = newUri;
        emit URISet(id, newUri);
    }

    /* ---------------- Interface Support ---------------- */

    /**
     * @notice Check if contract supports an interface
     * @param interfaceId Interface identifier
     * @return True if supported
     */
    function supportsInterface(bytes4 interfaceId)
        public view override(ERC1155Upgradeable, ERC2981Upgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    /* ---------------- Receive/Fallback ---------------- */
    receive() external payable { revert(); }
    fallback() external payable { revert(); }
}
