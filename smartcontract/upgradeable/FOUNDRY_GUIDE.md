---
noteId: "d168e2c0e4b911f0b45dd95f5c5eb7f5"
tags: []

---

# Foundry Deployment Guide - UUPS Upgradeable Contracts

Panduan lengkap untuk deploy dan upgrade smart contract UUPS menggunakan **Foundry** (bukan Hardhat).

## 🎯 Kenapa Foundry?

- ⚡ **Lebih cepat**: 10-100x lebih cepat compile & test
- 🦀 **Native Solidity**: Script ditulis dalam Solidity, bukan JavaScript
- 💰 **Gas reporting**: Estimasi gas yang sangat akurat
- 🔍 **Built-in fuzzing**: Testing lebih comprehensive
- 📦 **Dependency management**: Lebih simple tanpa npm

## 📦 Prerequisites

### Install Foundry

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash

# Reload terminal, then:
foundryup

# Verify installation
forge --version
cast --version
```

### Install Dependencies

```bash
# Install OpenZeppelin contracts
npm install @openzeppelin/contracts@5.0.0 @openzeppelin/contracts-upgradeable@5.0.0

# Atau dengan pnpm
pnpm add @openzeppelin/contracts@5.0.0 @openzeppelin/contracts-upgradeable@5.0.0
```

## ⚙️ Configuration

### 1. Setup Environment Variables

Copy `.env.example` dan edit:

```bash
cp smartcontract/upgradeable/.env.example .env
```

Edit `.env`:

```bash
# Private key (JANGAN COMMIT!)
PRIVATE_KEY=0xYourPrivateKeyHere

# RPC URL
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# BaseScan API Key (untuk verifikasi)
BASESCAN_API_KEY=YourBaseScanApiKeyHere
```

**Security Note**: Tambahkan `.env` ke `.gitignore`!

### 2. Verify foundry.toml

File [foundry.toml](../../foundry.toml) sudah dikonfigurasi dengan:

```toml
[profile.default]
src = "smartcontract"
out = "out"
libs = ["node_modules"]
remappings = [
    "@openzeppelin/contracts/=node_modules/@openzeppelin/contracts/",
    "@openzeppelin/contracts-upgradeable/=node_modules/@openzeppelin/contracts-upgradeable/"
]
solc = "0.8.20"
optimizer = true
optimizer_runs = 200
```

## 🚀 Deployment

### Compile Contracts

```bash
# Compile semua contracts
forge build

# Output:
# [⠊] Compiling...
# [⠒] Compiling 25 files with 0.8.20
# [⠢] Solc 0.8.20 finished in 3.21s
# Compiler run successful!
```

### Deploy to Base Sepolia

```bash
# Load environment variables
source .env

# Deploy dengan verification
forge script smartcontract/upgradeable/Deploy.s.sol:DeployScript \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY \
  -vvvv
```

**Flags explained**:
- `--broadcast`: Actually send transactions (without this, it's a dry-run)
- `--verify`: Auto-verify on BaseScan
- `-vvvv`: Very verbose output (useful for debugging)

### Expected Output

```
=============================================================
UUPS Proxy Deployment - Libere Upgradeable Contracts
=============================================================

Deployer address: 0xYourAddress
Deployer balance: 0.5 ETH

-------------------------------------------------------------
Step 1: Deploying Libere1155CoreUpgradeable (Marketplace)
-------------------------------------------------------------
Deploying implementation contract...
Core Implementation deployed at: 0xImplementationAddress1
Deploying ERC1967Proxy for Core...
Core Proxy deployed at: 0xProxyAddress1
Core Version: 1.0.0
Core Owner: 0xYourAddress

-------------------------------------------------------------
Step 2: Deploying LibraryPoolUpgradeable (Lending/Borrowing)
-------------------------------------------------------------
Deploying implementation contract...
Pool Implementation deployed at: 0xImplementationAddress2
Deploying ERC1967Proxy for Pool...
Pool Proxy deployed at: 0xProxyAddress2
Pool Version: 1.0.0
Pool Owner: 0xYourAddress
Pool Core Reference: 0xProxyAddress1

=============================================================
Deployment Summary
=============================================================

Contract Addresses (save these!):

Libere1155CoreUpgradeable:
  Proxy:           0xProxyAddress1
  Implementation:  0xImplementationAddress1

LibraryPoolUpgradeable:
  Proxy:           0xProxyAddress2
  Implementation:  0xImplementationAddress2

Deployment info saved to: smartcontract/upgradeable/deployment.json
```

### Save Deployment Info

File `deployment.json` akan otomatis tersimpan:

```json
{
  "network": "base-sepolia",
  "timestamp": "1735488000",
  "deployer": "0xYourAddress",
  "contracts": {
    "core": {
      "proxy": "0xProxyAddress1",
      "implementation": "0xImplementationAddress1",
      "version": "1.0.0"
    },
    "pool": {
      "proxy": "0xProxyAddress2",
      "implementation": "0xImplementationAddress2",
      "version": "1.0.0"
    }
  }
}
```

## ⬆️ Upgrading Contracts

### Step 1: Modify Contract (Create V2)

Contoh: Tambah fitur baru di `LibraryPoolUpgradeable`:

```solidity
// LibraryPoolUpgradeable.sol
contract LibraryPoolUpgradeable is ... {
    // ... existing code ...

    // New state variable (MUST go at end, after reducing __gap)
    uint256[48] private __gap;  // Reduced from 50 to 48
    uint256 public maxBorrowDuration;
    uint256 public globalBorrowCount;

    // Override version
    function version() public pure virtual override returns (string memory) {
        return "2.0.0";  // Increment version
    }

    // New function
    function setMaxBorrowDuration(uint256 duration) external onlyOwner {
        maxBorrowDuration = duration;
    }

    function getGlobalStats() external view returns (uint256) {
        return globalBorrowCount;
    }
}
```

### Step 2: Compile New Version

```bash
forge build
```

### Step 3: Upgrade LibraryPool

```bash
# Set proxy address from deployment.json
export PROXY_ADDRESS=0xYourLibraryPoolProxyAddress

# Run upgrade script
forge script smartcontract/upgradeable/Upgrade.s.sol:UpgradeLibraryPoolScript \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY \
  -vvvv
```

### Expected Output

```
=============================================================
UUPS Contract Upgrade - LibraryPoolUpgradeable
=============================================================

Proxy Address: 0xProxyAddress2
Deployer: 0xYourAddress

-------------------------------------------------------------
Step 1: Validating Current Deployment
-------------------------------------------------------------
Current Implementation: 0xOldImplementation
Current Version: 1.0.0
Current Owner: 0xYourAddress
Ownership verified!

-------------------------------------------------------------
Step 2: Deploying New Implementation
-------------------------------------------------------------
Deploying LibraryPoolUpgradeable V2...
New Implementation deployed at: 0xNewImplementation

-------------------------------------------------------------
Step 3: Upgrading Proxy to New Implementation
-------------------------------------------------------------
Calling upgradeToAndCall...
Upgrade successful!

-------------------------------------------------------------
Step 4: Verifying Upgrade
-------------------------------------------------------------
New Implementation: 0xNewImplementation
New Version: 2.0.0

=============================================================
Upgrade Summary
=============================================================

Comparison:
  Proxy Address:        0xProxyAddress2 (unchanged)
  Old Implementation:   0xOldImplementation
  New Implementation:   0xNewImplementation
  Old Version:          1.0.0
  New Version:          2.0.0

State Preservation:
  - All storage variables preserved
  - NFT balances unchanged
  - Active borrows maintained

Upgrade info saved to: smartcontract/upgradeable/upgrade-pool-1735488000.json
```

### Step 4: Upgrade Core (if needed)

```bash
export PROXY_ADDRESS=0xYourCoreProxyAddress

forge script smartcontract/upgradeable/Upgrade.s.sol:UpgradeCoreScript \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY \
  -vvvv
```

## 🧪 Testing

### Local Testing (Anvil)

```bash
# Terminal 1: Start local node
anvil

# Terminal 2: Deploy to local
forge script smartcontract/upgradeable/Deploy.s.sol:DeployScript \
  --rpc-url http://localhost:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast
```

### Dry Run (Simulation)

Test deployment tanpa broadcast:

```bash
# Simulate deployment
forge script smartcontract/upgradeable/Deploy.s.sol:DeployScript \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY
  # Note: NO --broadcast flag
```

### Gas Report

```bash
# Get gas estimates
forge test --gas-report
```

## 🔍 Contract Interaction

### Read Contract Data

```bash
# Get contract version
cast call 0xProxyAddress "version()" --rpc-url $BASE_SEPOLIA_RPC_URL

# Get owner
cast call 0xProxyAddress "owner()" --rpc-url $BASE_SEPOLIA_RPC_URL

# Get usable balance
cast call 0xLibraryPoolProxy "usableBalanceOf(address,uint256)" \
  0xUserAddress 1 \
  --rpc-url $BASE_SEPOLIA_RPC_URL

# Preview availability
cast call 0xLibraryPoolProxy "previewAvailability(uint256)" 1 \
  --rpc-url $BASE_SEPOLIA_RPC_URL
```

### Write Transactions

```bash
# Set payment token (USDC)
cast send 0xCoreProxy "setPaymentToken(address)" \
  0x036CbD53842c5426634e7929541eC2318f3dCF7e \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY

# Borrow book
cast send 0xLibraryPoolProxy "borrowFromPool(uint256)" 1 \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY

# Return book
cast send 0xLibraryPoolProxy "returnMyBorrow(uint256)" 1 \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY
```

## 🔐 Security Best Practices

### 1. Private Key Management

**Never commit private key!** Use Foundry's keystore:

```bash
# Create encrypted keystore
cast wallet import deployer --interactive

# Use keystore in scripts
forge script Deploy.s.sol:DeployScript \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --account deployer \
  --sender 0xYourAddress \
  --broadcast
```

### 2. Ownership Transfer to Multisig

```bash
# Transfer ownership to Gnosis Safe
cast send 0xProxyAddress "transferOwnership(address)" \
  0xGnosisSafeAddress \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY
```

### 3. Verify on BaseScan

Jika auto-verify gagal, manual verify:

```bash
forge verify-contract \
  --chain-id 84532 \
  --num-of-optimizations 200 \
  --watch \
  --constructor-args $(cast abi-encode "constructor()") \
  --etherscan-api-key $BASESCAN_API_KEY \
  --compiler-version 0.8.20 \
  0xImplementationAddress \
  smartcontract/upgradeable/LibraryPoolUpgradeable.sol:LibraryPoolUpgradeable
```

## 📊 Gas Optimization Tips

### 1. Optimizer Runs

Sesuaikan `optimizer_runs` di `foundry.toml`:

```toml
# For deployment-heavy (fewer runs = smaller bytecode)
optimizer_runs = 200

# For transaction-heavy (more runs = cheaper execution)
optimizer_runs = 1000
```

### 2. Gas Snapshots

Track gas usage over time:

```bash
# Create snapshot
forge snapshot

# Compare with previous
forge snapshot --diff
```

### 3. Gas Report

```bash
forge test --gas-report
```

## 🛠️ Troubleshooting

### Error: "Compiler version mismatch"

```bash
# Install specific solc version
foundryup --version nightly
```

### Error: "Failed to verify"

Manual verification:

```bash
forge verify-contract 0xAddress smartcontract/upgradeable/Contract.sol:Contract \
  --etherscan-api-key $BASESCAN_API_KEY \
  --chain base-sepolia
```

### Error: "Nonce too low"

Reset nonce:

```bash
cast nonce 0xYourAddress --rpc-url $BASE_SEPOLIA_RPC_URL
```

### Error: "Insufficient funds"

Get testnet ETH:
- https://docs.base.org/tools/network-faucets

## 📚 Useful Commands Cheat Sheet

```bash
# Compile
forge build

# Clean build
forge clean && forge build

# Test
forge test
forge test -vvvv  # Very verbose
forge test --match-test testBorrow  # Specific test

# Gas report
forge test --gas-report

# Deploy (dry-run)
forge script Deploy.s.sol --rpc-url $RPC

# Deploy (actual)
forge script Deploy.s.sol --rpc-url $RPC --broadcast

# Read contract
cast call 0xAddress "functionName()" --rpc-url $RPC

# Write contract
cast send 0xAddress "functionName()" --rpc-url $RPC --private-key $KEY

# Get balance
cast balance 0xAddress --rpc-url $RPC

# Get block number
cast block-number --rpc-url $RPC

# Decode transaction
cast tx 0xTxHash --rpc-url $RPC

# Storage slot
cast storage 0xAddress 0 --rpc-url $RPC
```

## 🔗 Resources

- **Foundry Book**: https://book.getfoundry.sh/
- **Foundry GitHub**: https://github.com/foundry-rs/foundry
- **Base Sepolia Explorer**: https://sepolia.basescan.org
- **Base Faucet**: https://docs.base.org/tools/network-faucets

## 📞 Support

Issues atau pertanyaan? Check:
- [README.md](./README.md) - Dokumentasi lengkap UUPS
- [FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md) - Integrasi frontend

---

**Happy Deploying with Foundry! ⚒️**
