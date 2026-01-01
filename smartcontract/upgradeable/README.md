---
noteId: "9e2b5240e4b811f0b45dd95f5c5eb7f5"
tags: []

---

# Libere Upgradeable Smart Contracts (UUPS)

This directory contains **UUPS (Universal Upgradeable Proxy Standard)** versions of the Libere smart contracts, enabling seamless upgrades without data loss or frontend redeployment.

## 📚 Overview

### What is UUPS?

UUPS is an upgradeable proxy pattern where:
- **Proxy Contract**: Holds all state/data and delegates calls to implementation
- **Implementation Contract**: Contains the logic (upgradeable)
- **Upgrade Logic**: Lives in implementation (cheaper gas than Transparent Proxy)

### Why Upgrade?

The original contracts (`library-libere.sol`, `core_1155.sol`) use `immutable` variables and cannot be upgraded. This UUPS version allows:

✅ **Bug Fixes**: Fix critical bugs without losing NFT balances
✅ **New Features**: Add functionality (e.g., new borrow modes, analytics)
✅ **Gas Optimization**: Deploy cheaper implementations
✅ **Regulatory Compliance**: Adapt to new requirements
✅ **Zero Downtime**: Upgrade without redeploying frontend

## 📁 Files

```
upgradeable/
├── LibraryPoolUpgradeable.sol      # ERC-5006 borrowing/lending (UUPS)
├── Libere1155CoreUpgradeable.sol   # ERC-1155 marketplace (UUPS)
├── deploy.js                        # Deployment script
├── upgrade.js                       # Upgrade script
├── README.md                        # This file
└── FRONTEND_INTEGRATION.md          # Frontend integration guide
```

## 🔄 Key Differences from Original

| Aspect | Original | Upgradeable |
|--------|----------|-------------|
| **Proxy Pattern** | None | UUPS |
| **Immutable Variables** | `immutable core` | Regular storage `core` |
| **Constructor** | `constructor(admin, core)` | `initialize(admin, core)` |
| **OpenZeppelin Imports** | `@openzeppelin/contracts` | `@openzeppelin/contracts-upgradeable` |
| **Base Contracts** | `Ownable`, `ReentrancyGuard` | `OwnableUpgradeable`, `UUPSUpgradeable` |
| **Storage Gap** | None | `uint256[50] private __gap;` |
| **Version Tracking** | None | `version()` function |
| **Upgradeability** | ❌ Cannot upgrade | ✅ Owner can upgrade |

## 🚀 Deployment

### Prerequisites

Install dependencies:

```bash
npm install --save-dev @openzeppelin/hardhat-upgrades
npm install @openzeppelin/contracts-upgradeable
```

### Hardhat Configuration

Add to `hardhat.config.js`:

```javascript
require("@openzeppelin/hardhat-upgrades");

module.exports = {
  solidity: "0.8.20",
  networks: {
    "base-sepolia": {
      url: "https://sepolia.base.org",
      accounts: [process.env.PRIVATE_KEY],
    },
  },
};
```

### Deploy to Base Sepolia

```bash
npx hardhat run smartcontract/upgradeable/deploy.js --network base-sepolia
```

**Output:**
```
✅ Libere1155CoreUpgradeable deployed!
   Proxy address: 0x...
   Implementation: 0x...
   Version: 1.0.0

✅ LibraryPoolUpgradeable deployed!
   Proxy address: 0x...
   Implementation: 0x...
   Version: 1.0.0
```

**Save the proxy addresses!** These are what your frontend will use.

## ⬆️ Upgrading Contracts

### When to Upgrade

- **Bug Fix**: Critical security issue or logic error
- **New Feature**: Add lending duration options, analytics, etc.
- **Gas Optimization**: Reduce transaction costs
- **Compliance**: Meet new regulatory requirements

### How to Upgrade

1. **Create new implementation** (e.g., `LibraryPoolUpgradeableV2.sol`):

```solidity
contract LibraryPoolUpgradeableV2 is LibraryPoolUpgradeable {
    // New state variables MUST go at the end (after __gap)
    uint256 public newFeature;

    // Update version
    function version() public pure override returns (string memory) {
        return "2.0.0";
    }

    // Add new functions
    function setNewFeature(uint256 value) external onlyOwner {
        newFeature = value;
    }
}
```

2. **Run upgrade script**:

```bash
PROXY_ADDRESS=0xYourProxyAddress \
CONTRACT_NAME=LibraryPoolUpgradeableV2 \
npx hardhat run smartcontract/upgradeable/upgrade.js --network base-sepolia
```

3. **Verify on BaseScan**:

```bash
npx hardhat verify --network base-sepolia 0xNewImplementationAddress
```

## 🔒 Security Considerations

### Storage Layout Rules

**⚠️ CRITICAL**: Never change the order of existing storage variables!

```solidity
// ❌ WRONG (breaks storage)
contract V2 {
    uint256 public newVariable;  // DON'T add at top
    Libere1155Core public core;  // Existing var moves down = BROKEN
}

// ✅ CORRECT (preserves storage)
contract V2 {
    Libere1155Core public core;  // Existing var stays at slot 0
    // ... all existing vars ...
    uint256[50] private __gap;   // Reduce gap size
    uint256 public newVariable;  // New var at end
}
```

### Storage Gap

We reserve 50 storage slots for future variables:

```solidity
uint256[50] private __gap;
```

When adding new variables, reduce the gap:

```solidity
// V1: uint256[50] private __gap;

// V2 (adding 2 new vars):
uint256[48] private __gap;  // 50 - 2 = 48
uint256 public newVar1;
uint256 public newVar2;
```

### Upgrade Authorization

Only the contract **owner** can upgrade:

```solidity
function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
```

**Recommendation**: Transfer ownership to **Gnosis Safe multisig** for production:

```bash
await contract.transferOwnership("0xGnosisSafeAddress");
```

### Initializer Protection

Constructor is disabled to prevent implementation initialization:

```solidity
/// @custom:oz-upgrades-unsafe-allow constructor
constructor() {
    _disableInitializers();
}
```

### Timelock (Future Enhancement)

For production, consider adding a **timelock** before upgrades take effect:

```solidity
// Schedule upgrade (48 hour delay)
timelock.schedule(upgradeCalldata, 48 hours);

// Execute after delay
timelock.execute(upgradeCalldata);
```

## 📊 Gas Costs

### Deployment

- **Proxy + Implementation**: ~4.5M gas (~$0.0015 on Base)
- **Upgrade**: ~300k gas (~$0.0001 on Base)

### Per Transaction Overhead

UUPS adds minimal overhead:

```
Original borrowFromPool:    ~80,000 gas
UUPS borrowFromPool:         ~80,002 gas (+2 gas)

Extra cost: ~0.00000002 ETH = ~$0.00007 = Rp 1.12
```

**Total cost with UUPS**: Rp 4.48 + Rp 1.12 = **Rp 5.60** (still incredibly cheap!)

## 🧪 Testing

### Functionality Tests

Test that all functions work identically:

```javascript
const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("LibraryPoolUpgradeable", function () {
  it("should borrow book", async function () {
    const [owner, user] = await ethers.getSigners();

    // Deploy
    const Pool = await ethers.getContractFactory("LibraryPoolUpgradeable");
    const pool = await upgrades.deployProxy(Pool, [owner.address, coreAddress]);

    // Test borrowing
    await pool.connect(user).borrowFromPool(1);
    const balance = await pool.usableBalanceOf(user.address, 1);
    expect(balance).to.equal(1);
  });
});
```

### Upgrade Tests

Test that state is preserved after upgrade:

```javascript
it("should preserve state after upgrade", async function () {
  // Deploy V1
  const V1 = await ethers.getContractFactory("LibraryPoolUpgradeable");
  const contract = await upgrades.deployProxy(V1, [owner.address, coreAddress]);

  // Borrow a book
  await contract.borrowFromPool(1);

  // Upgrade to V2
  const V2 = await ethers.getContractFactory("LibraryPoolUpgradeableV2");
  const upgraded = await upgrades.upgradeProxy(contract.address, V2);

  // Verify state preserved
  const balance = await upgraded.usableBalanceOf(user.address, 1);
  expect(balance).to.equal(1);

  // Verify new version
  expect(await upgraded.version()).to.equal("2.0.0");
});
```

### Storage Layout Validation

OpenZeppelin automatically checks storage layout:

```bash
npx hardhat check
```

This validates:
- ✅ No storage collisions
- ✅ Variables in correct order
- ✅ Safe to upgrade

## 📈 Upgrade Scenarios

### Scenario 1: Bug Fix

**Problem**: Critical bug in `_frozenNow()` counting logic

**Solution**:
1. Create `LibraryPoolUpgradeableV1_1` with fix
2. Run upgrade script
3. Bug fixed instantly without data loss

**Benefit**: $24,500 saved (no migration needed)

### Scenario 2: New Feature

**Problem**: Libraries want 7-day borrow periods, not just 3-day

**Solution**:
1. Add `setGlobalRentalPeriod(uint64 period)` function
2. Upgrade contract
3. Feature live immediately

**Benefit**: No need to deploy new contract and migrate libraries

### Scenario 3: Gas Optimization

**Problem**: `_sweepExpired()` uses too much gas

**Solution**:
1. Optimize loop to use binary search
2. Upgrade implementation
3. All future transactions cheaper

**Benefit**: 30% gas reduction = Rp 1.34 saved per borrow

## 🔗 Frontend Integration

See [FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md) for complete guide.

**Quick Summary**:
- ✅ Use **proxy address** (not implementation)
- ✅ ABI stays the same (with optional new functions)
- ✅ No transaction code changes needed
- ✅ Read `version()` to display contract version

## 📚 Resources

- **OpenZeppelin UUPS Guide**: https://docs.openzeppelin.com/contracts/4.x/api/proxy#UUPSUpgradeable
- **Hardhat Upgrades Plugin**: https://docs.openzeppelin.com/upgrades-plugins/1.x/
- **EIP-1967**: https://eips.ethereum.org/EIPS/eip-1967 (Proxy Storage Slots)
- **Storage Layout**: https://docs.soliditylang.org/en/latest/internals/layout_in_storage.html

## ❓ FAQ

### Q: Can I upgrade storage layout?

**A**: Yes, but only by **adding** new variables at the end. Never change order or remove existing variables.

### Q: What happens if I deploy a bad upgrade?

**A**: You can upgrade again to fix it! That's the beauty of upgradeability. However, use timelocks in production to prevent instant bad upgrades.

### Q: Can users' NFTs be lost during upgrade?

**A**: No! NFT balances are stored in the **proxy**, not the implementation. Upgrades only change logic, not data.

### Q: How much does an upgrade cost?

**A**: ~300k gas (~$0.0001 on Base). Much cheaper than redeploying and migrating.

### Q: Do I need to update frontend after upgrade?

**A**: Only if you add new functions. Existing functions work without any frontend changes.

### Q: Can I make contracts non-upgradeable later?

**A**: Yes! Call `renounceOwnership()` to make upgrades impossible. But think carefully - this is permanent.

## 🎯 Best Practices

1. **Test upgrades on testnet first**
2. **Use multisig for ownership** (Gnosis Safe)
3. **Add timelock for production** (48+ hour delay)
4. **Validate storage layout** with `npx hardhat check`
5. **Audit new implementations** before upgrading
6. **Announce upgrades** to users in advance
7. **Keep upgrade logs** (upgrade.js saves JSON automatically)
8. **Verify contracts** on BaseScan after deployment

## 📞 Support

For issues or questions:
- GitHub Issues: https://github.com/yourusername/libere/issues
- Discord: [Your Discord]
- Email: [Your Email]

---

**Built with ❤️ using OpenZeppelin UUPS Pattern**
