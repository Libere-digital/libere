---
noteId: "ca577510e4b811f0b45dd95f5c5eb7f5"
tags: []

---

# Frontend Integration Guide - UUPS Upgradeable Contracts

This guide explains how to integrate the UUPS upgradeable contracts with your React/TypeScript frontend.

## 🎯 Quick Summary

**Main Difference**: Use **proxy address** instead of implementation address.

```typescript
// ❌ OLD (non-upgradeable)
const contractAddress = "0xImplementationAddress";

// ✅ NEW (upgradeable)
const contractAddress = "0xProxyAddress"; // from deployment.json
```

**Everything else stays the same!** The proxy delegates all calls to the implementation.

## 📝 Step-by-Step Integration

### Step 1: Update Contract Addresses

After deploying upgradeable contracts, update these files:

#### `src/library-pool.abi.ts`

```typescript
import libraryPoolAbi from '../abi-libere.json';

// Update this address to the PROXY address from deployment.json
export const libraryPoolAddress = '0xYourLibraryPoolProxyAddress';

export const libraryPoolABI = libraryPoolAbi as any;
```

#### `src/smart-contract.abi.ts`

```typescript
import smartContractAbi from './abi.json';

// Update this address to the PROXY address from deployment.json
export const contractAddress = '0xYourCoreProxyAddress';

export const smartContractABI = smartContractAbi as any;
```

### Step 2: Verify ABI Compatibility

The ABI remains **99% the same**. Only difference is the new `version()` function:

```json
{
  "name": "version",
  "inputs": [],
  "outputs": [{"type": "string"}],
  "stateMutability": "pure"
}
```

You can safely use the existing ABI, or regenerate it from the upgradeable contract.

### Step 3: Update Configuration File

If you use a central config file ([src/libs/config.ts](../../src/libs/config.ts)), update it:

```typescript
// config.ts
export default {
  contracts: {
    core: {
      address: "0xYourCoreProxyAddress",      // From deployment.json
      abi: smartContractABI,
    },
    libraryPool: {
      address: "0xYourLibraryPoolProxyAddress", // From deployment.json
      abi: libraryPoolABI,
    },
  },
};
```

### Step 4: No Code Changes Needed!

All existing transaction code works without modification:

```typescript
// ✅ This code works exactly the same with UUPS proxy!
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { encodeFunctionData } from "viem";
import { libraryPoolAddress, libraryPoolABI } from "./library-pool.abi";

const { client } = useSmartWallets();

// Borrow function - NO CHANGES NEEDED
const borrowData = encodeFunctionData({
  abi: libraryPoolABI,
  functionName: "borrowFromPool",
  args: [BigInt(bookId)],
});

const txHash = await client.sendTransaction({
  chain: baseSepolia,
  to: libraryPoolAddress, // Proxy address
  data: borrowData,
});
```

**Why does this work?**
- Proxy receives the transaction
- Proxy delegates execution to implementation contract
- Implementation executes the logic
- Result returns to user

## 🆕 Optional: Display Contract Version

Add a version display to show users which contract version is deployed:

### Create Version Hook

`src/hooks/useContractVersion.ts`:

```typescript
import { useState, useEffect } from 'react';
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { libraryPoolAddress, libraryPoolABI } from '../library-pool.abi';

export function useContractVersion() {
  const [version, setVersion] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const publicClient = createPublicClient({
          chain: baseSepolia,
          transport: http(),
        });

        const versionResult = await publicClient.readContract({
          address: libraryPoolAddress,
          abi: libraryPoolABI,
          functionName: 'version',
        });

        setVersion(versionResult as string);
      } catch (error) {
        console.error('Failed to fetch contract version:', error);
        setVersion('Unknown');
      } finally {
        setLoading(false);
      }
    };

    fetchVersion();
  }, []);

  return { version, loading };
}
```

### Use in UI

`src/components/ContractVersion.tsx`:

```typescript
import { useContractVersion } from '../hooks/useContractVersion';

export function ContractVersion() {
  const { version, loading } = useContractVersion();

  if (loading) return <span className="text-xs text-gray-400">Loading...</span>;

  return (
    <div className="text-xs text-gray-400">
      Contract v{version}
    </div>
  );
}
```

### Add to Footer or Settings

```tsx
// In your footer or settings page
import { ContractVersion } from './components/ContractVersion';

<footer className="p-4 text-center">
  <ContractVersion />
  <p className="text-sm">Powered by Libere on Base Sepolia</p>
</footer>
```

## 🔍 Verifying Contract on BaseScan

After deployment, verify contracts so users can see source code:

```bash
npx hardhat verify --network base-sepolia 0xProxyAddress
npx hardhat verify --network base-sepolia 0xImplementationAddress
```

**User Experience**: Users can click "Read Contract" on BaseScan and see functions like:
- `version()` → "1.0.0"
- `balanceOf(address, tokenId)` → NFT balance
- `usableBalanceOf(address, tokenId)` → Borrowed book status

## 📊 Testing Integration

### Test Checklist

After updating to proxy addresses:

- [ ] **Home Screen**: Books load correctly
- [ ] **Book Detail**: Purchase button works
- [ ] **Library Browse**: Available books display
- [ ] **Borrowing**: Can borrow books successfully
- [ ] **Returning**: Can return books successfully
- [ ] **Bookshelf**: Owned + borrowed books show
- [ ] **Reader**: Can read owned/borrowed books
- [ ] **Version Display**: Shows "1.0.0" (if implemented)

### Test Script

Run these transactions on Base Sepolia testnet:

```typescript
// Test 1: Purchase book
await core.purchaseItem(1, 1);

// Test 2: Donate to library
await core.purchaseItemForLibrary(libraryPoolAddress, 1, 1);

// Test 3: Borrow book
await pool.borrowFromPool(1);

// Test 4: Check borrow status
const borrowed = await pool.usableBalanceOf(userAddress, 1);
console.log("Borrowed:", borrowed); // Should be 1

// Test 5: Return book
await pool.returnMyBorrow(1);

// Test 6: Verify version
const version = await pool.version();
console.log("Contract version:", version); // "1.0.0"
```

## 🔄 Handling Contract Upgrades

### Scenario: Contract is Upgraded

When the contract owner upgrades to V2:

**What Changes**:
- Implementation address changes (backend)
- Version number changes (`1.0.0` → `2.0.0`)
- Potentially new functions added

**What Stays the Same**:
- **Proxy address** (your frontend uses this, so **NO CHANGES NEEDED**)
- All existing functions work identically
- NFT balances preserved
- Active borrows preserved

### Upgrade Notification (Optional)

Detect upgrades and notify users:

```typescript
import { useState, useEffect } from 'react';
import { useContractVersion } from '../hooks/useContractVersion';

const KNOWN_VERSION = '1.0.0'; // Update this when you know about new version

export function UpgradeNotification() {
  const { version } = useContractVersion();
  const [showNotification, setShowNotification] = useState(false);

  useEffect(() => {
    if (version && version !== KNOWN_VERSION) {
      setShowNotification(true);
    }
  }, [version]);

  if (!showNotification) return null;

  return (
    <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded">
      <p className="font-bold">Contract Updated!</p>
      <p className="text-sm">
        Contract has been upgraded to version {version}. All your books and borrows are safe!
      </p>
      <button
        onClick={() => setShowNotification(false)}
        className="text-sm underline"
      >
        Dismiss
      </button>
    </div>
  );
}
```

## 🛠️ Development vs Production

### Development (Base Sepolia)

```typescript
// .env.development
VITE_LIBRARY_POOL_ADDRESS=0xYourDevProxyAddress
VITE_CORE_ADDRESS=0xYourDevCoreProxyAddress
```

### Production (Base Mainnet - Future)

```typescript
// .env.production
VITE_LIBRARY_POOL_ADDRESS=0xYourProdProxyAddress
VITE_CORE_ADDRESS=0xYourProdCoreProxyAddress
```

Use environment variables:

```typescript
// config.ts
export default {
  contracts: {
    libraryPool: {
      address: import.meta.env.VITE_LIBRARY_POOL_ADDRESS,
    },
    core: {
      address: import.meta.env.VITE_CORE_ADDRESS,
    },
  },
};
```

## 🔐 Security Considerations

### User Trust

**Communicate to users**:
- ✅ "Contracts are upgradeable for bug fixes and improvements"
- ✅ "Only multisig can upgrade (requires 3/5 signatures)"
- ✅ "Upgrades have 48-hour timelock for transparency"
- ✅ "Your NFTs and borrows are always safe during upgrades"

### Display Ownership (Optional)

Show users who controls the contract:

```typescript
const owner = await pool.owner();

// Display in settings page
<div className="text-xs text-gray-500">
  Contract owner: {owner.slice(0, 6)}...{owner.slice(-4)}
  {owner === MULTISIG_ADDRESS && " (Multisig ✓)"}
</div>
```

## 📱 Mobile/PWA Considerations

**Good News**: UUPS works perfectly with PWA!

- ✅ Cached service workers still work
- ✅ Offline viewing still works (for owned books)
- ✅ Transactions work when online
- ✅ No additional changes needed

## 🧪 Local Development Testing

Test upgrades locally before deploying:

```bash
# 1. Start local Hardhat node
npx hardhat node

# 2. Deploy V1 contracts
npx hardhat run smartcontract/upgradeable/deploy.js --network localhost

# 3. Update frontend with local addresses
# (localhost:8545 proxy addresses)

# 4. Test frontend

# 5. Deploy V2 with new feature
npx hardhat run smartcontract/upgradeable/upgrade.js --network localhost

# 6. Test that new feature works + old features still work
```

## 📚 Example Migration Checklist

Complete migration from non-upgradeable to upgradeable:

### Backend (Smart Contracts)
- [ ] Deploy UUPS contracts to Base Sepolia
- [ ] Verify contracts on BaseScan
- [ ] Set payment token to USDC
- [ ] Transfer ownership to multisig (production only)
- [ ] Save deployment.json with addresses

### Frontend
- [ ] Update `library-pool.abi.ts` with proxy address
- [ ] Update `smart-contract.abi.ts` with proxy address
- [ ] (Optional) Add version display hook
- [ ] (Optional) Add upgrade notification component
- [ ] Test all user flows (purchase, borrow, return, read)
- [ ] Deploy frontend to production

### Documentation
- [ ] Update CLAUDE.md with new addresses
- [ ] Update README with upgrade instructions
- [ ] Announce upgrade to users (if migrating existing deployment)

## ❓ FAQ

### Q: Do I need to migrate user data?

**A**: No! If deploying fresh, there's no data to migrate. If upgrading existing deployment, all data is automatically preserved.

### Q: Will users need to re-approve transactions?

**A**: No. Proxy address is the same, so previous approvals remain valid.

### Q: Can I still use the original contracts?

**A**: Yes! The original contracts in `/smartcontract/` remain for reference. Just don't use them for new deployments.

### Q: What if upgrade adds a new function?

**A**: You'll need to:
1. Regenerate ABI from new contract
2. Update frontend to use new ABI
3. Add UI for new function (if user-facing)

### Q: How do I know when contract is upgraded?

**A**: Poll `version()` function periodically, or listen to ownership transfer events.

## 🎉 Complete Example

Putting it all together - full component with version display:

```tsx
import { useContractVersion } from '../hooks/useContractVersion';
import { libraryPoolAddress } from '../library-pool.abi';

export function LibraryInfo() {
  const { version, loading } = useContractVersion();

  return (
    <div className="bg-gray-100 p-4 rounded">
      <h3 className="font-bold">Library Contract Info</h3>

      <div className="mt-2 space-y-1 text-sm">
        <div>
          <span className="text-gray-600">Address:</span>{' '}
          <a
            href={`https://sepolia.basescan.org/address/${libraryPoolAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 underline"
          >
            {libraryPoolAddress.slice(0, 6)}...{libraryPoolAddress.slice(-4)}
          </a>
        </div>

        <div>
          <span className="text-gray-600">Version:</span>{' '}
          {loading ? 'Loading...' : version}
        </div>

        <div>
          <span className="text-gray-600">Network:</span> Base Sepolia
        </div>

        <div>
          <span className="text-gray-600">Upgradeable:</span> ✅ Yes (UUPS)
        </div>
      </div>
    </div>
  );
}
```

---

**That's it!** Your frontend is now integrated with UUPS upgradeable contracts. 🎉

For questions or issues, refer to [README.md](./README.md) or contact the development team.
