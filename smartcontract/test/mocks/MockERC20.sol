// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockERC20
 * @notice Simple ERC20 mock for testing (simulates USDC)
 * @dev Features:
 *      - Configurable decimals (default 6 for USDC)
 *      - Public mint function for test setup
 *      - Standard ERC20 functionality
 */
contract MockERC20 is ERC20 {
    uint8 private _decimals;

    /**
     * @notice Constructor
     * @param name Token name (e.g., "Mock USDC")
     * @param symbol Token symbol (e.g., "USDC")
     * @param decimals_ Token decimals (e.g., 6 for USDC)
     */
    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_
    ) ERC20(name, symbol) {
        _decimals = decimals_;
    }

    /**
     * @notice Override decimals to return custom value
     */
    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    /**
     * @notice Mint tokens to any address (for testing only)
     * @param to Recipient address
     * @param amount Amount to mint (in token units)
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /**
     * @notice Burn tokens from any address (for testing only)
     * @param from Address to burn from
     * @param amount Amount to burn
     */
    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }
}
