---
noteId: "408bb320d8db11f0bac7ebddf7dc79d0"
tags: []

---

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Libere** is a decentralized digital library platform built on Base Sepolia blockchain. It enables users to publish, purchase, donate, borrow, and read digital books (EPUB/PDF) and listen to audiobooks as ERC-1155 NFTs with USDC payments and gasless transactions.

## Key Technologies

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS v4
- **Auth & Wallet**: Privy (embedded wallets with smart wallet support)
- **Blockchain**: Base Sepolia testnet
- **Smart Contracts**: ERC-1155 NFT marketplace + Library Pool (ERC-4337)
- **Payment**: USDC (6 decimals) - address: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- **Storage**: Pinata (IPFS) for book files, Supabase for metadata & EPUB storage
- **Ethereum Libraries**: viem v2 + ethers v6 + permissionless
- **PWA**: Progressive Web App with offline support via Vite PWA plugin
- **Document Readers**: react-reader for EPUB books, react-pdf for PDF documents, HTML5 audio for audiobooks, all with custom watermark overlay

## Smart Contracts

### Main Marketplace Contract
- **Address**: `0xC12F333f41D7cedB209F24b303287531Bb05Bc67`
- **Functions**:
  - `createItem()` - Publish new book NFT
  - `purchaseItem()` - Buy book with USDC
  - `purchaseItemForLibrary()` - Donate book to library pool
- **ABI**: [src/smart-contract.abi.ts](src/smart-contract.abi.ts)

### Library Pool Contract
- **Address**: `0xA31D6d3f2a6C5fBA99E451CCAAaAdf0bca12cbF0`
- **Functions**:
  - `borrowFromPool(tokenId)` - Borrow book (returns recordId)
  - `returnMyBorrow(tokenId)` - Return borrowed book
  - `getActiveBorrows(address)` - Get user's active borrows with expiry
  - `previewAvailability(tokenId)` - Check available copies
- **ABI**: [src/library-pool.abi.ts](src/library-pool.abi.ts)

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm preview

# Lint code
npm run lint

# Utility scripts
npm run migrate:epubs      # Migrate EPUB files from IPFS to Supabase Storage
npm run migrate:simple     # Simple migration utility
npm run test:supabase      # Test Supabase connection
npm run sync:libraries     # Sync library NFTs data
```

## Environment Setup

Create a `.env` file in the root directory with the following variables:

```env
# Privy Authentication
VITE_PRIVY_APP_ID=your_privy_app_id
VITE_PRIVY_CLIENT_ID=your_privy_client_id

# Pinata IPFS Storage
VITE_PINATA_API_KEY=your_pinata_api_key
VITE_PINATA_SECRET_API_KEY=your_pinata_secret_api_key

# Supabase Database
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_API_KEY=your_supabase_anon_public_key

# Base Sepolia Blockchain API
VITE_BASE_SEPOLIA_LIBRARY_URL=https://base-sepolia.blockscout.com/api/v2/addresses/...
VITE_BASE_SEPOLIA_LIBRARY_BASE_URL=https://base-sepolia.blockscout.com/api/v2/addresses/
```

## Architecture

### Application Flow

```
main.tsx (entry point) → PrivyProvider (auth) → CurrencyProvider → BrowserRouter → Routes
```

**Notes**:
- The root-level `App.tsx` is a leftover from the Vite template and is not used. The actual entry point is [src/main.tsx](src/main.tsx) which renders routes directly.
- [main.tsx](src/main.tsx:18-34) includes error suppression for browser extension iframe errors that occur when extensions try to access the EPUB reader iframe - these errors are harmless and can be ignored.

### Route Structure

**Public Routes:**
- `/` → Redirect to `/books`
- `/auth` → AuthScreen (Privy login)
- `/books` → HomeScreen (browse all books)
- `/books/:id` → BookDetailScreen (view book details + purchase/donate)

**Protected Routes** (requires Privy authentication):
- `/libraries` → LibraryListScreen (browse all libraries)
- `/libraries/:id` → LibraryDetailScreen (view library details + browse/borrow books)
- `/bookselfs` → BookselfScreen (user's owned + borrowed books)
- `/read-book/:id` → DocumentReaderScreen (unified reader for EPUB/PDF with watermark and NFT verification)
- `/listen-audiobook/:id` → AudiobookPlayerScreen (audiobook player with NFT verification)

**Temporarily Hidden:**
- `/publish` → CreateBookV2Screen (publish new books - currently disabled due to onlyOwner contract restriction)

### Core Directories

```
src/
├── pages/              # Route screens
├── components/         # Reusable UI components
│   ├── civilib/       # Library-specific components
│   ├── bookself/      # Bookshelf-specific components
│   ├── layouts/       # Layout wrappers (AuthLayout, HomeLayout, StandaloneLayout)
│   ├── reader/        # EPUB reader components (WatermarkOverlay)
│   └── buttons/       # Button components (GoogleAuthButton)
├── providers/          # Context providers (PrivyProvider)
├── contexts/          # React contexts (CurrencyContext)
├── routes/            # Route guards (ProtectedRoute)
├── core/
│   ├── interfaces/    # TypeScript interfaces (Book, Library)
│   └── constants/     # Constants (ETH_PRICE)
├── libs/              # External service configs (supabase, config)
├── utils/             # Utility functions (categoryColors, documentType)
├── smart-contract.abi.ts  # Main contract ABI + address
├── library-pool.abi.ts    # Library pool contract ABI + address
└── usdc-token.ts          # USDC token address + decimals

smartcontract/          # Smart contract source code (Solidity)
├── upgradeable/       # UUPS upgradeable contract implementations
└── test/              # Foundry test suite
```

### Key Interfaces

**Book Interface** ([src/core/interfaces/book.interface.ts](src/core/interfaces/book.interface.ts)):
```typescript
interface Book {
  id: number;                    // NFT token ID
  title: string;
  author: string;
  publisher: string;
  description: string;
  metadataUri: string;           // IPFS cover image URL
  epub: string;                  // Document file URL (EPUB or PDF) - misleading name!
  priceEth: string;              // USDC price (6 decimals) - misleading name!
  royalty: number;               // Basis points (500 = 5%)
  addressReciepent: string;      // Payment recipient
  addressRoyaltyRecipient: string;
  quantity?: number;             // NFT balance (for bookshelf)
  fileType?: 'epub' | 'pdf';     // Document type (optional, defaults to 'epub')
  audiobook?: string;            // URL to audiobook file (MP3) - optional
}
```

**Library Interface** ([src/core/interfaces/library.interface.ts](src/core/interfaces/library.interface.ts)):
```typescript
interface Library {
  id: number;
  name: string;
  address: string;               // Ethereum address (pool contract)
  description?: string;
  created_at?: string;
}
```

## Transaction Patterns

### Gasless Transactions (Sponsored by Privy)

All blockchain transactions use Privy Smart Wallets (ERC-4337) for gasless execution:

```typescript
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { encodeFunctionData } from "viem";
import { baseSepolia } from "viem/chains";

const { client } = useSmartWallets();

// Encode function call
const data = encodeFunctionData({
  abi: contractABI,
  functionName: "functionName",
  args: [arg1, arg2],
});

// Send gasless transaction
const txHash = await client.sendTransaction({
  chain: baseSepolia,
  to: contractAddress,
  data: data,
  value: BigInt(0), // No ETH needed
});
```

### USDC Purchase Flow (2 Steps)

**Step 1: Approve USDC spending**
```typescript
// User must first approve marketplace to spend USDC
const approveData = encodeFunctionData({
  abi: erc20Abi,
  functionName: "approve",
  args: [contractAddress, priceInUSDC],
});

await client.sendTransaction({
  chain: baseSepolia,
  to: usdcTokenAddress,
  data: approveData,
});
```

**Step 2: Purchase book**
```typescript
const purchaseData = encodeFunctionData({
  abi: contractABI,
  functionName: "purchaseItem",
  args: [BigInt(bookId), BigInt(1)], // amount is always 1
});

await client.sendTransaction({
  chain: baseSepolia,
  to: contractAddress,
  data: purchaseData,
  value: BigInt(0), // Using USDC, not ETH
});
```

### Library Borrowing Flow

**Borrow a book:**
```typescript
const borrowData = encodeFunctionData({
  abi: libraryPoolABI,
  functionName: "borrowFromPool",
  args: [BigInt(bookId)],
});

const txHash = await client.sendTransaction({
  chain: baseSepolia,
  to: libraryPoolAddress,
  data: borrowData,
});
```

**Return a book:**
```typescript
const returnData = encodeFunctionData({
  abi: libraryPoolABI,
  functionName: "returnMyBorrow",
  args: [BigInt(bookId)],
});

await client.sendTransaction({
  chain: baseSepolia,
  to: libraryPoolAddress,
  data: returnData,
});
```

**Check active borrows:**
```typescript
import { readContract } from "viem/actions";
import { createPublicClient, http } from "viem";

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

const activeBorrows = await readContract(publicClient, {
  address: libraryPoolAddress,
  abi: libraryPoolABI,
  functionName: "getActiveBorrows",
  args: [userAddress],
});
// Returns: BorrowView[] { recordId, tokenId, expiry }
```

## Important Implementation Notes

### Price Storage
The database field `priceEth` is **misleadingly named** - it actually stores USDC units (6 decimals), not ETH wei (18 decimals).

```typescript
// Convert USDC units to readable format
const usdcUnitsToReadable = (units: string | number | bigint) => {
  return Number(units) / Math.pow(10, 6); // USDC has 6 decimals
};

// Example: "1000000" stored → displays as "1.00 USDC"
```

### Royalty Conversion
Royalties are stored as basis points (1% = 100 bps):

```typescript
// Convert percentage to basis points
const royaltyPercentage = 5.0; // 5%
const royaltyBps = royaltyPercentage * 100; // 500 bps
```

### Authentication Pattern

```typescript
import { usePrivy } from "@privy-io/react-auth";

const { authenticated, user, login, logout } = usePrivy();

if (!authenticated) {
  // Redirect to /auth or show login button
  login();
}

// Access user data
console.log(user?.wallet?.address); // Smart wallet address
```

### Reading Contract Data

Use `readContract` from viem for read-only operations (no gas needed):

```typescript
import { readContract } from "viem/actions";

const balance = await readContract(publicClient, {
  address: contractAddress,
  abi: contractABI,
  functionName: "balanceOf",
  args: [userAddress, BigInt(bookId)],
});
```

### IPFS Integration

Books and audiobooks are stored on IPFS via Pinata (legacy) or Supabase Storage (current):
- **Cover images**: Uploaded as PNG/JPG
- **Document files**: EPUB or PDF format
- **Audiobook files**: MP3 format (stored in `audiobook` field)
- **IPFS URLs**: `https://gateway.pinata.cloud/ipfs/{hash}` (legacy)
- **Supabase URLs**: `https://{project}.supabase.co/storage/v1/object/public/libere-books/{filename}`

Access Pinata credentials from `config.env.pinata` ([src/libs/config.ts](src/libs/config.ts)).

**Document Type Detection**: The system auto-detects file types (EPUB vs PDF) from URLs using [src/utils/documentType.ts](src/utils/documentType.ts).

### Supabase Integration

Database schema includes:
- `Book` table: Stores book metadata
- `Library` table: Stores library pool information

Access via initialized client:
```typescript
import { supabase } from './libs/supabase';

const { data, error } = await supabase
  .from('Book')
  .select('*')
  .eq('id', bookId)
  .single();
```

## Document & Audiobook Reader Implementation

### Unified Document Reader
The app uses [DocumentReaderScreen](src/pages/DocumentReaderScreen.tsx) as a unified entry point for reading both EPUB and PDF files:

**How it works:**
1. Verifies NFT ownership OR library borrowing access via smart contract
2. Fetches book metadata from Supabase
3. Auto-detects file type (EPUB or PDF) from URL
4. Downloads document from Supabase Storage with authentication
5. Routes to appropriate renderer:
   - EPUB → [EpubReaderScreen](src/pages/EpubReaderScreen.tsx) (uses react-reader)
   - PDF → [PdfRenderer](src/pages/PdfRenderer.tsx) (uses react-pdf)

### Audiobook Player
The app uses [AudiobookPlayerScreen](src/pages/AudiobookPlayerScreen.tsx) for playing MP3 audiobooks:

**How it works:**
1. Verifies NFT ownership OR library borrowing access via smart contract
2. Fetches book metadata from Supabase
3. Loads MP3 file from `audiobook` field
4. Plays audio using HTML5 audio element with custom controls
5. Displays watermark overlay with user's wallet address

**Access Verification:**
```typescript
// Checks both NFT ownership AND library borrowing
const balance = await publicClient.readContract({
  address: contractAddress,
  abi: contractABI,
  functionName: 'balanceOf',
  args: [userAddress, tokenId],
});

const usableBalance = await publicClient.readContract({
  address: libraryPoolAddress,
  abi: libraryPoolABI,
  functionName: 'usableBalanceOf',
  args: [userAddress, tokenId],
});

// User has access if EITHER balance > 0 OR usableBalance > 0
```

### Watermark Overlay
All readers (EPUB, PDF, audiobook) include [WatermarkOverlay](src/components/reader/WatermarkOverlay.tsx) that displays:
- User's wallet address (prevents screenshot sharing)
- Borrow expiry countdown (for borrowed books)
- Diagonal repeating pattern for security

## Category System

The app uses a monochrome grayscale category color scheme (The Room 19 aesthetic):

**Categories**: 'Fiksi', 'Non-Fiksi', 'Sejarah', 'Teknologi', 'Seni', 'All'

**Usage**:
```typescript
import { getCategoryColors, getCategoryBadgeColors } from '@/utils/categoryColors';

// Get full color scheme for a category
const colors = getCategoryColors('Fiksi');
// Returns: { bg, bgHover, bgActive, text, textActive, border }

// Get badge-specific colors
const badgeColors = getCategoryBadgeColors('Teknologi');
// Returns: { bg, text, border }
```

Located in [src/utils/categoryColors.ts](src/utils/categoryColors.ts).

## Layout Components

### StandaloneLayout
A minimal layout for library-specific standalone pages (e.g., The Room 19):

**Props**:
- `librarySlug?: string` - Library identifier (e.g., 'theroom19')
- `libraryLogo?: string` - Path to library logo image
- `showScrollNav?: boolean` - Enable scroll-to-section navigation (Home, Reservation, Maps)

**Features**:
- Sticky header with library branding
- Wallet connection dropdown (username, address, copy, logout)
- Smooth scroll navigation for single-page library sites
- Minimal monochrome design

Located in [src/components/layouts/StandaloneLayout.tsx](src/components/layouts/StandaloneLayout.tsx).

## Smart Contract Development

The repository includes smart contract source code and development tooling:

### Foundry Setup
```bash
# Install Foundry (if not already installed)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Compile contracts
forge build

# Run tests
forge test

# Run tests with gas reporting
forge test --gas-report

# Deploy/upgrade scripts (requires env vars)
forge script smartcontract/upgradeable/Deploy.s.sol --rpc-url base-sepolia --broadcast
```

### Environment Variables for Contract Development
Add to `.env` for Foundry scripts:
```env
# RPC Endpoints
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASE_MAINNET_RPC_URL=https://mainnet.base.org

# Basescan API Key (for verification)
BASESCAN_API_KEY=your_basescan_api_key

# Private key for deployment (DO NOT COMMIT)
PRIVATE_KEY=your_private_key_here
```

### Contract Structure
- **upgradeable/** - UUPS upgradeable implementations (current production)
  - `Libere1155CoreUpgradeable.sol` - Main marketplace contract
  - `LibraryPoolUpgradeable.sol` - Library borrowing pool
  - `Deploy.s.sol` - Deployment script
  - `Upgrade.s.sol` - Upgrade script
- **test/** - Foundry test suite with helpers and mocks
- **core_1155.sol** - Legacy non-upgradeable version
- **library-libere.sol** - Legacy library contract

**Solidity Version**: 0.8.20 with Shanghai EVM target

## Admin Publishing Tool

**Note**: The admin-publish directory does not exist in the current codebase. Publishing is currently disabled due to the `onlyOwner` contract restriction. See [SOLUTION_ONLYOWNER_ISSUE.md](SOLUTION_ONLYOWNER_ISSUE.md) for workarounds.

## Progressive Web App (PWA)

The app is configured as a PWA with offline support and can be installed on devices:

### Features
- **Service Worker**: Auto-updates on new content
- **Offline Caching**: Images and API responses cached for offline access
- **Installable**: Can be installed as standalone app on desktop/mobile
- **Workbox Caching Strategies**:
  - EPUB files: NetworkOnly (NEVER cached - prevents unauthorized offline access via regex pattern)
  - PDF files: NetworkOnly (NOT explicitly blocked by regex, but not cached via globPatterns)
  - Audiobook files (MP3): CacheFirst (7 day cache, 10MB limit) - allows offline listening
  - Supabase signed URLs: NetworkOnly (expire quickly, should not be cached)
  - Supabase API: NetworkFirst (5 min cache)
  - IPFS/Pinata images: CacheFirst (24 hour cache)

### PWA Configuration
Located in [vite.config.ts](vite.config.ts) using `vite-plugin-pwa`. Service worker registers automatically in [main.tsx](src/main.tsx:17-47).

**Security Note**:
- EPUB files are explicitly blocked from caching via regex pattern matching `.epub` URLs
- PDF files are not cached (not included in globPatterns, no explicit regex block)
- Users can only read books while authenticated and with valid access rights
- Audiobooks are cached for offline listening convenience, with a 10MB file size limit per file

## Utility Scripts

### EPUB Migration Script
Migrates EPUB files from IPFS to Supabase Storage bucket:

```bash
npm run migrate:epubs
```

**What it does:**
- Fetches all books from database
- Downloads EPUBs from IPFS/Pinata
- Uploads to Supabase Storage bucket `libere-books`
- Updates database with new Supabase URLs
- Generates migration report JSON

**Features:**
- Batch processing (5 books at a time)
- Retry logic (3 attempts)
- Skip already migrated books
- Detailed console output and JSON report

Located in [scripts/migrate-epubs-to-supabase.ts](scripts/migrate-epubs-to-supabase.ts).

### Other Utility Scripts
```bash
# Test Supabase connection
npm run test:supabase

# Simple migration utility
npm run migrate:simple

# Additional scripts (not in package.json, run with tsx):
npx tsx scripts/debug-library-access.ts        # Debug library borrowing access
npx tsx scripts/update-metamorfosa-audiobook.ts # Update specific book's audiobook
npx tsx scripts/list-books.ts                   # List all books from database
```

All utility scripts are located in the `scripts/` directory and can be run with `tsx` or via npm scripts.

## Known Issues & Workarounds

### 1. onlyOwner Restriction on createItem()
The marketplace contract's `createItem()` function has an `onlyOwner` modifier, preventing regular users from publishing books directly.

**Workaround**: Use the admin-publish tool with owner private key.

**Future Fix**: Deploy new contract without onlyOwner modifier for public publishing.

### 2. Payment Token Configuration
The marketplace contract must have `setPaymentToken()` called with USDC address before purchases work.

**Verify with**:
```typescript
const paymentToken = await readContract(publicClient, {
  address: contractAddress,
  abi: contractABI,
  functionName: "paymentToken",
});
// Should return: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

### 3. Testnet Tokens Required
Users need Base Sepolia testnet USDC for purchases. Get from faucets:
- Base Sepolia ETH: https://docs.base.org/tools/network-faucets
- USDC: Use bridge or request from team

## Documentation Files

Additional implementation guides:
- [USDC_PURCHASE_FLOW_COMPLETE.md](USDC_PURCHASE_FLOW_COMPLETE.md) - Complete USDC purchase implementation
- [LIBRARY_BORROWING_IMPLEMENTATION.md](LIBRARY_BORROWING_IMPLEMENTATION.md) - Borrowing system details
- [SUPABASE_MIGRATION_GUIDE.md](SUPABASE_MIGRATION_GUIDE.md) - Database setup
- [PUBLISH_BOOK_USDC_GUIDE.md](PUBLISH_BOOK_USDC_GUIDE.md) - Publishing books guide
- [SOLUTION_ONLYOWNER_ISSUE.md](SOLUTION_ONLYOWNER_ISSUE.md) - onlyOwner workaround details

## Testing & Debugging

### Test with Dummy Book
HomeScreen includes a dummy book (ID 1, price: 1 USDC) for testing purchase flow.

### Console Logging
The app uses console.log extensively. Check browser console for:
- Transaction hashes
- Contract call results
- Error details
- User authentication state

### Blockchain Explorer
Verify transactions on Base Sepolia:
- https://sepolia.basescan.org
- https://base-sepolia.blockscout.com

## Common Patterns

### Loading States
```typescript
const [loading, setLoading] = useState(false);
const [status, setStatus] = useState("");

try {
  setLoading(true);
  setStatus("Processing...");
  // ... perform operation
  setStatus("Success!");
} catch (error) {
  setStatus(`Error: ${error.message}`);
} finally {
  setLoading(false);
}
```

### Currency Conversion
```typescript
import { ETH_PRICE } from './core/constants';

// USDC to USD (1:1 stablecoin)
const usdValue = usdcUnitsToReadable(priceEth);

// ETH to USD (if needed for display)
const ethToUSD = ethAmount * ETH_PRICE;
```

### Expiry Time Display
Library borrows show countdown timers:
```typescript
// Calculate time remaining
const now = Math.floor(Date.now() / 1000);
const timeLeft = expiryTimestamp - now;

// Format as "2d 5h left" or "3h 45m left"
if (timeLeft > 86400) {
  return `${Math.floor(timeLeft / 86400)}d ${Math.floor((timeLeft % 86400) / 3600)}h left`;
} else if (timeLeft > 3600) {
  return `${Math.floor(timeLeft / 3600)}h ${Math.floor((timeLeft % 3600) / 60)}m left`;
} else {
  return `${Math.floor(timeLeft / 60)}m left`;
}
```

## Code Style

- TypeScript strict mode enabled
- React 19 with functional components only
- Tailwind CSS for all styling (v4 syntax)
- Arrow functions preferred
- ESLint configured (run with `npm run lint`)
