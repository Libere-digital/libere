import { useParams, useNavigate } from "react-router-dom";
import { ReactReader } from "react-reader";
import { useState, useEffect, useRef } from "react";
import { FaArrowLeft, FaBookOpen, FaBookmark, FaRegBookmark } from "react-icons/fa";
import WatermarkOverlay from "../components/reader/WatermarkOverlay";
import { supabase } from "../libs/supabase";
import { isSupabaseStorageUrl } from "../utils/supabaseStorage";
import { usePrivy } from "@privy-io/react-auth";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { contractABI, contractAddress } from "../smart-contract.abi";
import { libraryPoolABI, libraryPoolAddress } from "../library-pool.abi";

console.log('📱 [EpubReaderScreen] Loaded - llibere-main version with NFT + Library verification');

const EpubReaderScreen = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const bookId = id || "unknown";
  const { user, authenticated } = usePrivy();

  console.log("📖 [Reader] Book ID from params:", bookId, "Type:", typeof bookId);

  const [location, setLocation] = useState<string | number>(0);
  const [ownsNFT, setOwnsNFT] = useState<boolean | null>(null); // null = checking, true/false = result
  const [hasBorrowed, setHasBorrowed] = useState<boolean | null>(null); // null = checking, true/false = result
  const [borrowExpiry, setBorrowExpiry] = useState<number | null>(null); // Unix timestamp
  const [progress, setProgress] = useState<number>(0);
  const [bookTitle, setBookTitle] = useState<string>("Reading...");
  const [epubUrl, setEpubUrl] = useState<string | ArrayBuffer | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [hoverProgress, setHoverProgress] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);
  const [isBookmarked, setIsBookmarked] = useState<boolean>(false);
  const [readingMode, setReadingMode] = useState<"paginated" | "scrolled">(
    (localStorage.getItem(`reading-mode-${bookId}`) as "paginated" | "scrolled") || "paginated"
  );
  const renditionRef = useRef<any>(null);
  const [locationsReady, setLocationsReady] = useState<boolean>(false);

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
        console.log('   User object:', user);
        console.log('   All wallet addresses:', {
          mainAddress: user.wallet?.address,
          smartWalletAddress: user.smartWallet?.address,
          linkedAccounts: user.linkedAccounts?.map((acc: any) => ({
            type: acc.type,
            address: acc.address
          }))
        });

        // IMPORTANT: Use smart wallet address for library borrow checks
        // Library Pool uses smart wallet (ERC-4337), not EOA
        const addressToCheck = user.smartWallet?.address || user.wallet.address;
        console.log('🎯 [Access Check] Using address for verification:', addressToCheck);
        console.log('   Address type:', user.smartWallet?.address ? 'Smart Wallet (ERC-4337)' : 'EOA');

        // Create public client for reading blockchain
        const publicClient = createPublicClient({
          chain: baseSepolia,
          transport: http('https://sepolia.base.org'), // Explicit RPC URL
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
        // Always check both, don't early return
        console.log('📚 [Access Check] Checking library borrow status...');
        console.log('   Library Pool Address:', libraryPoolAddress);
        console.log('   Query params:', {
          userAddress: addressToCheck,
          tokenId: bookId,
          tokenIdBigInt: BigInt(bookId).toString()
        });

        // Use usableBalanceOf (ERC-5006 standard) - returns 1 if active borrow, 0 if none/expired
        console.log('🎯 [DEBUG] About to call usableBalanceOf with:');
        console.log('   Contract:', libraryPoolAddress);
        console.log('   Function:', 'usableBalanceOf');
        console.log('   Arg 1 (user):', addressToCheck);
        console.log('   Arg 2 (tokenId):', bookId, '→ BigInt:', BigInt(bookId).toString());

        let usableBalance: any;
        try {
          usableBalance = await publicClient.readContract({
            address: libraryPoolAddress as `0x${string}`,
            abi: libraryPoolABI,
            functionName: 'usableBalanceOf',
            args: [addressToCheck as `0x${string}`, BigInt(bookId)],
          });

          console.log('✅ [DEBUG] usableBalanceOf call SUCCESS');
          console.log('   Raw result:', usableBalance);
          console.log('   Result type:', typeof usableBalance);
          console.log('   Result toString():', usableBalance?.toString ? usableBalance.toString() : 'N/A');
          console.log('   Result as string:', String(usableBalance));
        } catch (error: any) {
          console.error('❌ [DEBUG] usableBalanceOf call FAILED:', error);
          console.error('   Error message:', error?.message);
          console.error('   Error code:', error?.code);
          throw error; // Re-throw to be caught by outer try-catch
        }

        console.log('   Usable balance (borrowed):', usableBalance.toString());
        console.log('   Usable balance type:', typeof usableBalance);
        console.log('   Usable balance raw:', usableBalance);

        // Convert to bigint if needed
        const usableBalanceBigInt = typeof usableBalance === 'bigint' ? usableBalance : BigInt(usableBalance?.toString() || '0');
        console.log('   Usable balance (normalized):', usableBalanceBigInt.toString());
        console.log('   Interpretation:', usableBalanceBigInt > 0n ? 'HAS BORROW ✅' : 'NO BORROW ❌');

        // ===== DEBUG: Check activeRecordOf mapping =====
        try {
          console.log('🔍 [DEBUG] Checking activeRecordOf mapping...');
          const activeRecordOf: any = await publicClient.readContract({
            address: libraryPoolAddress as `0x${string}`,
            abi: libraryPoolABI,
            functionName: 'activeRecordOf',
            args: [addressToCheck as `0x${string}`, BigInt(bookId)],
          });
          console.log('   activeRecordOf result:', activeRecordOf.toString());

          if (activeRecordOf > 0n) {
            console.log('🔍 [DEBUG] Found record ID, fetching userRecordOf...');
            const recordDetails: any = await publicClient.readContract({
              address: libraryPoolAddress as `0x${string}`,
              abi: libraryPoolABI,
              functionName: 'userRecordOf',
              args: [activeRecordOf],
            });
            console.log('   Record details:', {
              tokenId: recordDetails[0]?.toString(),
              owner: recordDetails[1],
              user: recordDetails[2],
              amount: recordDetails[3]?.toString(),
              expiry: recordDetails[4]?.toString(),
              expiryDate: new Date(Number(recordDetails[4]) * 1000).toLocaleString(),
              isExpired: Number(recordDetails[4]) <= Math.floor(Date.now() / 1000)
            });
          } else {
            console.log('   No active record found (recordId = 0)');
          }
        } catch (debugError) {
          console.log('   Could not fetch activeRecordOf (may not be public):', debugError);
        }

        // ===== DEBUG: Try getActiveBorrows to see all borrows =====
        try {
          console.log('🔍 [DEBUG] Fetching all active borrows...');
          const allBorrows: any = await publicClient.readContract({
            address: libraryPoolAddress as `0x${string}`,
            abi: libraryPoolABI,
            functionName: 'getActiveBorrows',
            args: [addressToCheck as `0x${string}`],
          });
          console.log('   All active borrows count:', allBorrows?.length || 0);
          if (allBorrows && allBorrows.length > 0) {
            allBorrows.forEach((borrow: any, index: number) => {
              console.log(`   Borrow #${index + 1}:`, {
                recordId: borrow.recordId?.toString(),
                tokenId: borrow.tokenId?.toString(),
                expiry: borrow.expiry?.toString(),
                expiryDate: new Date(Number(borrow.expiry) * 1000).toLocaleString(),
                isThisBook: Number(borrow.tokenId) === Number(bookId)
              });
            });
          }
        } catch (debugError) {
          console.log('   Could not fetch getActiveBorrows:', debugError);
        }

        // ===== SET ALL STATES (no early return!) =====
        const hasNFT = (balance as any) > 0n;
        const hasBorrow = usableBalanceBigInt > 0n;

        console.log('🎯 [FINAL CHECK]', {
          balance: (balance as any).toString(),
          balanceType: typeof balance,
          balanceGtZero: (balance as any) > 0n,
          hasNFT,
          usableBalanceBigInt: usableBalanceBigInt.toString(),
          usableBalanceBigIntType: typeof usableBalanceBigInt,
          usableBalanceBigIntGtZero: usableBalanceBigInt > 0n,
          hasBorrow,
          willGrantAccess: hasNFT || hasBorrow
        });

        setOwnsNFT(hasNFT);
        setHasBorrowed(hasBorrow);

        if (hasNFT) {
          console.log('✅ [Access Check] User OWNS this book NFT (purchased)');
          setBorrowExpiry(null); // Not needed if owned
        } else if (hasBorrow) {
          console.log('✅ [Access Check] User has BORROWED this book from library');

          // Try to get expiry from getActiveBorrows if available
          try {
            const activeBorrows: any = await publicClient.readContract({
              address: libraryPoolAddress as `0x${string}`,
              abi: libraryPoolABI,
              functionName: 'getActiveBorrows',
              args: [addressToCheck as `0x${string}`],
            });

            const borrowForThisBook = activeBorrows.find(
              (borrow: any) => Number(borrow.tokenId) === Number(bookId)
            );

            if (borrowForThisBook) {
              const expiryTimestamp = Number(borrowForThisBook.expiry);
              setBorrowExpiry(expiryTimestamp);
              console.log('   Expiry:', new Date(expiryTimestamp * 1000).toLocaleString());
            } else {
              setBorrowExpiry(null);
            }
          } catch (e) {
            console.log('   Could not fetch expiry details (contract may not have getActiveBorrows)');
            setBorrowExpiry(null);
          }
        } else {
          console.log('❌ [Access Check] User has NO access to this book');
          setBorrowExpiry(null);
        }

      } catch (error) {
        console.error('❌ [Access Check] Error verifying access:', error);
        setOwnsNFT(false);
        setHasBorrowed(false);
      }
    };

    verifyAccess();
  }, [bookId, authenticated, user]);

  // Redirect if user has no access (neither owns nor borrowed)
  useEffect(() => {
    // Wait until both checks are complete
    if (ownsNFT === null || hasBorrowed === null) {
      console.log('⏳ [Access Check] Still checking access...');
      return;
    }

    // If user has access via either method, allow reading
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

  // Load book data and get EPUB via Supabase signed URL
  useEffect(() => {
    const loadBook = async () => {
      if (!authenticated || !user?.wallet?.address) {
        console.log('⚠️ [LoadBook] User not authenticated or wallet not ready, waiting...');
        return;
      }

      try {
        setLoading(true);
        setError(null);

        console.log(`📚 [LoadBook] Fetching book #${bookId} from database...`);

        // Fetch book metadata from Supabase
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

        // Verify EPUB is from Supabase Storage (IPFS not supported for security)
        if (!isSupabaseStorageUrl(book.epub)) {
          console.error('❌ [LoadBook] EPUB must be from Supabase Storage:', book.epub);
          setError('This book is not available. Please contact support.');
          setLoading(false);
          return;
        }

        // === SIMPLIFIED: Download EPUB as Blob from Supabase ===
        console.log('🔐 [LoadBook] Downloading EPUB from Supabase...');
        console.log('   Book EPUB field:', book.epub);
        console.log('   Book ID:', book.id);

        // Download EPUB directly as Blob
        const filePath = `${book.id}/book.epub`;
        console.log('   Downloading from path:', filePath);
        console.log('   Bucket: libere-books');

        const { data: epubBlob, error: downloadError } = await supabase.storage
          .from('libere-books')
          .download(filePath);

        console.log('   Download result:', {
          hasData: !!epubBlob,
          hasError: !!downloadError,
          error: downloadError,
          blobSize: epubBlob?.size,
          blobType: epubBlob?.type
        });

        if (downloadError) {
          console.error('❌ [LoadBook] Download error details:', {
            message: downloadError.message,
            statusCode: (downloadError as any).statusCode,
            error: downloadError
          });
          setError(`Failed to download book: ${downloadError.message}`);
          setLoading(false);
          return;
        }

        if (!epubBlob) {
          console.error('❌ [LoadBook] No blob data returned (but no error either)');
          setError('Failed to load book file. Please try again.');
          setLoading(false);
          return;
        }

        console.log('✅ [LoadBook] EPUB downloaded successfully');
        console.log('   Size:', (epubBlob.size / 1024 / 1024).toFixed(2), 'MB');
        console.log('   Type:', epubBlob.type);

        // Convert Blob to ArrayBuffer (ReactReader compatible format)
        console.log('🔄 [LoadBook] Converting Blob to ArrayBuffer...');
        const arrayBuffer = await epubBlob.arrayBuffer();
        console.log('✅ [LoadBook] ArrayBuffer created');
        console.log('   ArrayBuffer size:', (arrayBuffer.byteLength / 1024 / 1024).toFixed(2), 'MB');

        // Set ArrayBuffer for ReactReader (ReactReader accepts ArrayBuffer directly)
        setEpubUrl(arrayBuffer as any);
        console.log('✅ [LoadBook] epubUrl state updated with ArrayBuffer');

        setLoading(false);
        console.log('✅ [LoadBook] Loading state set to false');
        console.log('📚 [LoadBook] EPUB ready for ReactReader (ArrayBuffer)');

        // No cleanup needed for ArrayBuffer
        return undefined;

      } catch (err) {
        console.error('❌ [LoadBook] Error loading book:', err);
        setError(err instanceof Error ? err.message : 'Failed to load book');
        setLoading(false);
        return undefined;
      }
    };

    // No cleanup needed anymore (ArrayBuffer doesn't need cleanup)
    loadBook();

    // Cleanup on unmount
    return () => {
      console.log('🧹 [LoadBook] Component unmounted...');
    };
  }, [bookId, authenticated, user]);

  // ============================================
  // 🛡️ CONTENT PROTECTION (Right-click & DevTools)
  // ============================================
  useEffect(() => {
    // Disable right-click
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      console.log('⚠️ [Protection] Right-click blocked');
      // Optional: Show toast notification
      // alert('⚠️ Right-click is disabled for content protection');
    };

    // Detect DevTools opening (not 100% reliable, but adds friction)
    const detectDevTools = () => {
      const threshold = 160; // pixels
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;

      if (widthThreshold || heightThreshold) {
        console.warn('⚠️ [Protection] DevTools may be open');
        // Optional: Show warning or blur content
        // You could add a state to blur the reader content here
      }
    };

    // Disable common keyboard shortcuts for DevTools
    const handleKeyDown = (e: KeyboardEvent) => {
      // F12
      if (e.key === 'F12') {
        e.preventDefault();
        console.log('⚠️ [Protection] F12 blocked');
        return false;
      }

      // Ctrl+Shift+I / Cmd+Option+I (Inspect)
      if ((e.ctrlKey && e.shiftKey && e.key === 'I') ||
          (e.metaKey && e.altKey && e.key === 'i')) {
        e.preventDefault();
        console.log('⚠️ [Protection] Inspect shortcut blocked');
        return false;
      }

      // Ctrl+Shift+J / Cmd+Option+J (Console)
      if ((e.ctrlKey && e.shiftKey && e.key === 'J') ||
          (e.metaKey && e.altKey && e.key === 'j')) {
        e.preventDefault();
        console.log('⚠️ [Protection] Console shortcut blocked');
        return false;
      }

      // Ctrl+Shift+C / Cmd+Option+C (Element picker)
      if ((e.ctrlKey && e.shiftKey && e.key === 'C') ||
          (e.metaKey && e.altKey && e.key === 'c')) {
        e.preventDefault();
        console.log('⚠️ [Protection] Element picker blocked');
        return false;
      }

      // Ctrl+U / Cmd+U (View source)
      if ((e.ctrlKey && e.key === 'u') || (e.metaKey && e.key === 'u')) {
        e.preventDefault();
        console.log('⚠️ [Protection] View source blocked');
        return false;
      }

      // Ctrl+S / Cmd+S (Save page)
      if ((e.ctrlKey && e.key === 's') || (e.metaKey && e.key === 's')) {
        e.preventDefault();
        console.log('⚠️ [Protection] Save page blocked');
        return false;
      }
    };

    // Disable text selection (optional - may hurt UX)
    const handleSelectStart = (_e: Event) => {
      // Allow selection for accessibility, but log it
      console.log('📝 [Protection] Text selection detected');
      // Uncomment to disable selection:
      // _e.preventDefault();
    };

    // Attach event listeners
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('selectstart', handleSelectStart);

    // Check for DevTools every 1 second
    const devToolsInterval = setInterval(detectDevTools, 1000);

    console.log('✅ [Protection] Content protection enabled');

    // Cleanup
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('selectstart', handleSelectStart);
      clearInterval(devToolsInterval);
      console.log('🧹 [Protection] Content protection disabled');
    };
  }, []); // Run once on mount

  // Load saved location and bookmark from localStorage on mount
  useEffect(() => {
    const savedLocation = localStorage.getItem(`book-location-${bookId}`);
    const savedProgress = localStorage.getItem(`book-progress-${bookId}`);
    const savedBookmark = localStorage.getItem(`book-bookmark-${bookId}`);

    if (savedLocation) {
      setLocation(savedLocation);
    }
    if (savedProgress) {
      setProgress(parseInt(savedProgress, 10));
    }
    if (savedBookmark) {
      setIsBookmarked(true);
    }
  }, [bookId]);

  // Check if current page is bookmarked
  useEffect(() => {
    const currentLocation = location.toString();
    const savedBookmark = localStorage.getItem(`book-bookmark-${bookId}`);
    setIsBookmarked(savedBookmark === currentLocation);
  }, [location, bookId]);

  // Recalculate progress whenever location changes and locations are ready
  useEffect(() => {
    if (locationsReady && location && location !== 0) {
      console.log("📍 [Reader] Location state changed, recalculating progress...");
      console.log("   Current location:", location);
      setTimeout(() => calculateProgress(), 300);
    }
  }, [location, locationsReady]);

  // Calculate progress from current location
  const calculateProgress = () => {
    console.log("🔄 [calculateProgress] Starting calculation...");

    if (!renditionRef.current || !locationsReady) {
      console.log("⚠️ Progress calculation skipped - not ready", {
        hasRendition: !!renditionRef.current,
        locationsReady
      });
      return;
    }

    try {
      const rendition = renditionRef.current;
      const book = rendition.book;

      console.log("📚 Book object:", {
        hasBook: !!book,
        hasLocations: !!book?.locations,
        totalLocations: book?.locations?.total
      });

      if (!book || !book.locations || !book.locations.total) {
        console.log("⚠️ Book locations not available yet");
        return;
      }

      // Get current location - try multiple methods
      let currentCfi = location.toString();

      // If location is still default, try to get from rendition
      if (!currentCfi || currentCfi === "0") {
        console.log("⚠️ Location is 0, trying to get from rendition.location()");
        try {
          const currentLocation = rendition.currentLocation();
          if (currentLocation && currentLocation.start && currentLocation.start.cfi) {
            currentCfi = currentLocation.start.cfi;
            console.log("✅ Got CFI from currentLocation:", currentCfi);
          }
        } catch (e) {
          console.log("❌ Could not get currentLocation:", e);
        }
      }

      if (!currentCfi || currentCfi === "0") {
        console.log("❌ No valid location yet");
        return;
      }

      console.log("📍 Using CFI:", currentCfi);

      // Use locations.percentageFromCfi to get accurate percentage
      const percentage = book.locations.percentageFromCfi(currentCfi);

      console.log("📊 Percentage result:", percentage);

      if (percentage !== null && percentage !== undefined) {
        const progressPercent = Math.round(percentage * 100);
        const storageKey = `book-progress-${bookId}`;

        console.log("✅ Progress calculated:", progressPercent + "%", {
          bookId,
          storageKey,
          currentCfi,
          percentage
        });

        setProgress(progressPercent);
        localStorage.setItem(storageKey, progressPercent.toString());

        console.log(`💾 Saved to localStorage: ${storageKey} = ${progressPercent}`);
        console.log(`🔍 Verify saved:`, localStorage.getItem(storageKey));

        // Dispatch custom event for cross-component updates
        window.dispatchEvent(new CustomEvent('progressUpdate', {
          detail: { bookId: bookId, progress: progressPercent }
        }));

        console.log(`📢 Dispatched progressUpdate event for bookId: ${bookId}`);
      } else {
        console.log("❌ Could not calculate percentage from CFI");
      }
    } catch (error) {
      console.error("❌ Error calculating progress:", error);
    }
  };

  // Handle location changes and save progress
  const handleLocationChanged = (epubcfi: string) => {
    console.log("📍 [handleLocationChanged] Location changed:", epubcfi);
    console.log("   locationsReady:", locationsReady);
    console.log("   renditionRef:", !!renditionRef.current);

    setLocation(epubcfi);

    // Save location to localStorage immediately
    localStorage.setItem(`book-location-${bookId}`, epubcfi);
    console.log("💾 [handleLocationChanged] Saved location to localStorage");

    // Calculate and update progress
    if (locationsReady && renditionRef.current) {
      setTimeout(() => {
        console.log("⏱️ [handleLocationChanged] Triggering progress calculation...");
        calculateProgress();
      }, 300);
    } else {
      console.log("⚠️ [handleLocationChanged] Skipping calculation - not ready yet");
    }
  };

  const handleBack = () => {
    navigate(-1); // Go back to previous page (library or bookshelf)
  };

  // Handle reading mode change
  const handleReadingModeChange = (mode: "paginated" | "scrolled") => {
    setReadingMode(mode);
    localStorage.setItem(`reading-mode-${bookId}`, mode);
    console.log("📖 Reading mode changed to:", mode);

    // Auto-refresh page to apply new reading mode
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  // Handle progress bar click
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!renditionRef.current || !locationsReady) return;

    const progressBar = e.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (clickX / rect.width) * 100));

    try {
      // Navigate to percentage in the book
      const { book } = renditionRef.current;
      if (book && book.locations) {
        const cfi = book.locations.cfiFromPercentage(percentage / 100);
        renditionRef.current.display(cfi);
      }
    } catch (error) {
      console.error("Error jumping to location:", error);
    }
  };

  // Handle progress bar hover
  const handleProgressHover = (e: React.MouseEvent<HTMLDivElement>) => {
    const progressBar = e.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const hoverX = e.clientX - rect.left;
    const percentage = Math.round(Math.max(0, Math.min(100, (hoverX / rect.width) * 100)));
    setHoverProgress(percentage);
    setHoverPosition(hoverX);
  };

  const handleProgressLeave = () => {
    setHoverProgress(null);
    setHoverPosition(0);
  };

  // Handle bookmark toggle
  const handleBookmarkToggle = () => {
    const currentLocation = location.toString();

    if (isBookmarked) {
      // Remove bookmark
      localStorage.removeItem(`book-bookmark-${bookId}`);
      setIsBookmarked(false);
    } else {
      // Add bookmark
      localStorage.setItem(`book-bookmark-${bookId}`, currentLocation);
      setIsBookmarked(true);
    }
  };

  // Jump to bookmark
  const handleJumpToBookmark = () => {
    const savedBookmark = localStorage.getItem(`book-bookmark-${bookId}`);
    if (savedBookmark && renditionRef.current) {
      renditionRef.current.display(savedBookmark);
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-zinc-900 mx-auto mb-4"></div>
          <p className="text-zinc-600 font-medium">Loading book...</p>
          <p className="text-zinc-400 text-sm mt-2">Fetching from secure storage</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error || !epubUrl) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-50">
        <div className="text-center max-w-md px-6">
          <div className="text-6xl mb-4">📚</div>
          <h2 className="text-2xl font-bold text-zinc-900 mb-2">Cannot Load Book</h2>
          <p className="text-zinc-600 mb-6">{error || 'EPUB URL not available'}</p>
          <button
            onClick={handleBack}
            className="px-6 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            Back to Bookshelf
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-zinc-50">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200 shadow-sm">
        <div className="max-w-screen-xl mx-auto px-3 sm:px-6 py-2 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            {/* Left: Back button and title */}
            <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
              <button
                onClick={handleBack}
                className="flex items-center gap-1 sm:gap-2 text-zinc-600 hover:text-zinc-900 transition-colors shrink-0"
              >
                <FaArrowLeft className="text-xs sm:text-sm" />
                <span className="hidden sm:inline text-sm font-medium">Back</span>
              </button>

              <div className="hidden sm:block h-6 w-px bg-zinc-300"></div>

              <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
                <FaBookOpen className="text-zinc-500 text-xs sm:text-sm shrink-0" />
                <span className="text-xs sm:text-sm font-semibold text-zinc-900 truncate">{bookTitle}</span>

                {/* Show borrow status if book is borrowed */}
                {hasBorrowed && borrowExpiry && (
                  <span className="hidden sm:inline ml-2 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full whitespace-nowrap">
                    📚 <span className="hidden md:inline">Borrowed - Expires: </span>{(() => {
                      const now = Math.floor(Date.now() / 1000);
                      const timeLeft = borrowExpiry - now;
                      const daysLeft = Math.floor(timeLeft / 86400);
                      const hoursLeft = Math.floor((timeLeft % 86400) / 3600);

                      if (daysLeft > 0) {
                        return `${daysLeft}d ${hoursLeft}h`;
                      } else if (hoursLeft > 0) {
                        return `${hoursLeft}h`;
                      } else {
                        return 'Soon';
                      }
                    })()}
                  </span>
                )}
              </div>
            </div>

            {/* Right: Progress indicator and bookmark */}
            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
              {/* Reading mode toggle - hidden on mobile */}
              <div className="hidden md:flex items-center gap-1 border border-zinc-200 rounded-lg p-1">
                <button
                  onClick={() => handleReadingModeChange("paginated")}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    readingMode === "paginated"
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                  title="Page turning mode"
                >
                  📖 Page
                </button>
                <button
                  onClick={() => handleReadingModeChange("scrolled")}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    readingMode === "scrolled"
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                  title="Vertical scroll mode"
                >
                  📜 Scroll
                </button>
              </div>

              <div className="hidden md:block h-6 w-px bg-zinc-300"></div>

              {/* Bookmark buttons */}
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  onClick={handleBookmarkToggle}
                  className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
                    isBookmarked
                      ? "bg-yellow-100 text-yellow-600 hover:bg-yellow-200"
                      : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                  }`}
                  title={isBookmarked ? "Remove bookmark" : "Add bookmark"}
                >
                  {isBookmarked ? (
                    <FaBookmark className="text-xs sm:text-sm" />
                  ) : (
                    <FaRegBookmark className="text-xs sm:text-sm" />
                  )}
                </button>

                {localStorage.getItem(`book-bookmark-${bookId}`) && (
                  <button
                    onClick={handleJumpToBookmark}
                    className="hidden sm:block px-2 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded text-xs font-medium transition-colors"
                    title="Jump to bookmark"
                  >
                    Go to bookmark
                  </button>
                )}
              </div>

              <div className="hidden sm:block h-6 w-px bg-zinc-300"></div>

              {/* Progress bar */}
              <div className="flex items-center gap-1 sm:gap-2 relative">
                <div
                  onClick={handleProgressClick}
                  onMouseMove={handleProgressHover}
                  onMouseLeave={handleProgressLeave}
                  className={`w-16 sm:w-32 md:w-48 bg-zinc-200 rounded-full h-2 transition-colors relative group ${
                    locationsReady ? "cursor-pointer hover:bg-zinc-300" : "cursor-not-allowed opacity-50"
                  }`}
                  title={locationsReady ? "Click to jump to position" : "Loading book locations..."}
                >
                  <div
                    className="bg-zinc-900 h-2 rounded-full transition-all duration-300 group-hover:bg-zinc-800"
                    style={{ width: `${progress}%` }}
                  ></div>

                  {/* Hover tooltip */}
                  {hoverProgress !== null && locationsReady && (
                    <div
                      className="absolute -top-8 bg-zinc-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap transform -translate-x-1/2 pointer-events-none"
                      style={{ left: `${hoverPosition}px` }}
                    >
                      {hoverProgress}%
                    </div>
                  )}
                </div>
                <span className="text-[10px] sm:text-xs font-semibold text-zinc-700 min-w-[2rem] sm:min-w-[3rem]">
                  {progress}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reader */}
      <div className="flex-1 bg-white relative overflow-hidden">
        {(() => {
          console.log('🖼️ [Render] ReactReader component rendering...', {
            epubUrl,
            hasEpubUrl: !!epubUrl,
            epubUrlType: typeof epubUrl,
            isArrayBuffer: epubUrl instanceof ArrayBuffer,
            arrayBufferSize: epubUrl instanceof ArrayBuffer ? epubUrl.byteLength : 0,
            loading,
            error
          });
          return null;
        })()}
        <ReactReader
          key={bookId} // Force re-render when book changes
          url={epubUrl}
          location={location}
          locationChanged={handleLocationChanged}
          epubOptions={{
            flow: readingMode === "scrolled" ? "scrolled" : "paginated",
            manager: readingMode === "scrolled" ? "continuous" : "default",
            width: "100%",
            height: "100%",
          }}
          getRendition={(rendition: any) => {
            renditionRef.current = rendition;
            console.log("📖 [getRendition] Rendition loaded");
            console.log("   Rendition object:", rendition);
            console.log("   Book object:", rendition?.book);

            // Get book metadata
            if (rendition?.book?.packaging?.metadata?.title) {
              setBookTitle(rendition.book.packaging.metadata.title);
              console.log("📚 Book title set:", rendition.book.packaging.metadata.title);
            }

            // Generate locations for navigation
            const book = rendition.book;
            if (book) {
              book.ready.then(() => {
                console.log("📖 Book ready, generating locations...");
                return book.locations.generate(1024); // Generate locations
              }).then((locations: any) => {
                console.log("✅ Locations generated:", locations.length, "points");
                setLocationsReady(true);

                // Calculate initial progress after locations are ready
                setTimeout(() => {
                  console.log("🔄 Calculating initial progress...");
                  calculateProgress();
                }, 1000);
              }).catch((err: any) => {
                console.error("❌ Error generating locations:", err);
              });
            }

            // Listen for relocated event to update progress (MOST IMPORTANT)
            console.log("🎯 [getRendition] Setting up 'relocated' event listener...");
            rendition.on('relocated', (location: any) => {
              console.log("🔄 [relocated] ===== Event triggered =====", {
                start: location?.start?.cfi,
                end: location?.end?.cfi,
                percentage: location?.start?.percentage,
                timestamp: new Date().toISOString()
              });

              // Update location state immediately
              if (location?.start?.cfi) {
                const cfi = location.start.cfi;
                console.log("📍 [relocated] Updating location to:", cfi);
                setLocation(cfi);
                localStorage.setItem(`book-location-${bookId}`, cfi);
                console.log("💾 [relocated] Saved location to localStorage");
              }

              // Calculate progress after state update
              setTimeout(() => {
                console.log("⏱️ [relocated] Calculating progress...");
                calculateProgress();
              }, 100);
            });
            console.log("✅ [getRendition] 'relocated' event listener attached");

            // Listen for rendered event
            rendition.on('rendered', () => {
              console.log("🎨 [rendered] Page rendered");
              setTimeout(() => {
                console.log("⏱️ Calculating progress from rendered event...");
                calculateProgress();
              }, 100);
            });

            // Listen for page turn events
            rendition.on('displayedPages', (pages: any) => {
              console.log("📄 [displayedPages] Pages displayed:", pages);
            });

            console.log("✅ All event listeners attached to rendition");
          }}
        />
        <WatermarkOverlay isEnabled={true} />
      </div>
    </div>
  );
};

export default EpubReaderScreen;
