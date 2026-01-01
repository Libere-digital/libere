// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../upgradeable/Libere1155CoreUpgradeable.sol";
import "../upgradeable/LibraryPoolUpgradeable.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title Deploy Script for UUPS Upgradeable Libere Contracts
 * @notice Foundry script untuk deploy proxy + implementation contracts
 *
 * Usage:
 *   forge script smartcontract/upgradeable/Deploy.s.sol:DeployScript \
 *     --rpc-url $BASE_SEPOLIA_RPC_URL \
 *     --private-key $PRIVATE_KEY \
 *     --broadcast \
 *     --verify \
 *     --etherscan-api-key $BASESCAN_API_KEY
 *
 * Atau dengan cast wallet:
 *   forge script smartcontract/upgradeable/Deploy.s.sol:DeployScript \
 *     --rpc-url $BASE_SEPOLIA_RPC_URL \
 *     --account deployer \
 *     --sender $DEPLOYER_ADDRESS \
 *     --broadcast
 */
contract DeployScript is Script {

    function run() external {
        // Get deployer from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("=============================================================");
        console.log("UUPS Proxy Deployment - Libere Upgradeable Contracts");
        console.log("=============================================================");
        console.log("");
        console.log("Deployer address:", deployer);
        console.log("Deployer balance:", deployer.balance / 1e18, "ETH");
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // ========================================
        // Step 1: Deploy Libere1155CoreUpgradeable
        // ========================================
        console.log("-------------------------------------------------------------");
        console.log("Step 1: Deploying Libere1155CoreUpgradeable (Marketplace)");
        console.log("-------------------------------------------------------------");

        // Deploy implementation
        console.log("Deploying implementation contract...");
        Libere1155CoreUpgradeable coreImpl = new Libere1155CoreUpgradeable();
        console.log("Core Implementation deployed at:", address(coreImpl));

        // Prepare initialization data
        bytes memory coreInitData = abi.encodeWithSelector(
            Libere1155CoreUpgradeable.initialize.selector,
            deployer  // admin
        );

        // Deploy proxy
        console.log("Deploying ERC1967Proxy for Core...");
        ERC1967Proxy coreProxy = new ERC1967Proxy(
            address(coreImpl),
            coreInitData
        );
        console.log("Core Proxy deployed at:", address(coreProxy));

        // Wrap proxy in interface for easier interaction
        Libere1155CoreUpgradeable core = Libere1155CoreUpgradeable(address(coreProxy));

        // Verify initialization
        string memory coreVersion = core.version();
        address coreOwner = core.owner();
        console.log("Core Version:", coreVersion);
        console.log("Core Owner:", coreOwner);
        console.log("");

        // ========================================
        // Step 2: Deploy LibraryPoolUpgradeable
        // ========================================
        console.log("-------------------------------------------------------------");
        console.log("Step 2: Deploying LibraryPoolUpgradeable (Lending/Borrowing)");
        console.log("-------------------------------------------------------------");

        // Deploy implementation
        console.log("Deploying implementation contract...");
        LibraryPoolUpgradeable poolImpl = new LibraryPoolUpgradeable();
        console.log("Pool Implementation deployed at:", address(poolImpl));

        // Prepare initialization data
        bytes memory poolInitData = abi.encodeWithSelector(
            LibraryPoolUpgradeable.initialize.selector,
            deployer,           // admin
            Libere1155Core(address(core))  // core contract
        );

        // Deploy proxy
        console.log("Deploying ERC1967Proxy for Pool...");
        ERC1967Proxy poolProxy = new ERC1967Proxy(
            address(poolImpl),
            poolInitData
        );
        console.log("Pool Proxy deployed at:", address(poolProxy));

        // Wrap proxy in interface
        LibraryPoolUpgradeable pool = LibraryPoolUpgradeable(address(poolProxy));

        // Verify initialization
        string memory poolVersion = pool.version();
        address poolOwner = pool.owner();
        address poolCore = address(pool.core());
        console.log("Pool Version:", poolVersion);
        console.log("Pool Owner:", poolOwner);
        console.log("Pool Core Reference:", poolCore);
        console.log("");

        vm.stopBroadcast();

        // ========================================
        // Deployment Summary
        // ========================================
        console.log("=============================================================");
        console.log("Deployment Summary");
        console.log("=============================================================");
        console.log("");
        console.log("Contract Addresses (save these!):");
        console.log("");
        console.log("Libere1155CoreUpgradeable:");
        console.log("  Proxy:          ", address(coreProxy));
        console.log("  Implementation: ", address(coreImpl));
        console.log("");
        console.log("LibraryPoolUpgradeable:");
        console.log("  Proxy:          ", address(poolProxy));
        console.log("  Implementation: ", address(poolImpl));
        console.log("");
        console.log("Frontend Integration:");
        console.log("  - Update contractAddress to:", address(coreProxy));
        console.log("  - Update libraryPoolAddress to:", address(poolProxy));
        console.log("  - ABI remains the same (proxy delegates to implementation)");
        console.log("");
        console.log("Security:");
        console.log("  - Owner:", deployer);
        console.log("  - Only owner can upgrade contracts");
        console.log("  - Consider transferring ownership to multisig (Gnosis Safe)");
        console.log("");
        console.log("Next Steps:");
        console.log("  1. Contracts auto-verified if --verify flag used");
        console.log("  2. Set payment token (USDC):");
        console.log("     cast send", address(coreProxy), '"setPaymentToken(address)"');
        console.log("     0x036CbD53842c5426634e7929541eC2318f3dCF7e");
        console.log("     --rpc-url $BASE_SEPOLIA_RPC_URL --private-key $PRIVATE_KEY");
        console.log("  3. Test borrowing flow");
        console.log("  4. Update frontend with new addresses");
        console.log("");
        console.log("=============================================================");
        console.log("Deployment Complete!");
        console.log("=============================================================");
        console.log("");

        // Save deployment addresses to file
        string memory deploymentJson = string(abi.encodePacked(
            '{\n',
            '  "network": "base-sepolia",\n',
            '  "timestamp": "', vm.toString(block.timestamp), '",\n',
            '  "deployer": "', vm.toString(deployer), '",\n',
            '  "contracts": {\n',
            '    "core": {\n',
            '      "proxy": "', vm.toString(address(coreProxy)), '",\n',
            '      "implementation": "', vm.toString(address(coreImpl)), '",\n',
            '      "version": "', coreVersion, '"\n',
            '    },\n',
            '    "pool": {\n',
            '      "proxy": "', vm.toString(address(poolProxy)), '",\n',
            '      "implementation": "', vm.toString(address(poolImpl)), '",\n',
            '      "version": "', poolVersion, '"\n',
            '    }\n',
            '  }\n',
            '}'
        ));

        vm.writeFile("./smartcontract/upgradeable/deployment.json", deploymentJson);
        console.log("Deployment info saved to: smartcontract/upgradeable/deployment.json");
    }
}
