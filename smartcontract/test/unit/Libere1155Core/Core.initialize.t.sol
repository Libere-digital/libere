// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../helpers/TestSetup.sol";
import "../../helpers/UUPSTestHelpers.sol";

/**
 * @title CoreInitializeTest
 * @notice Unit tests for Libere1155CoreUpgradeable initialization
 * @dev Tests:
 *      - Successful initialization with valid parameters
 *      - Cannot initialize twice (reinitializer guard)
 *      - Constructor disables initializers on implementation
 *      - Owner is set correctly
 *      - Version tracking
 */
contract CoreInitializeTest is TestSetup, UUPSTestHelpers {
    function test_initialize_setsOwnerCorrectly() public {
        // Verify owner is admin
        assertEq(core.owner(), admin, "Owner should be admin");
    }

    function test_initialize_setsVersionCorrectly() public {
        // Verify version is 1.0.0
        string memory version = core.version();
        assertEq(version, "1.0.0", "Version should be 1.0.0");
    }

    function test_initialize_cannotInitializeTwice() public {
        // Try to initialize again (should fail)
        vm.expectRevert();
        core.initialize(user1);
    }

    function test_initialize_implementationHasInitializersDisabled() public {
        // Get implementation address
        address implAddress = getImplementation(address(core));

        // Try to initialize the implementation directly (should fail)
        Libere1155CoreUpgradeable impl = Libere1155CoreUpgradeable(implAddress);

        vm.expectRevert();
        impl.initialize(admin);
    }

    function test_initialize_paymentTokenIsZeroByDefault() public {
        // Deploy a fresh core contract
        Libere1155CoreUpgradeable freshCoreImpl = new Libere1155CoreUpgradeable();

        bytes memory initData = abi.encodeWithSelector(
            Libere1155CoreUpgradeable.initialize.selector,
            user1
        );

        ERC1967Proxy freshProxy = new ERC1967Proxy(
            address(freshCoreImpl),
            initData
        );

        Libere1155CoreUpgradeable freshCore = Libere1155CoreUpgradeable(address(freshProxy));

        // Payment token should be address(0) initially
        assertEq(freshCore.paymentToken(), address(0), "Payment token should be zero initially");
    }

    function test_initialize_platformFeeRecipientIsZeroByDefault() public {
        // Deploy a fresh core contract
        Libere1155CoreUpgradeable freshCoreImpl = new Libere1155CoreUpgradeable();

        bytes memory initData = abi.encodeWithSelector(
            Libere1155CoreUpgradeable.initialize.selector,
            user1
        );

        ERC1967Proxy freshProxy = new ERC1967Proxy(
            address(freshCoreImpl),
            initData
        );

        Libere1155CoreUpgradeable freshCore = Libere1155CoreUpgradeable(address(freshProxy));

        // Platform fee recipient should be address(0) initially
        assertEq(freshCore.platformFeeRecipient(), address(0), "Platform fee recipient should be zero initially");
    }

    function test_initialize_platformFeeBpsIsZeroByDefault() public {
        // Deploy a fresh core contract
        Libere1155CoreUpgradeable freshCoreImpl = new Libere1155CoreUpgradeable();

        bytes memory initData = abi.encodeWithSelector(
            Libere1155CoreUpgradeable.initialize.selector,
            user1
        );

        ERC1967Proxy freshProxy = new ERC1967Proxy(
            address(freshCoreImpl),
            initData
        );

        Libere1155CoreUpgradeable freshCore = Libere1155CoreUpgradeable(address(freshProxy));

        // Platform fee should be 0 initially
        assertEq(freshCore.platformFeeBps(), 0, "Platform fee bps should be zero initially");
    }

    function test_initialize_emitsOwnershipTransferredEvent() public {
        // Deploy a fresh core contract to test event
        Libere1155CoreUpgradeable freshCoreImpl = new Libere1155CoreUpgradeable();

        bytes memory initData = abi.encodeWithSelector(
            Libere1155CoreUpgradeable.initialize.selector,
            user1
        );

        // Expect OwnershipTransferred event
        vm.expectEmit(true, true, false, false);
        emit OwnershipTransferred(address(0), user1);

        new ERC1967Proxy(address(freshCoreImpl), initData);
    }

    // Event definition for testing
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
}
