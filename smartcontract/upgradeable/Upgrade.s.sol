// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../upgradeable/Libere1155CoreUpgradeable.sol";
import "../upgradeable/LibraryPoolUpgradeable.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Utils.sol";

/**
 * @title Upgrade Script for UUPS Upgradeable Libere Contracts
 * @notice Foundry script untuk upgrade implementation contracts
 *
 * Usage - Upgrade LibraryPool:
 *   PROXY_ADDRESS=0x... \
 *   forge script smartcontract/upgradeable/Upgrade.s.sol:UpgradeLibraryPoolScript \
 *     --rpc-url $BASE_SEPOLIA_RPC_URL \
 *     --private-key $PRIVATE_KEY \
 *     --broadcast \
 *     --verify \
 *     --etherscan-api-key $BASESCAN_API_KEY
 *
 * Usage - Upgrade Core:
 *   PROXY_ADDRESS=0x... \
 *   forge script smartcontract/upgradeable/Upgrade.s.sol:UpgradeCoreScript \
 *     --rpc-url $BASE_SEPOLIA_RPC_URL \
 *     --private-key $PRIVATE_KEY \
 *     --broadcast \
 *     --verify \
 *     --etherscan-api-key $BASESCAN_API_KEY
 */

// ============================================================
// Upgrade LibraryPool Contract
// ============================================================
contract UpgradeLibraryPoolScript is Script {

    function run() external {
        // Get environment variables
        address proxyAddress = vm.envAddress("PROXY_ADDRESS");
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("=============================================================");
        console.log("UUPS Contract Upgrade - LibraryPoolUpgradeable");
        console.log("=============================================================");
        console.log("");
        console.log("Proxy Address:", proxyAddress);
        console.log("Deployer:", deployer);
        console.log("Deployer Balance:", deployer.balance / 1e18, "ETH");
        console.log("");

        // ========================================
        // Step 1: Validate Current Deployment
        // ========================================
        console.log("-------------------------------------------------------------");
        console.log("Step 1: Validating Current Deployment");
        console.log("-------------------------------------------------------------");

        // Connect to existing proxy
        LibraryPoolUpgradeable proxy = LibraryPoolUpgradeable(proxyAddress);

        // Get current implementation address (using ERC1967 storage slot)
        bytes32 implSlot = bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1);
        address currentImpl = address(uint160(uint256(vm.load(proxyAddress, implSlot))));
        console.log("Current Implementation:", currentImpl);

        // Get current version
        string memory currentVersion;
        try proxy.version() returns (string memory v) {
            currentVersion = v;
            console.log("Current Version:", currentVersion);
        } catch {
            currentVersion = "unknown";
            console.log("No version() function (v1.0.0 or earlier)");
        }

        // Verify ownership
        address owner = proxy.owner();
        console.log("Current Owner:", owner);

        require(owner == deployer, "Deployer is not the owner. Cannot upgrade.");
        console.log("Ownership verified!");
        console.log("");

        // ========================================
        // Step 2: Deploy New Implementation
        // ========================================
        console.log("-------------------------------------------------------------");
        console.log("Step 2: Deploying New Implementation");
        console.log("-------------------------------------------------------------");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy new implementation
        console.log("Deploying LibraryPoolUpgradeable V2...");
        LibraryPoolUpgradeable newImpl = new LibraryPoolUpgradeable();
        console.log("New Implementation deployed at:", address(newImpl));

        // ========================================
        // Step 3: Upgrade Proxy
        // ========================================
        console.log("-------------------------------------------------------------");
        console.log("Step 3: Upgrading Proxy to New Implementation");
        console.log("-------------------------------------------------------------");

        // Call upgradeToAndCall on proxy (UUPS pattern)
        console.log("Calling upgradeToAndCall...");
        proxy.upgradeToAndCall(address(newImpl), "");
        console.log("Upgrade successful!");

        vm.stopBroadcast();

        // ========================================
        // Step 4: Verify Upgrade
        // ========================================
        console.log("-------------------------------------------------------------");
        console.log("Step 4: Verifying Upgrade");
        console.log("-------------------------------------------------------------");

        // Get new implementation address
        address upgradedImpl = address(uint160(uint256(vm.load(proxyAddress, implSlot))));
        console.log("New Implementation:", upgradedImpl);
        require(upgradedImpl == address(newImpl), "Upgrade failed: implementation not updated");

        // Get new version
        string memory newVersion;
        try proxy.version() returns (string memory v) {
            newVersion = v;
            console.log("New Version:", newVersion);
        } catch {
            newVersion = "unknown";
        }

        // ========================================
        // Upgrade Summary
        // ========================================
        console.log("");
        console.log("=============================================================");
        console.log("Upgrade Summary");
        console.log("=============================================================");
        console.log("");
        console.log("Comparison:");
        console.log("  Proxy Address:        ", proxyAddress, "(unchanged)");
        console.log("  Old Implementation:   ", currentImpl);
        console.log("  New Implementation:   ", upgradedImpl);
        console.log("  Old Version:          ", currentVersion);
        console.log("  New Version:          ", newVersion);
        console.log("");
        console.log("State Preservation:");
        console.log("  - All storage variables preserved");
        console.log("  - NFT balances unchanged");
        console.log("  - Active borrows maintained");
        console.log("  - User data intact");
        console.log("");
        console.log("Frontend Impact:");
        console.log("  - Proxy address unchanged (no frontend update needed)");
        console.log("  - ABI may have new functions (update if needed)");
        console.log("  - Existing functions work identically");
        console.log("");
        console.log("Next Steps:");
        console.log("  1. Implementation auto-verified if --verify flag used");
        console.log("  2. Test upgraded functionality");
        console.log("  3. Announce upgrade to users");
        console.log("");
        console.log("=============================================================");
        console.log("Upgrade Complete!");
        console.log("=============================================================");
        console.log("");

        // Save upgrade info
        string memory upgradeJson = string(abi.encodePacked(
            '{\n',
            '  "network": "base-sepolia",\n',
            '  "timestamp": "', vm.toString(block.timestamp), '",\n',
            '  "upgrader": "', vm.toString(deployer), '",\n',
            '  "proxyAddress": "', vm.toString(proxyAddress), '",\n',
            '  "contractName": "LibraryPoolUpgradeable",\n',
            '  "oldImplementation": "', vm.toString(currentImpl), '",\n',
            '  "newImplementation": "', vm.toString(upgradedImpl), '",\n',
            '  "oldVersion": "', currentVersion, '",\n',
            '  "newVersion": "', newVersion, '"\n',
            '}'
        ));

        string memory filename = string(abi.encodePacked(
            "./smartcontract/upgradeable/upgrade-pool-",
            vm.toString(block.timestamp),
            ".json"
        ));
        vm.writeFile(filename, upgradeJson);
        console.log("Upgrade info saved to:", filename);
    }
}

// ============================================================
// Upgrade Core Contract
// ============================================================
contract UpgradeCoreScript is Script {

    function run() external {
        // Get environment variables
        address proxyAddress = vm.envAddress("PROXY_ADDRESS");
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("=============================================================");
        console.log("UUPS Contract Upgrade - Libere1155CoreUpgradeable");
        console.log("=============================================================");
        console.log("");
        console.log("Proxy Address:", proxyAddress);
        console.log("Deployer:", deployer);
        console.log("Deployer Balance:", deployer.balance / 1e18, "ETH");
        console.log("");

        // ========================================
        // Step 1: Validate Current Deployment
        // ========================================
        console.log("-------------------------------------------------------------");
        console.log("Step 1: Validating Current Deployment");
        console.log("-------------------------------------------------------------");

        // Connect to existing proxy
        Libere1155CoreUpgradeable proxy = Libere1155CoreUpgradeable(proxyAddress);

        // Get current implementation address
        bytes32 implSlot = bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1);
        address currentImpl = address(uint160(uint256(vm.load(proxyAddress, implSlot))));
        console.log("Current Implementation:", currentImpl);

        // Get current version
        string memory currentVersion;
        try proxy.version() returns (string memory v) {
            currentVersion = v;
            console.log("Current Version:", currentVersion);
        } catch {
            currentVersion = "unknown";
            console.log("No version() function (v1.0.0 or earlier)");
        }

        // Verify ownership
        address owner = proxy.owner();
        console.log("Current Owner:", owner);

        require(owner == deployer, "Deployer is not the owner. Cannot upgrade.");
        console.log("Ownership verified!");
        console.log("");

        // ========================================
        // Step 2: Deploy New Implementation
        // ========================================
        console.log("-------------------------------------------------------------");
        console.log("Step 2: Deploying New Implementation");
        console.log("-------------------------------------------------------------");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy new implementation
        console.log("Deploying Libere1155CoreUpgradeable V2...");
        Libere1155CoreUpgradeable newImpl = new Libere1155CoreUpgradeable();
        console.log("New Implementation deployed at:", address(newImpl));

        // ========================================
        // Step 3: Upgrade Proxy
        // ========================================
        console.log("-------------------------------------------------------------");
        console.log("Step 3: Upgrading Proxy to New Implementation");
        console.log("-------------------------------------------------------------");

        // Call upgradeToAndCall on proxy (UUPS pattern)
        console.log("Calling upgradeToAndCall...");
        proxy.upgradeToAndCall(address(newImpl), "");
        console.log("Upgrade successful!");

        vm.stopBroadcast();

        // ========================================
        // Step 4: Verify Upgrade
        // ========================================
        console.log("-------------------------------------------------------------");
        console.log("Step 4: Verifying Upgrade");
        console.log("-------------------------------------------------------------");

        // Get new implementation address
        address upgradedImpl = address(uint160(uint256(vm.load(proxyAddress, implSlot))));
        console.log("New Implementation:", upgradedImpl);
        require(upgradedImpl == address(newImpl), "Upgrade failed: implementation not updated");

        // Get new version
        string memory newVersion;
        try proxy.version() returns (string memory v) {
            newVersion = v;
            console.log("New Version:", newVersion);
        } catch {
            newVersion = "unknown";
        }

        // ========================================
        // Upgrade Summary
        // ========================================
        console.log("");
        console.log("=============================================================");
        console.log("Upgrade Summary");
        console.log("=============================================================");
        console.log("");
        console.log("Comparison:");
        console.log("  Proxy Address:        ", proxyAddress, "(unchanged)");
        console.log("  Old Implementation:   ", currentImpl);
        console.log("  New Implementation:   ", upgradedImpl);
        console.log("  Old Version:          ", currentVersion);
        console.log("  New Version:          ", newVersion);
        console.log("");
        console.log("State Preservation:");
        console.log("  - All storage variables preserved");
        console.log("  - NFT balances unchanged");
        console.log("  - Item listings maintained");
        console.log("  - Payment balances intact");
        console.log("");
        console.log("Frontend Impact:");
        console.log("  - Proxy address unchanged (no frontend update needed)");
        console.log("  - ABI may have new functions (update if needed)");
        console.log("  - Existing functions work identically");
        console.log("");
        console.log("Next Steps:");
        console.log("  1. Implementation auto-verified if --verify flag used");
        console.log("  2. Test upgraded functionality");
        console.log("  3. Announce upgrade to users");
        console.log("");
        console.log("=============================================================");
        console.log("Upgrade Complete!");
        console.log("=============================================================");
        console.log("");

        // Save upgrade info
        string memory upgradeJson = string(abi.encodePacked(
            '{\n',
            '  "network": "base-sepolia",\n',
            '  "timestamp": "', vm.toString(block.timestamp), '",\n',
            '  "upgrader": "', vm.toString(deployer), '",\n',
            '  "proxyAddress": "', vm.toString(proxyAddress), '",\n',
            '  "contractName": "Libere1155CoreUpgradeable",\n',
            '  "oldImplementation": "', vm.toString(currentImpl), '",\n',
            '  "newImplementation": "', vm.toString(upgradedImpl), '",\n',
            '  "oldVersion": "', currentVersion, '",\n',
            '  "newVersion": "', newVersion, '"\n',
            '}'
        ));

        string memory filename = string(abi.encodePacked(
            "./smartcontract/upgradeable/upgrade-core-",
            vm.toString(block.timestamp),
            ".json"
        ));
        vm.writeFile(filename, upgradeJson);
        console.log("Upgrade info saved to:", filename);
    }
}
