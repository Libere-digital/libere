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
import { FaArrowLeft } from "react-icons/fa";

const LIBRARIES = [
  { address: "0xA31D6d3f2a6C5fBA99E451CCAAaAdf0bca12cbF0", name: "The Room 19" },
  { address: "0xa1371f33A4C90a397862c9c05919Aa6B4A3761cD", name: "Bandung City Digital Library" },
  { address: "0x72A421C93dA185adF33F8fC6bF90FEA850E1AC0b", name: "Block71 Indonesia" },
];

const DocumentReaderScreen = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const bookId = id || "unknown";
  const { user, authenticated } = usePrivy();

  const fromLibrary = location.state?.fromLibrary === true;

  const [ownsNFT, setOwnsNFT] = useState<boolean | null>(null);
  const [hasBorrowed, setHasBorrowed] = useState<boolean | null>(null);
  const [borrowExpiry, setBorrowExpiry] = useState<number | null>(null);
  const [bookTitle, setBookTitle] = useState("Loading…");
  const [bookCover, setBookCover] = useState("");
  const [donatedBy, setDonatedBy] = useState<string | undefined>(undefined);
  const [donatedAt, setDonatedAt] = useState<string | undefined>(undefined);
  const [documentData, setDocumentData] = useState<ArrayBuffer | null>(null);
  const [documentType, setDocumentType] = useState<"epub" | "pdf" | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSplash, setShowSplash] = useState(false);

  // ── Access verification ─────────────────────────────────────────
  useEffect(() => {
    if (!authenticated || !user?.wallet?.address) {
      setOwnsNFT(false);
      setHasBorrowed(false);
      return;
    }

    const verify = async () => {
      try {
        const addr = (user.smartWallet?.address || user.wallet!.address) as `0x${string}`;

        const publicClient = createPublicClient({
          chain: baseSepolia,
          transport: http("https://sepolia.base.org"),
        });

        const balance = await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: contractABI,
          functionName: "balanceOf",
          args: [addr, BigInt(bookId)],
        }) as bigint;

        const hasNFT = balance > 0n;

        let hasBorrow = false;
        let expiry: number | null = null;

        for (const lib of LIBRARIES) {
          try {
            const borrows: any[] = await publicClient.readContract({
              address: lib.address as `0x${string}`,
              abi: libraryPoolABI,
              functionName: "getActiveBorrows",
              args: [addr],
            }) as any[];

            const match = borrows.find((b: any) => Number(b.tokenId) === Number(bookId));
            if (match) {
              hasBorrow = true;
              expiry = Number(match.expiry);
              break;
            }
          } catch (_) {
            // library unavailable
          }
        }

        setOwnsNFT(hasNFT);
        setHasBorrowed(hasBorrow);
        setBorrowExpiry(expiry);
      } catch (_) {
        setOwnsNFT(false);
        setHasBorrowed(false);
      }
    };

    verify();
  }, [bookId, authenticated, user?.wallet?.address, user?.smartWallet?.address]);

  // ── Redirect if no access ───────────────────────────────────────
  useEffect(() => {
    if (ownsNFT === null || hasBorrowed === null) return;
    if (ownsNFT || hasBorrowed) return;
    alert("You do not have access to this book.\n\nPlease purchase it or borrow it from a library.");
    navigate(`/books/${bookId}`);
  }, [ownsNFT, hasBorrowed, bookId, navigate]);

  // ── Load book ───────────────────────────────────────────────────
  useEffect(() => {
    if (!authenticated || !user?.wallet?.address) return;
    if (ownsNFT === null || hasBorrowed === null) return;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: book, error: fetchErr } = await supabase
          .from("Book")
          .select("id, title, author, epub, metadataUri")
          .eq("id", parseInt(bookId, 10))
          .single();

        if (fetchErr || !book) {
          setError("Book not found");
          setLoading(false);
          return;
        }

        setBookTitle(book.title);
        setBookCover(book.metadataUri);

        // Donation info (hardcoded until DB column is added)
        const mockDonatedBy = "PT Everidea Interaktif Nusantara";
        const mockDonatedAt = "2025-12-01T00:00:00+07:00";
        setDonatedBy(mockDonatedBy);
        setDonatedAt(mockDonatedAt);

        if (!isSupabaseStorageUrl(book.epub)) {
          setError("This book is not available. Please contact support.");
          setLoading(false);
          return;
        }

        const docInfo = detectDocumentType(book.epub);
        if (docInfo.type === "unknown") {
          setError("Unsupported file format. Only EPUB and PDF are supported.");
          setLoading(false);
          return;
        }

        setDocumentType(docInfo.type);

        const result = await downloadDocumentBlob(book.id, book.epub);
        if (!result) {
          setError("Failed to download book file. Please try again.");
          setLoading(false);
          return;
        }

        const buf = await result.blob.arrayBuffer();
        setDocumentData(buf);
        setLoading(false);

        if (mockDonatedBy && hasBorrowed && fromLibrary) {
          setShowSplash(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load book");
        setLoading(false);
      }
    };

    load();
  }, [bookId, authenticated, user?.wallet?.address, ownsNFT, hasBorrowed]);

  // ── Render ──────────────────────────────────────────────────────

  if (showSplash && donatedBy && documentData) {
    return (
      <DonationSplashScreen
        bookTitle={bookTitle}
        bookCover={bookCover}
        donatedBy={donatedBy}
        donatedAt={donatedAt}
        onFinish={() => setShowSplash(false)}
        duration={3000}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-14 w-14 border-b-2 border-zinc-800 mb-4" />
          <p className="text-zinc-700 font-medium">Loading {bookTitle}…</p>
          <p className="mt-1 text-sm text-zinc-400">Verifying access &amp; preparing document</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-50">
        <div className="text-center px-4 max-w-sm">
          <div className="text-5xl mb-4">📄</div>
          <p className="text-lg font-semibold text-zinc-900 mb-2">Error Loading Book</p>
          <p className="text-sm text-zinc-500 mb-6">{error}</p>
          <button
            onClick={() => navigate("/books")}
            className="inline-flex items-center gap-2 px-5 py-2 bg-zinc-900 text-white rounded-lg text-sm hover:bg-zinc-800 transition-colors"
          >
            <FaArrowLeft className="text-xs" /> Back to Library
          </button>
        </div>
      </div>
    );
  }

  if (documentType === "pdf" && documentData) {
    return (
      <PdfRenderer
        pdfData={documentData}
        bookId={bookId}
        bookTitle={bookTitle}
        hasBorrowed={hasBorrowed ?? false}
        borrowExpiry={borrowExpiry}
      />
    );
  }

  if (documentType === "epub" && documentData) {
    return (
      <EpubReaderScreen
        epubData={documentData}
        bookId={bookId}
        bookTitle={bookTitle}
        hasBorrowed={hasBorrowed ?? false}
        borrowExpiry={borrowExpiry}
      />
    );
  }

  return (
    <div className="flex items-center justify-center h-screen bg-zinc-50">
      <p className="text-zinc-500">Preparing document…</p>
    </div>
  );
};

export default DocumentReaderScreen;
