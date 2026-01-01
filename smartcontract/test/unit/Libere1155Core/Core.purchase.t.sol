// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../helpers/TestSetup.sol";

/**
 * @title CorePurchaseTest
 * @notice Unit tests for Libere1155CoreUpgradeable purchase functionality
 * @dev Tests:
 *      - Purchase with USDC (happy path)
 *      - Purchase for library pool
 *      - Purchase failures (insufficient allowance, balance, non-existent item)
 *      - Payment splitting (platform fee + recipient)
 *      - NFT minting verification
 */
contract CorePurchaseTest is TestSetup {
    uint256 tokenId = 1;

    function setUp() public override {
        super.setUp();

        // Create a test book
        createDefaultBook(tokenId);
    }

    function test_purchaseItem_withUSDC_success() public {
        // Mint USDC to user
        mintUSDC(user1, DEFAULT_BOOK_PRICE);

        // Approve marketplace
        vm.startPrank(user1);
        usdc.approve(address(core), DEFAULT_BOOK_PRICE);

        // Purchase
        core.purchaseItem(tokenId, 1);
        vm.stopPrank();

        // Assertions
        assertEq(core.balanceOf(user1, tokenId), 1, "User should own 1 NFT");
    }

    function test_purchaseItem_paymentsplitting_platformFeeAndRecipient() public {
        // Mint USDC to user
        mintUSDC(user1, DEFAULT_BOOK_PRICE);

        // Record balances before
        uint256 publisherBalanceBefore = usdc.balanceOf(publisher);
        uint256 platformBalanceBefore = usdc.balanceOf(platformFeeRecipient);

        // Approve and purchase
        vm.startPrank(user1);
        usdc.approve(address(core), DEFAULT_BOOK_PRICE);
        core.purchaseItem(tokenId, 1);
        vm.stopPrank();

        // Calculate expected amounts
        uint256 platformFee = (DEFAULT_BOOK_PRICE * PLATFORM_FEE_BPS) / 10000;
        uint256 publisherAmount = DEFAULT_BOOK_PRICE - platformFee;

        // Check payment didn't go directly (should be in contract for withdrawal)
        (,, uint256 recipientBalance,) = core.items(tokenId);
        assertEq(recipientBalance, publisherAmount, "Publisher balance in contract should match");
    }

    function test_purchaseItem_insufficientAllowance_reverts() public {
        // Mint USDC but don't approve enough
        mintUSDC(user1, DEFAULT_BOOK_PRICE);

        vm.startPrank(user1);
        usdc.approve(address(core), DEFAULT_BOOK_PRICE - 1); // Approve less

        // Should revert
        vm.expectRevert();
        core.purchaseItem(tokenId, 1);
        vm.stopPrank();
    }

    function test_purchaseItem_insufficientBalance_reverts() public {
        // Approve but don't mint enough USDC
        vm.startPrank(user1);
        usdc.approve(address(core), DEFAULT_BOOK_PRICE);

        // Should revert (insufficient balance)
        vm.expectRevert();
        core.purchaseItem(tokenId, 1);
        vm.stopPrank();
    }

    function test_purchaseItem_nonExistentItem_reverts() public {
        uint256 nonExistentId = 999;

        // Mint and approve USDC
        mintUSDC(user1, DEFAULT_BOOK_PRICE);

        vm.startPrank(user1);
        usdc.approve(address(core), DEFAULT_BOOK_PRICE);

        // Should revert (item doesn't exist)
        vm.expectRevert();
        core.purchaseItem(nonExistentId, 1);
        vm.stopPrank();
    }

    function test_purchaseItemForLibrary_success() public {
        // Mint USDC to user
        mintUSDC(user1, DEFAULT_BOOK_PRICE);

        // Approve and purchase for library
        vm.startPrank(user1);
        usdc.approve(address(core), DEFAULT_BOOK_PRICE);
        core.purchaseItemForLibrary(address(pool), tokenId, 1);
        vm.stopPrank();

        // Library pool should own the NFT
        assertEq(core.balanceOf(address(pool), tokenId), 1, "Pool should own 1 NFT");

        // User should not own it
        assertEq(core.balanceOf(user1, tokenId), 0, "User should not own NFT");
    }

    function test_purchaseItem_multipleQuantity_success() public {
        uint256 quantity = 3;
        uint256 totalCost = DEFAULT_BOOK_PRICE * quantity;

        // Mint USDC
        mintUSDC(user1, totalCost);

        // Approve and purchase
        vm.startPrank(user1);
        usdc.approve(address(core), totalCost);
        core.purchaseItem(tokenId, quantity);
        vm.stopPrank();

        // Should own 3 NFTs
        assertEq(core.balanceOf(user1, tokenId), quantity, "User should own 3 NFTs");
    }

    function test_purchaseItem_emitsItemPurchasedEvent() public {
        // Mint and approve USDC
        mintUSDC(user1, DEFAULT_BOOK_PRICE);

        vm.startPrank(user1);
        usdc.approve(address(core), DEFAULT_BOOK_PRICE);

        // Expect event
        vm.expectEmit(true, true, false, true);
        emit ItemPurchased(user1, tokenId, 1, address(usdc));

        core.purchaseItem(tokenId, 1);
        vm.stopPrank();
    }

    // Event definition
    event ItemPurchased(address indexed buyer, uint256 indexed id, uint256 amount, address paymentToken);
}
