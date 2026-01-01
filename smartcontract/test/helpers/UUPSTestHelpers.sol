// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

/**
 * @title UUPSTestHelpers
 * @notice Helper functions specific to UUPS proxy testing
 * @dev Provides utilities for:
 *      - Reading implementation address from proxy storage
 *      - Validating storage slots
 *      - Upgrade testing patterns
 */
abstract contract UUPSTestHelpers is Test {
    /**
     * @notice Get the implementation address from a UUPS proxy
     * @dev Reads from EIP-1967 implementation storage slot:
     *      bytes32(uint256(keccak256('eip1967.proxy.implementation')) - 1)
     * @param proxy Address of the proxy contract
     * @return impl Address of the current implementation contract
     */
    function getImplementation(address proxy) public view returns (address impl) {
        // EIP-1967 implementation slot
        bytes32 implSlot = bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1);

        // Read from storage
        bytes32 implBytes = vm.load(proxy, implSlot);

        // Convert bytes32 to address
        impl = address(uint160(uint256(implBytes)));
    }

    /**
     * @notice Get the admin address from a UUPS proxy (EIP-1967)
     * @dev Reads from EIP-1967 admin storage slot:
     *      bytes32(uint256(keccak256('eip1967.proxy.admin')) - 1)
     * @param proxy Address of the proxy contract
     * @return admin Address of the proxy admin
     */
    function getProxyAdmin(address proxy) public view returns (address admin) {
        // EIP-1967 admin slot
        bytes32 adminSlot = bytes32(uint256(keccak256("eip1967.proxy.admin")) - 1);

        // Read from storage
        bytes32 adminBytes = vm.load(proxy, adminSlot);

        // Convert bytes32 to address
        admin = address(uint160(uint256(adminBytes)));
    }

    /**
     * @notice Validate that a storage slot contains the expected value
     * @param proxy Address of the proxy contract
     * @param slot Storage slot to check
     * @param expectedValue Expected value in the slot
     */
    function validateStorageSlot(
        address proxy,
        bytes32 slot,
        bytes32 expectedValue
    ) public view {
        bytes32 actualValue = vm.load(proxy, slot);
        require(
            actualValue == expectedValue,
            "Storage slot mismatch"
        );
    }

    /**
     * @notice Validate that implementation address changed after upgrade
     * @param proxy Address of the proxy
     * @param oldImpl Address of old implementation
     * @param newImpl Address of new implementation
     */
    function validateUpgrade(
        address proxy,
        address oldImpl,
        address newImpl
    ) public view {
        address currentImpl = getImplementation(proxy);

        require(currentImpl != oldImpl, "Implementation not changed");
        require(currentImpl == newImpl, "Implementation not set to new address");
    }

    /**
     * @notice Calculate storage gap size needed for new variables
     * @dev Formula: newGapSize = oldGapSize - numberOfNewVariables
     * @param oldGapSize Previous storage gap size (e.g., 50)
     * @param numberOfNewVariables Number of new state variables added
     * @return newGapSize Required new gap size
     */
    function calculateNewGapSize(
        uint256 oldGapSize,
        uint256 numberOfNewVariables
    ) public pure returns (uint256 newGapSize) {
        require(
            numberOfNewVariables <= oldGapSize,
            "Not enough gap space for new variables"
        );
        newGapSize = oldGapSize - numberOfNewVariables;
    }

    /**
     * @notice Helper to expect unauthorized upgrade revert
     * @dev Use in tests to ensure non-owners cannot upgrade
     */
    function expectUnauthorizedUpgrade() public {
        vm.expectRevert(); // Ownable: caller is not the owner
    }

    /**
     * @notice Helper to expect reinitialization revert
     * @dev Use in tests to ensure initialize() can only be called once
     */
    function expectReinitializationRevert() public {
        vm.expectRevert(); // Initializable: contract is already initialized
    }
}
