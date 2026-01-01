// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../helpers/TestSetup.sol";

/**
 * @title PoolBorrowTest
 * @notice Unit tests for LibraryPoolUpgradeable borrowing functionality
 * @dev Tests:
 *      - Successful borrow with available stock
 *      - Cannot borrow when no stock available
 *      - Cannot borrow same book twice
 *      - usableBalanceOf updates correctly
 *      - Record ID increments
 *      - Expiry is set correctly
 */
contract PoolBorrowTest is TestSetup {
    uint256 tokenId = 1;

    function setUp() public override {
        super.setUp();

        // Create and donate 1 book to library
        setupBookInLibrary(tokenId, user1, 1);
    }

    function test_borrowFromPool_success() public {
        // Borrow
        vm.prank(user2);
        uint256 recordId = pool.borrowFromPool(tokenId);

        // Assertions
        assertEq(pool.usableBalanceOf(user2, tokenId), 1, "usableBalance should be 1");
        assertTrue(recordId > 0, "Record ID should be greater than 0");
    }

    function test_borrowFromPool_noStock_reverts() public {
        // First user borrows (takes the only copy)
        vm.prank(user2);
        pool.borrowFromPool(tokenId);

        // Second user tries to borrow (should fail - no stock)
        vm.prank(user1);
        vm.expectRevert();
        pool.borrowFromPool(tokenId);
    }

    function test_borrowFromPool_sameTwice_reverts() public {
        // User borrows
        vm.prank(user2);
        pool.borrowFromPool(tokenId);

        // Same user tries to borrow again (should fail)
        vm.prank(user2);
        vm.expectRevert();
        pool.borrowFromPool(tokenId);
    }

    function test_borrowFromPool_recordIdIncrements() public {
        // Setup: Add more books to library
        setupBookInLibrary(2, user1, 1);
        setupBookInLibrary(3, user1, 1);

        // Borrow first book
        vm.prank(user2);
        uint256 recordId1 = pool.borrowFromPool(1);

        // Borrow second book
        vm.prank(user2);
        uint256 recordId2 = pool.borrowFromPool(2);

        // Record IDs should increment
        assertEq(recordId2, recordId1 + 1, "Record IDs should increment");
    }

    function test_borrowFromPool_expiryIsSet() public {
        uint256 borrowTime = block.timestamp;

        // Borrow
        vm.prank(user2);
        uint256 recordId = pool.borrowFromPool(tokenId);

        // Get record details
        (uint256 retTokenId, address owner, address user, uint64 amount, uint64 expiry) = pool.userRecordOf(recordId);

        // Verify expiry is in the future (default: 3 days)
        assertTrue(expiry > borrowTime, "Expiry should be in the future");

        // Verify other fields
        assertEq(retTokenId, tokenId, "Token ID should match");
        assertEq(owner, address(pool), "Owner should be pool");
        assertEq(user, user2, "User should be borrower");
        assertEq(amount, 1, "Amount should be 1");
    }

    function test_borrowFromPool_previewAvailability_decreases() public {
        // Check availability before borrow
        uint256 availableBefore = pool.previewAvailability(tokenId);
        assertEq(availableBefore, 1, "Should have 1 available");

        // Borrow
        vm.prank(user2);
        pool.borrowFromPool(tokenId);

        // Check availability after borrow
        uint256 availableAfter = pool.previewAvailability(tokenId);
        assertEq(availableAfter, 0, "Should have 0 available after borrow");
    }

    function test_borrowFromPool_multipleUsersMultipleBooks() public {
        // Setup: Add more copies
        setupBookInLibrary(tokenId, user1, 2); // Now pool has 3 total copies

        // User2 borrows
        vm.prank(user2);
        pool.borrowFromPool(tokenId);

        // User1 borrows
        vm.prank(user1);
        pool.borrowFromPool(tokenId);

        // Both should have usableBalance = 1
        assertEq(pool.usableBalanceOf(user2, tokenId), 1, "User2 should have usableBalance 1");
        assertEq(pool.usableBalanceOf(user1, tokenId), 1, "User1 should have usableBalance 1");

        // Still 1 copy available
        assertEq(pool.previewAvailability(tokenId), 1, "Should have 1 copy left");
    }

    function test_borrowFromPool_emitsCreateUserRecordEvent() public {
        // Expect CreateUserRecord event
        vm.expectEmit(false, true, true, false);
        emit CreateUserRecord(0, address(pool), user2, tokenId, 1, 0);

        vm.prank(user2);
        pool.borrowFromPool(tokenId);
    }

    // Event definition
    event CreateUserRecord(
        uint256 indexed recordId,
        address indexed owner,
        address indexed user,
        uint256 tokenId,
        uint64 amount,
        uint64 expiry
    );
}
