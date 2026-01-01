// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import "../../upgradeable/Libere1155CoreUpgradeable.sol";
import "../../upgradeable/LibraryPoolUpgradeable.sol";
import "../mocks/MockERC20.sol";

/**
 * @title TestSetup
 * @notice Base test contract with common setup for all Foundry tests
 * @dev All test contracts should inherit from this to get:
 *      - Pre-deployed UUPS proxy contracts (Core + Pool)
 *      - Mock USDC token
 *      - Test accounts (admin, users, publisher)
 *      - Helper functions for common operations
 */
abstract contract TestSetup is Test {
    /* ========================================
       Contract Instances
       ======================================== */

    Libere1155CoreUpgradeable public core;
    LibraryPoolUpgradeable public pool;
    MockERC20 public usdc;

    /* ========================================
       Test Accounts
       ======================================== */

    address public admin;
    address public user1;
    address public user2;
    address public publisher;
    address public platformFeeRecipient;

    /* ========================================
       Constants
       ======================================== */

    uint256 constant USDC_DECIMALS = 6;
    uint256 constant USDC_UNIT = 10 ** USDC_DECIMALS;
    uint256 constant DEFAULT_BOOK_PRICE = 10 * USDC_UNIT; // 10 USDC
    uint256 constant DEFAULT_ROYALTY_BPS = 500; // 5%
    uint256 constant PLATFORM_FEE_BPS = 250; // 2.5%

    /* ========================================
       Setup Function
       ======================================== */

    function setUp() public virtual {
        // ========================================
        // 1. Create test accounts
        // ========================================
        admin = makeAddr("admin");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        publisher = makeAddr("publisher");
        platformFeeRecipient = makeAddr("platformFeeRecipient");

        // ========================================
        // 2. Deploy MockERC20 (USDC)
        // ========================================
        usdc = new MockERC20("Mock USDC", "USDC", USDC_DECIMALS);

        // ========================================
        // 3. Deploy Libere1155CoreUpgradeable with UUPS Proxy
        // ========================================

        // Deploy implementation
        Libere1155CoreUpgradeable coreImpl = new Libere1155CoreUpgradeable();

        // Prepare initialization data
        bytes memory coreInitData = abi.encodeWithSelector(
            Libere1155CoreUpgradeable.initialize.selector,
            admin
        );

        // Deploy proxy
        ERC1967Proxy coreProxy = new ERC1967Proxy(
            address(coreImpl),
            coreInitData
        );

        // Wrap proxy in interface for easier interaction
        core = Libere1155CoreUpgradeable(address(coreProxy));

        // ========================================
        // 4. Deploy LibraryPoolUpgradeable with UUPS Proxy
        // ========================================

        // Deploy implementation
        LibraryPoolUpgradeable poolImpl = new LibraryPoolUpgradeable();

        // Prepare initialization data
        bytes memory poolInitData = abi.encodeWithSelector(
            LibraryPoolUpgradeable.initialize.selector,
            admin,
            Libere1155Core(address(core)) // Cast to interface
        );

        // Deploy proxy
        ERC1967Proxy poolProxy = new ERC1967Proxy(
            address(poolImpl),
            poolInitData
        );

        // Wrap proxy in interface
        pool = LibraryPoolUpgradeable(address(poolProxy));

        // ========================================
        // 5. Configure Core contract (as admin)
        // ========================================
        vm.startPrank(admin);

        // Set payment token to USDC
        core.setPaymentToken(address(usdc));

        // Set platform fee recipient and fee
        core.setPlatformFee(platformFeeRecipient, PLATFORM_FEE_BPS);

        vm.stopPrank();

        console.log("=== TestSetup Complete ===");
        console.log("Core Proxy:", address(core));
        console.log("Pool Proxy:", address(pool));
        console.log("USDC Token:", address(usdc));
        console.log("Admin:", admin);
    }

    /* ========================================
       Helper Functions
       ======================================== */

    /**
     * @notice Create a test book/item in the marketplace
     * @param tokenId NFT token ID
     * @param priceUSDC Price in USDC (6 decimals)
     * @param recipient Payment recipient address
     * @param royaltyRecipient Royalty recipient address
     * @param royaltyBps Royalty in basis points (500 = 5%)
     * @param uri Metadata URI
     */
    function createTestBook(
        uint256 tokenId,
        uint256 priceUSDC,
        address recipient,
        address royaltyRecipient,
        uint96 royaltyBps,
        string memory uri
    ) public {
        vm.prank(admin);
        core.createItem(tokenId, priceUSDC, recipient, royaltyRecipient, royaltyBps, uri);
    }

    /**
     * @notice Create a default test book with standard parameters
     * @param tokenId NFT token ID
     * @return tokenId The created token ID
     */
    function createDefaultBook(uint256 tokenId) public returns (uint256) {
        createTestBook(
            tokenId,
            DEFAULT_BOOK_PRICE,
            publisher,
            publisher,
            DEFAULT_ROYALTY_BPS,
            string(abi.encodePacked("ipfs://book", vm.toString(tokenId)))
        );
        return tokenId;
    }

    /**
     * @notice Mint USDC tokens to an address
     * @param to Recipient address
     * @param amount Amount in USDC units (6 decimals)
     */
    function mintUSDC(address to, uint256 amount) public {
        usdc.mint(to, amount);
    }

    /**
     * @notice Mint USDC in readable format (e.g., 100 USDC)
     * @param to Recipient address
     * @param amountReadable Amount in whole USDC (will be converted to 6 decimals)
     */
    function mintUSDCReadable(address to, uint256 amountReadable) public {
        usdc.mint(to, amountReadable * USDC_UNIT);
    }

    /**
     * @notice User approves marketplace to spend USDC
     * @param user Address approving
     * @param amount Amount to approve
     */
    function approveUSDC(address user, uint256 amount) public {
        vm.prank(user);
        usdc.approve(address(core), amount);
    }

    /**
     * @notice User purchases a book from marketplace
     * @param user Buyer address
     * @param tokenId Token ID to purchase
     * @param amount Number of copies to purchase
     */
    function purchaseBook(address user, uint256 tokenId, uint256 amount) public {
        vm.prank(user);
        core.purchaseItem(tokenId, amount);
    }

    /**
     * @notice User donates a book to library pool
     * @param user Donor address
     * @param tokenId Token ID to donate
     * @param amount Number of copies to donate
     */
    function donateToLibrary(address user, uint256 tokenId, uint256 amount) public {
        vm.prank(user);
        core.purchaseItemForLibrary(address(pool), tokenId, amount);
    }

    /**
     * @notice Complete flow: Create book, mint USDC, approve, and donate to library
     * @param tokenId Token ID
     * @param donor Address donating
     * @param copies Number of copies to donate
     */
    function setupBookInLibrary(uint256 tokenId, address donor, uint256 copies) public {
        // Create book
        createDefaultBook(tokenId);

        // Calculate required USDC
        uint256 totalCost = DEFAULT_BOOK_PRICE * copies;

        // Mint USDC to donor
        mintUSDC(donor, totalCost);

        // Approve and donate
        vm.startPrank(donor);
        usdc.approve(address(core), totalCost);
        core.purchaseItemForLibrary(address(pool), tokenId, copies);
        vm.stopPrank();
    }

    /**
     * @notice User borrows a book from library pool
     * @param borrower Address borrowing
     * @param tokenId Token ID to borrow
     * @return recordId The borrow record ID
     */
    function borrowBook(address borrower, uint256 tokenId) public returns (uint256) {
        vm.prank(borrower);
        return pool.borrowFromPool(tokenId);
    }

    /**
     * @notice User returns a borrowed book
     * @param borrower Address returning
     * @param tokenId Token ID to return
     */
    function returnBook(address borrower, uint256 tokenId) public {
        vm.prank(borrower);
        pool.returnMyBorrow(tokenId);
    }

    /**
     * @notice Fast-forward time for testing expiry
     * @param timeInSeconds Time to advance in seconds
     */
    function advanceTime(uint256 timeInSeconds) public {
        vm.warp(block.timestamp + timeInSeconds);
    }

    /**
     * @notice Convert readable USDC amount to 6-decimal units
     * @param amountReadable Whole USDC amount (e.g., 10 for 10 USDC)
     * @return Amount in USDC units (6 decimals)
     */
    function toUSDC(uint256 amountReadable) public pure returns (uint256) {
        return amountReadable * USDC_UNIT;
    }

    /**
     * @notice Convert 6-decimal USDC units to readable format
     * @param amountUnits Amount in USDC units
     * @return Whole USDC amount
     */
    function fromUSDC(uint256 amountUnits) public pure returns (uint256) {
        return amountUnits / USDC_UNIT;
    }
}
