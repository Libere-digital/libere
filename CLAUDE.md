---
noteId: "152b05e047e511f19a3e13a9d5c39135"
tags: []

---

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Libere** is a decentralized digital library platform on Base Sepolia blockchain. Users can publish, purchase, donate, borrow, and read EPUB/PDF books and listen to audiobooks as ERC-1155 NFTs with USDC payments and gasless transactions.

## Key Technologies

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4
- **Auth & Wallet**: Privy (embedded wallets + ERC-4337 smart wallets for gasless txs)
- **Blockchain**: Base Sepolia testnet — viem v2 + ethers v6 + permissionless
- **Payment**: USDC (6 decimals) — `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- **Storage**: Supabase Storage (current) + Pinata/IPFS (legacy) for book files
- **Database**: Supabase (Book + Library tables + bandung_collection)
- **Readers**: react-reader (EPUB), react-pdf (PDF), HTML5 audio (audiobook)
- **PWA**: vite-plugin-pwa with Workbox

## Development Commands

```bash
npm run dev          # Dev server at http://localhost:5173
npm run build        # tsc -b && vite build
npm run lint         # ESLint
npm run preview      # Preview production build

# Utility scripts (run with tsx)
npm run migrate:epubs    # Migrate EPUB files from IPFS to Supabase Storage
npm run migrate:simple   # Simple migration utility
npm run test:supabase    # Test Supabase connection
npm run sync:libraries   # Sync library NFTs data

# Additional scripts (not in package.json)
npx tsx scripts/debug-library-access.ts
npx tsx scripts/list-books.ts
```

## Smart Contracts

### Main Marketplace — `0xC12F333f41D7cedB209F24b303287531Bb05Bc67`
- `createItem()` — Publish new book NFT (currently `onlyOwner` restricted)
- `purchaseItem()` — Buy book with USDC (2-step: approve then purchase)
- `purchaseItemForLibrary()` — Donate book to library pool
- ABI: [src/smart-contract.abi.ts](src/smart-contract.abi.ts)

### Library Pools (one per library, same ABI)
- The Room 19: `0xA31D6d3f2a6C5fBA99E451CCAAaAdf0bca12cbF0`
- Bandung City: `0xa1371f33A4C90a397862c9c05919Aa6B4A3761cD`
- Block71: `0x72A421C93dA185adF33F8fC6bF90FEA850E1AC0b`
- `borrowFromPool(tokenId)` — Borrow book (returns recordId)
- `returnMyBorrow(tokenId)` — Return borrowed book
- `getActiveBorrows(address)` — Returns `BorrowView[] { recordId, tokenId, expiry }`
- `usableBalanceOf(address, tokenId)` — Check if user has active borrow
- ABI: [src/library-pool.abi.ts](src/library-pool.abi.ts)

## Architecture

### Application Entry Point

```
src/main.tsx → Providers (Privy) → CurrencyProvider → BrowserRouter → SubdomainRouter → Routes
```

`App.tsx` in root is an unused Vite template leftover. Actual entry is `src/main.tsx`.

`main.tsx` suppresses browser extension iframe errors from the EPUB reader iframe — these are harmless.

### Route Structure

**Public:**
- `/` → redirect to `/books`
- `/auth` → AuthScreen
- `/books` → HomeScreen
- `/books/:id` → BookDetailScreen
- `/libraries/:id` → LibraryDetailScreen

**Protected** (Privy auth required):
- `/libraries` → LibraryListScreen
- `/bookselfs` → BookselfScreen
- `/read-book/:id` → DocumentReaderScreen (unified EPUB/PDF reader)
- `/read-book/bc-:id` → DocumentReaderScreen in bandung_collection mode (no auth/blockchain check)
- `/read-pdf/:id` → redirects to `/read-book/:id` (backward compat)
- `/listen-audiobook/:id` → AudiobookPlayerScreen
- `/publish` → CreateBookV2Screen (disabled — `onlyOwner` restriction)

**Legacy/unused pages** (not in routes): `LibraryScreen.tsx`, `PdfReaderScreen.tsx`, `TestSmartWalletScreen.tsx`

### Subdomain Routing ([src/routes/SubdomainRouter.tsx](src/routes/SubdomainRouter.tsx))

Library subdomains auto-redirect to their library page:
- `theroom19.libere.digital` → `/libraries/theroom19`
- `bandung.libere.digital` → `/libraries/bandung`
- `block71.libere.digital` → `/libraries/block71`
- Allowed paths on subdomains: `/libraries/:slug`, `/read-book/:id`, `/listen-audiobook/:id`
- All other subdomain paths redirect to the library's detail page

Subdomain detection logic lives in [src/utils/subdomain.ts](src/utils/subdomain.ts).

### Two Book Systems

There are two separate book systems that coexist in `LibraryDetailScreen`:

1. **NFT Books** (`Book` table) — on-chain ERC-1155 tokens. Availability fetched from blockchain via Blockscout API + smart contract reads. Borrow/return via `borrowFromPool`/`returnMyBorrow`.

2. **Bandung Collection** (`bandung_collection` table) — library-uploaded PDFs, no NFT, no blockchain. Only exists for the Bandung library (`/libraries/bandung`). Direct access, no borrow flow needed.

In `LibraryDetailScreen`, both are merged into one `displayBooks: Book[]` array. `bandung_collection` items are converted to `Book` shape with **negative IDs** (e.g., `id: -(item.id)`) to distinguish them from NFT books. `directAccessIds: Set<number>` contains these negative IDs. In `CivilibBookCard`, `isCollection = book.id < 0` is the guard that skips all blockchain calls.

Reader routing: NFT books → `/read-book/{id}`, Bandung collection → `/read-book/bc-{collectionId}`. In `DocumentReaderScreen`, `rawId.startsWith("bc-")` triggers the collection path which skips auth/blockchain verification entirely and loads from `bandung_collection` directly.

### Document Reader Flow ([src/pages/DocumentReaderScreen.tsx](src/pages/DocumentReaderScreen.tsx))

**NFT/borrow path** (`/read-book/{numeric-id}`):
1. Verify NFT ownership (`balanceOf`) OR active borrow across all 3 library pools
2. Check `library_books.is_direct_access` as third access grant
3. Fetch book from `Book` table, download via signed URL

**Bandung collection path** (`/read-book/bc-{id}`):
1. No auth or blockchain check — open access
2. Fetch from `bandung_collection` table (or use router state if passed)
3. Download via signed URL from Supabase Storage

Auto-detect file type via [src/utils/documentType.ts](src/utils/documentType.ts). Routes to `EpubReaderScreen` (react-reader) or `PdfRenderer` (react-pdf).

### Transaction Pattern

All writes use Privy smart wallet (`useSmartWallets`) for gasless execution:
```typescript
const { client } = useSmartWallets();
await client.sendTransaction({ chain: baseSepolia, to, data, value: BigInt(0) });
```

All reads use `readContract` from viem with a `createPublicClient`.

USDC purchases are 2 steps: `approve(contractAddress, price)` on USDC token, then `purchaseItem()`.

Access checks use the **smart wallet address** (ERC-4337), not the EOA. Fall back to `user.wallet.address` if no smart wallet is linked.

### Signed URL Refresh ([src/utils/supabaseStorage.ts](src/utils/supabaseStorage.ts))

Supabase signed URLs expire in 5 minutes. Readers auto-refresh every 4 minutes via `setInterval`. When adding new reader components, follow this pattern to prevent mid-session expiry. Always call the returned cleanup function on component unmount.

Key exports: `getSignedEpubUrl()`, `getSignedPdfUrl()`, `downloadDocumentBlob()`, `setupSignedUrlAutoRefresh()`, `isSupabaseStorageUrl()`, `isIpfsUrl()`.

### CurrencyContext ([src/contexts/CurrencyContext.tsx](src/contexts/CurrencyContext.tsx))

Auto-detects user locale via `ipapi.co`, fetches live exchange rates from `exchangerate-api.com`, and persists the selected currency in `localStorage`. Use `useCurrency()` to format USDC prices in the user's local currency. Currencies with no decimal display (IDR, VND, KRW, JPY) are handled automatically.

### Privy Setup Quirk

`PrivyProvider` is cast as `any` in [src/providers/PrivyProvider.tsx](src/providers/PrivyProvider.tsx) to work around a React 19 type incompatibility. `window.Buffer` is polyfilled in `main.tsx` for the EPUB reader iframe.

### Supabase Query Helpers ([src/libs/supabase-helpers.ts](src/libs/supabase-helpers.ts))

Reusable query functions — prefer these over inline Supabase queries:

- **Bandung collection**: `getBandungCollection()` → `BandungCollectionItem[]`
- **Direct access lookup**: `getDirectAccessBookIds(libraryId)` → `Set<number>`
- **Library book operations**: `getLibraryVisibleBooks()`, `getAllLibraryBooks()`, `addBookToLibrary()`, `upsertLibraryBooks()`, `toggleBookVisibility()`, `removeBookFromLibrary()`
- **Library queries**: `getAllLibraries()`, `getLibraryById()`, `getLibraryByAddress()`
- **Stats**: `getLibraryStats()` → `{ totalBooks, visibleBooks, hiddenBooks }`

Note: `getLibraryVisibleBooks()` uses two separate queries (no FK join) because `library_books` has no FK constraint to `Book`.

## Key Data Notes

- **`Book.priceEth`** — misleadingly named; stores USDC units (6 decimals), not ETH wei. `"1000000"` = 1.00 USDC.
- **`Book.epub`** — misleadingly named; stores document URL (EPUB or PDF).
- **`Book.fileType`** — optional `'epub' | 'pdf'`, defaults to `'epub'` if absent.
- **`Book.audiobook`** — optional MP3 URL for audiobook companion.
- **`Book.donated_by`** / **`Book.donated_at`** — set when a book was donated to a library pool.
- **Royalties** — stored as basis points (500 = 5%).
- **Negative book IDs** — `bandung_collection` items are converted to `Book` shape with `id = -(item.id)` in `LibraryDetailScreen` to avoid collision with NFT token IDs. Never persist or send these to the blockchain.

## Supabase Schema

- `Book` table — NFT book metadata. Fields map to `Book` interface in [src/core/interfaces/book.interface.ts](src/core/interfaces/book.interface.ts)
- `library_books` junction table — links `Book` rows to libraries (`library_id`, `book_id`, `is_visible`, `is_direct_access`). No FK constraint to `Book`.
- `bandung_collection` table — Bandung library's own PDF collection, separate from NFT system. Fields: `id, title, author, description, cover_url, file_url, category, created_at`. RLS enabled, anon read allowed.
- Storage bucket: `libere-books` — EPUB, PDF, MP3, and image files (private, requires signed URLs)

## PWA Caching Strategy ([vite.config.ts](vite.config.ts))

- EPUB files: **NetworkOnly** (security — never cache)
- Supabase signed URLs: **NetworkOnly** (expire quickly)
- Supabase API: **NetworkFirst** (5 min cache)
- MP3 audiobooks: **CacheFirst** (7 day cache, 10MB/file limit — offline playback)
- Pinata/IPFS images: **CacheFirst** (24 hour cache)

## WatermarkOverlay ([src/components/reader/WatermarkOverlay.tsx](src/components/reader/WatermarkOverlay.tsx))

All readers display the user's wallet address as a diagonal repeating watermark + borrow expiry countdown for borrowed books.

## Category System ([src/utils/categoryColors.ts](src/utils/categoryColors.ts))

Categories: `'Fiksi'`, `'Non-Fiksi'`, `'Sejarah'`, `'Teknologi'`, `'Seni'`, `'All'`

Monochrome grayscale color scheme. Use `getCategoryColors(cat)` or `getCategoryBadgeColors(cat)`.

## StandaloneLayout ([src/components/layouts/StandaloneLayout.tsx](src/components/layouts/StandaloneLayout.tsx))

Minimal layout for library-branded subdomain pages. Props: `libraryLogo`, `libraryName`, `libraryTagline`, `showScrollNav`. Includes sticky header with "Masuk" login button, user dropdown (nama, alamat akun, logout), smooth scroll navigation. All UI text is in Bahasa Indonesia.

## Civilib Components ([src/components/civilib/](src/components/civilib/))

Used in `LibraryDetailScreen` to render the unified book grid (NFT + Bandung collection together).

- `CivilibBookList` — renders `Book[]`, accepts `directAccessIds: Set<number>` and passes `isDirectAccess` per card. Category filter tabs styled per library theme (default zinc/hitam, monochrome for theroom19, teal for block71).
- `CivilibBookCard` — single card. `isCollection = book.id < 0` skips all blockchain calls. `isDirectAccess || isCollection` controls badge ("Tersedia" hijau), label ("Baca langsung · gratis"), and button passed to `CivilibAccessButton`.
- `CivilibAccessButton` — handles borrow/return for NFT books. For direct/collection: navigates to `/read-book/bc-{abs(id)}` (collection) or `/read-book/{id}` (NFT). All text in Bahasa Indonesia.

## Smart Contract Development (Foundry)

```bash
forge build
forge test
forge test --gas-report
forge script smartcontract/upgradeable/Deploy.s.sol --rpc-url base-sepolia --broadcast
```

Contract source in `smartcontract/upgradeable/`:
- `Libere1155CoreUpgradeable.sol` — main marketplace (UUPS)
- `LibraryPoolUpgradeable.sol` — borrowing pool (UUPS)

Solidity 0.8.20, Shanghai EVM target. Tests in `smartcontract/test/unit/`; mocks in `smartcontract/test/mocks/`.

## Known Issues

1. **`createItem()` is `onlyOwner`** — publishing disabled for regular users. See [SOLUTION_ONLYOWNER_ISSUE.md](SOLUTION_ONLYOWNER_ISSUE.md).
2. **`setPaymentToken()`** must be called on the marketplace contract with the USDC address before purchases work.
3. Users need Base Sepolia testnet USDC to make purchases.

## Environment Variables

```env
VITE_PRIVY_APP_ID=
VITE_PRIVY_CLIENT_ID=
VITE_PINATA_API_KEY=
VITE_PINATA_SECRET_API_KEY=
VITE_SUPABASE_URL=
VITE_SUPABASE_API_KEY=
VITE_BASE_SEPOLIA_LIBRARY_URL=
VITE_BASE_SEPOLIA_LIBRARY_BASE_URL=

# For Foundry scripts only:
BASE_SEPOLIA_RPC_URL=
BASESCAN_API_KEY=
PRIVATE_KEY=
```
