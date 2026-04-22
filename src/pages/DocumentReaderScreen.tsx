import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "../libs/supabase";
import { isSupabaseStorageUrl, downloadDocumentBlob } from "../utils/supabaseStorage";
import { detectDocumentType } from "../utils/documentType";
import { usePrivy } from "@privy-io/react-auth";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { contractABI, contractAddress } from "../smart-contract.abi";
import { libraryPoolABI } from "../library-pool.abi";
import EpubReaderScreen from "./EpubReaderScreen";
import PdfRenderer from "./PdfRenderer";
import DonationSplashScreen from "../components/reader/DonationSplashScreen";

console.log('📱 [DocumentReaderScreen] Unified reader for EPUB and PDF with NFT + Library verification');

const DocumentReaderScreen = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const bookId = id || "unknown";
  const { user, authenticated } = usePrivy();

  // Check if user came from library page (via route state)
  // Explicitly check if state exists and fromLibrary is true
  // Default to false if undefined or any other falsy value
  const fromLibrary = location.state?.fromLibrary === true;

  console.log('🔍 [DocReader] Navigation source check:', {
    'location.state': location.state,
    'fromLibrary': fromLibrary,
    'state exists': !!location.state,
    'explicit true check': location.state?.fromLibrary === true
  });

  console.log("📖 [DocReader] Book ID from params:", bookId, "Type:", typeof bookId);

  const [ownsNFT, setOwnsNFT] = useState<boolean | null>(null); // null = checking
  const [hasBorrowed, setHasBorrowed] = useState<boolean | null>(null); // null = checking
  const [borrowExpiry, setBorrowExpiry] = useState<number | null>(null); // Unix timestamp
  const [bookTitle, setBookTitle] = useState<string>("Loading...");
  const [bookCover, setBookCover] = useState<string>("");
  const [donatedBy, setDonatedBy] = useState<string | undefined>(undefined);
  const [donatedAt, setDonatedAt] = useState<string | undefined>(undefined);
  const [borrowedFromLibrary, setBorrowedFromLibrary] = useState<string | null>(null); // Library name user borrowed from
  const [documentData, setDocumentData] = useState<ArrayBuffer | null>(null);
  const [documentType, setDocumentType] = useState<'epub' | 'pdf' | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showSplash, setShowSplash] = useState<boolean>(false);

  // =============================================================
  // 🔐 ACCESS VERIFICATION (NFT Ownership OR Library Borrowing)
  // =============================================================
  useEffect(() => {
    const verifyAccess = async () => {
      if (!authenticated || !user?.wallet?.address) {
        console.log('⚠️ [Access Check] User not authenticated or no wallet');
        setOwnsNFT(false);
        setHasBorrowed(false);
        return;
      }

      try {
        console.log('🔐 [Access Check] Verifying access for book #' + bookId);
        console.log('   User wallet:', user.wallet.address);

        // IMPORTANT: Use smart wallet address for library borrow checks
        const addressToCheck = user.smartWallet?.address || user.wallet.address;
        console.log('🎯 [Access Check] Using address:', addressToCheck);
        console.log('   Address type:', user.smartWallet?.address ? 'Smart Wallet (ERC-4337)' : 'EOA');

        // Create public client for reading blockchain
        const publicClient = createPublicClient({
          chain: baseSepolia,
          transport: http('https://sepolia.base.org'),
        });

        // ===== CHECK 1: NFT Ownership (Purchase) =====
        console.log('📖 [Access Check] Checking NFT ownership...');
        const balance = await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: contractABI,
          functionName: 'balanceOf',
          args: [addressToCheck as `0x${string}`, BigInt(bookId)],
        }) as bigint;

        console.log('   NFT Balance:', balance.toString());

        // ===== CHECK 2: Library Borrowing (ERC-5006) =====
        console.log('📚 [Access Check] Checking library borrow status...');

        // All library pool addresses and names
        const libraries = [
          { address: '0xA31D6d3f2a6C5fBA99E451CCAAaAdf0bca12cbF0', name: 'The Room 19' },
          { address: '0xa1371f33A4C90a397862c9c05919Aa6B4A3761cD', name: 'Bandung City Digital Library' },
          { address: '0x72A421C93dA185adF33F8fC6bF90FEA850E1AC0b', name: 'Block71 Indonesia' }
        ];

        let hasBorrow = false;
        let borrowExpiry: number | null = null;
        let libraryName: string | null = null;

        // Check all libraries
        for (const library of libraries) {
          try {
            const activeBorrows: any = await publicClient.readContract({
              address: library.address as `0x${string}`,
              abi: libraryPoolABI,
              functionName: 'getActiveBorrows',
              args: [addressToCheck as `0x${string}`],
            });

            console.log(`   Checking ${library.name}:`, activeBorrows.length, 'borrows');

            // Check if user has borrowed this specific book from this library
            const borrowForThisBook = activeBorrows.find(
              (borrow: any) => Number(borrow.tokenId) === Number(bookId)
            );

            if (borrowForThisBook) {
              hasBorrow = true;
              borrowExpiry = Number(borrowForThisBook.expiry);
              libraryName = library.name;
              console.log(`   ✅ Found active borrow from ${library.name}`);
              console.log('   Expiry:', new Date(borrowExpiry * 1000).toLocaleString());
              break; // Found the borrow, no need to check other libraries
            }
          } catch (e) {
            console.log(`   ⚠️ Could not fetch borrows from ${library.name}`);
          }
        }

        // ===== SET ACCESS STATES =====
        const hasNFT = (balance as any) > 0n;

        console.log('🎯 [FINAL CHECK]', {
          hasNFT,
          hasBorrow,
          borrowExpiry,
          willGrantAccess: hasNFT || hasBorrow
        });

        setOwnsNFT(hasNFT);
        setHasBorrowed(hasBorrow);
        setBorrowExpiry(borrowExpiry);
        setBorrowedFromLibrary(libraryName);

        if (hasNFT) {
          console.log('✅ [Access Check] User OWNS this book NFT (purchased)');
        } else if (hasBorrow) {
          console.log('✅ [Access Check] User has BORROWED this book from library');
        } else {
          console.log('❌ [Access Check] User has NO access to this book');
        }

      } catch (error) {
        console.error('❌ [Access Check] Error verifying access:', error);
        setOwnsNFT(false);
        setHasBorrowed(false);
      }
    };

    verifyAccess();
  }, [bookId, authenticated, user?.wallet?.address, user?.smartWallet?.address]);

  // Redirect if user has no access
  useEffect(() => {
    if (ownsNFT === null || hasBorrowed === null) {
      console.log('⏳ [Access Check] Still checking access...');
      return;
    }

    if (ownsNFT === true || hasBorrowed === true) {
      const accessMethod = ownsNFT ? 'NFT Ownership' : 'Library Borrowing';
      console.log(`✅ [Access Check] User granted access via: ${accessMethod}`);
      return;
    }

    // No access - redirect
    console.log('🚫 [Access Check] Redirecting - no access');
    alert('⚠️ You do not have access to this book!\n\nPlease purchase the book or borrow it from the library.');
    navigate(`/books/${bookId}`);
  }, [ownsNFT, hasBorrowed, bookId, navigate]);

  // =============================================================
  // 📚 LOAD BOOK AND DETECT TYPE (EPUB or PDF)
  // =============================================================
  useEffect(() => {
    console.log('🔄 [LoadBook] useEffect triggered!');
    console.log('   authenticated:', authenticated);
    console.log('   user?.wallet?.address:', user?.wallet?.address);
    console.log('   bookId:', bookId);
    console.log('   ownsNFT:', ownsNFT);
    console.log('   hasBorrowed:', hasBorrowed);

    const loadBook = async () => {
      if (!authenticated || !user?.wallet?.address) {
        console.log('⚠️ [LoadBook] User not authenticated, waiting...');
        return;
      }

      // Wait for access check to complete
      if (ownsNFT === null || hasBorrowed === null) {
        console.log('⏳ [LoadBook] Access check not completed yet, waiting...');
        return;
      }

      console.log('✅ [LoadBook] Starting loadBook function...');

      try {
        setLoading(true);
        setError(null);

        console.log(`📚 [LoadBook] Fetching book #${bookId} from database...`);

        // Fetch book metadata from Supabase
        // Note: donated_by and donated_at columns may not exist yet in database
        const { data: book, error: fetchError } = await supabase
          .from('Book')
          .select('id, title, author, epub, metadataUri')
          .eq('id', parseInt(bookId, 10))
          .single();

        if (fetchError || !book) {
          console.error('❌ [LoadBook] Failed to fetch book:', fetchError);
          setError('Book not found');
          setLoading(false);
          return;
        }

        console.log('✅ [LoadBook] Book fetched:', book.title);
        setBookTitle(book.title);
        setBookCover(book.metadataUri);

        // ALWAYS set donation info - hardcoded for testing
        const mockDonatedBy = "PT Everidea Interaktif Nusantara";
        const mockDonatedAt = "2025-12-01T00:00:00+07:00";

        setDonatedBy(mockDonatedBy);
        setDonatedAt(mockDonatedAt);

        console.log('📦 [LoadBook] Donation info ALWAYS set:', {
          donatedBy: mockDonatedBy,
          donatedAt: mockDonatedAt,
        });

        // Verify document is from Supabase Storage
        if (!isSupabaseStorageUrl(book.epub)) {
          console.error('❌ [LoadBook] Document must be from Supabase Storage:', book.epub);
          setError('This book is not available. Please contact support.');
          setLoading(false);
          return;
        }

        // Detect document type (EPUB or PDF)
        const docInfo = detectDocumentType(book.epub);
        console.log('🔍 [LoadBook] Detected document type:', docInfo.type);
        console.log('   Extension:', docInfo.extension);
        console.log('   MIME type:', docInfo.mimeType);

        if (docInfo.type === 'unknown') {
          console.error('❌ [LoadBook] Unknown document type:', book.epub);
          setError('Unsupported file format. Only EPUB and PDF are supported.');
          setLoading(false);
          return;
        }

        setDocumentType(docInfo.type);

        // Download document using generalized function
        console.log('🔐 [LoadBook] Downloading document from Supabase...');
        const downloadStartTime = performance.now();
        const result = await downloadDocumentBlob(book.id, book.epub);
        const downloadEndTime = performance.now();

        if (!result) {
          console.error('❌ [LoadBook] Failed to download document');
          setError('Failed to download book file. Please try again.');
          setLoading(false);
          return;
        }

        console.log('✅ [LoadBook] Document downloaded successfully');
        console.log('   Type:', result.type);
        console.log('   Size:', (result.blob.size / 1024 / 1024).toFixed(2), 'MB');
        console.log('   ⏱️ Download time:', ((downloadEndTime - downloadStartTime) / 1000).toFixed(2), 'seconds');

        // Convert Blob to ArrayBuffer
        console.log('🔄 [LoadBook] Converting Blob to ArrayBuffer...');
        const conversionStartTime = performance.now();
        const arrayBuffer = await result.blob.arrayBuffer();
        const conversionEndTime = performance.now();
        console.log('✅ [LoadBook] ArrayBuffer created');
        console.log('   Size:', (arrayBuffer.byteLength / 1024 / 1024).toFixed(2), 'MB');
        console.log('   ⏱️ Conversion time:', ((conversionEndTime - conversionStartTime) / 1000).toFixed(2), 'seconds');

        console.log('🎨 [LoadBook] Setting document data and switching to renderer...');
        setDocumentData(arrayBuffer);
        setLoading(false);

        // Show splash screen based on WHERE user accessed from
        // - FROM LIBRARY PAGE (fromLibrary=true) + has borrow -> Show splash
        // - FROM BOOKSHELF (fromLibrary=false) -> No splash (even if has borrow)
        console.log('🎬 [LoadBook] Checking splash screen conditions:');
        console.log('   mockDonatedBy (local):', mockDonatedBy);
        console.log('   hasBorrowed:', hasBorrowed);
        console.log('   ownsNFT:', ownsNFT);
        console.log('   borrowedFromLibrary:', borrowedFromLibrary);
        console.log('   fromLibrary (route state):', fromLibrary);

        // Use local variable mockDonatedBy, not state donatedBy (state is async!)
        if (mockDonatedBy && hasBorrowed && fromLibrary) {
          // User accessed from LIBRARY PAGE and has borrow -> Show splash
          console.log('✅ [LoadBook] Showing donation splash (accessed from library page)');
          console.log('   Library:', borrowedFromLibrary);
          console.log('   User also owns NFT?', ownsNFT);
          setShowSplash(true);
        } else if (ownsNFT && !fromLibrary) {
          // User accessed from BOOKSHELF -> Skip splash
          console.log('⏭️  [LoadBook] Accessed from bookshelf - skipping donation splash');
        } else if (!hasBorrowed) {
          console.log('⏭️  [LoadBook] User has not borrowed - skipping donation splash');
        } else if (!fromLibrary) {
          console.log('⏭️  [LoadBook] Not accessed from library page - skipping donation splash');
        } else if (!mockDonatedBy) {
          console.log('⏭️  [LoadBook] No donation info - skipping donation splash');
        }

        const totalTime = (conversionEndTime - downloadStartTime) / 1000;
        console.log(`✅ [LoadBook] ${docInfo.type.toUpperCase()} ready for renderer`);
        console.log(`   ⏱️ Total loading time: ${totalTime.toFixed(2)} seconds`);

      } catch (err) {
        console.error('❌ [LoadBook] Error loading book:', err);
        setError(err instanceof Error ? err.message : 'Failed to load book');
        setLoading(false);
      }
    };

    console.log('🚀 [LoadBook] Calling loadBook() now...');
    loadBook();

    return () => {
      console.log('🧹 [LoadBook] Component unmounted');
    };
  }, [bookId, authenticated, user?.wallet?.address, ownsNFT, hasBorrowed, borrowedFromLibrary]);

  // =============================================================
  // 🎨 RENDER APPROPRIATE READER
  // =============================================================

  console.log('🔍 [Render Check] Current state:', {
    loading,
    showSplash,
    documentType,
    hasDocumentData: !!documentData,
    documentDataSize: documentData ? (documentData.byteLength / 1024 / 1024).toFixed(2) + ' MB' : 'null'
  });

  // Show donation splash screen first (if applicable)
  if (showSplash && donatedBy && documentData) {
    console.log('🎬 [Render] Showing donation splash screen...');
    return (
      <DonationSplashScreen
        bookTitle={bookTitle}
        bookCover={bookCover}
        donatedBy={donatedBy}
        donatedAt={donatedAt}
        onFinish={() => {
          console.log('✅ [Splash] Finished, switching to reader...');
          setShowSplash(false);
        }}
        duration={3000}
      />
    );
  }

  // Loading state
  if (loading) {
    console.log('⏳ [Render] Showing loading screen...');
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-2 border-amber-500"></div>
          <p className="mt-4 text-zinc-700 font-medium">Loading {bookTitle}...</p>
          <p className="mt-2 text-sm text-zinc-500">Verifying access and preparing document</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    console.log('❌ [Render] Showing error screen:', error);
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-50">
        <div className="text-center text-red-600 px-4 max-w-md">
          <svg className="w-20 h-20 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-xl font-semibold mb-2">Error Loading Book</p>
          <p className="text-sm">{error}</p>
          <button
            onClick={() => navigate('/books')}
            className="mt-6 px-6 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
          >
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  // Route to appropriate renderer based on document type
  if (documentType === 'pdf' && documentData) {
    console.log('🎨 [Render] ========================================');
    console.log('🎨 [Render] Rendering PDF now!');
    console.log('🎨 [Render] Book:', bookTitle, `(ID: ${bookId})`);
    console.log('🎨 [Render] Data size:', (documentData.byteLength / 1024 / 1024).toFixed(2), 'MB');
    console.log('🎨 [Render] About to return PdfRenderer with key: pdf-${bookId}');
    console.log('🎨 [Render] ========================================');

    return (
      <div key={`pdf-${bookId}`}>
        <PdfRenderer
          pdfData={documentData}
          bookId={bookId}
          bookTitle={bookTitle}
          hasBorrowed={hasBorrowed || false}
          borrowExpiry={borrowExpiry}
        />
      </div>
    );
  }

  if (documentType === 'epub' && documentData) {
    console.log('🎨 [Render] Rendering EPUB with EpubReaderScreen with key: epub-${bookId}');
    // For EPUB, we use the existing EpubReaderScreen
    // Note: EpubReaderScreen will re-do access checks and loading, but that's okay for now
    // In future refactoring, we can extract the rendering part of EpubReaderScreen
    return <EpubReaderScreen key={`epub-${bookId}`} />;
  }

  // Fallback (should not reach here)
  return (
    <div className="flex items-center justify-center h-screen bg-zinc-50">
      <div className="text-center">
        <p className="text-zinc-700">Preparing document...</p>
      </div>
    </div>
  );
};

export default DocumentReaderScreen;
