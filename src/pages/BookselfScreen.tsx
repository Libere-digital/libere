import HomeLayout from "../components/layouts/HomeLayout";
import { useEffect, useState } from "react";
import config from "../libs/config";
import { useNavigate, useLocation } from "react-router-dom";
import BookselfBookList from "../components/bookself/ BookselfBookList";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { contractAddress } from "../smart-contract.abi";
import type { Book } from "../core/interfaces";

const baseUrl = config.env.supabase.baseUrl;

const BookselfScreen = () => {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [nftBooks, setNftBooks] = useState<Book[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const { client } = useSmartWallets();
  const location = useLocation();

  console.log("📚 [BookselfScreen] Mounted/Rendered, refreshKey:", refreshKey);

  // Refresh data when component mounts or location changes
  useEffect(() => {
    console.log("🔄 [BookselfScreen] Location changed or component mounted - triggering refresh");
    setRefreshKey(prev => prev + 1);
  }, [location.pathname]);

  // Also refresh on visibility change (for tab switching)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log("👀 [BookselfScreen] Page visible - triggering refresh");
        setRefreshKey(prev => prev + 1);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const fetchBooks = async () => {
      try {
        setLoading(true);

        console.log("📚 [BookselfScreen] Fetching books...");

        const res = await fetch(`${baseUrl}/rest/v1/Book`, {
          headers: {
            apiKey: config.env.supabase.apiKey,
          },
        });
        const data = await res.json();

        console.log("✅ [BookselfScreen] Books fetched:", data.length);
        console.log("📖 [BookselfScreen] All book IDs from Supabase:", data.map((b: any) => ({ id: b.id, type: typeof b.id, title: b.title })));

        setBooks(data);
        setLoading(false);
      } catch (err) {
        console.error("Failed to get Books Data", err);
        setLoading(false);
      }
    };
    fetchBooks();
  }, [refreshKey]);

  useEffect(() => {
    if (!books && !client) return;

    if(!client?.account) return;

    const fetchBookself = async () => {
      try {
        setLoading(true);

        const clientAddress = client?.account.address;

        const res = await fetch(
          'https://base-sepolia.blockscout.com/api/v2/addresses/' + clientAddress + "/nft?type=ERC-1155"
        );
        const data = await res.json();

        console.log("📦 [BookselfScreen] All NFTs from Blockscout:", data.items?.length);
        console.log("🔍 [BookselfScreen] Raw data:", JSON.stringify(data, null, 2));
        console.log("🎯 [BookselfScreen] Target contract:", contractAddress);

        // Filter hanya NFT dari kontrak Libere yang benar
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const libereNfts = data.items?.filter((item: any) => {
          const tokenAddress = item.token?.address_hash; // Field yang benar adalah address_hash!
          console.log("🔎 [BookselfScreen] Checking NFT:", {
            id: item.id,
            tokenAddress,
            matches: tokenAddress?.toLowerCase() === contractAddress.toLowerCase()
          });
          return tokenAddress?.toLowerCase() === contractAddress.toLowerCase();
        }) || [];

        console.log("✅ [BookselfScreen] Filtered Libere NFTs:", libereNfts);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ids: string[] = libereNfts.map((i: any) => i.id);
        console.log("📋 [BookselfScreen] NFT IDs:", ids.map(id => ({ id, type: typeof id })));

        const filteredBooks = books.filter((book) => {
          // Convert both to string untuk matching yang lebih robust
          const bookIdStr = String(book.id);
          const matches = ids.some(nftId => String(nftId) === bookIdStr);
          console.log(`📖 [BookselfScreen] Book ${book.id} (type: ${typeof book.id}, title: ${book.title}): ${matches ? '✅' : '❌'}`);
          return matches;
        }).map((book) => {
          // Tambahkan quantity untuk books dari Supabase
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const nftItem = libereNfts.find((item: any) => String(item.id) === String(book.id));
          const quantity = nftItem ? Number(nftItem.value) || 1 : 1;

          return {
            ...book,
            quantity: quantity
          };
        });

        console.log("📚 [BookselfScreen] Matched books:", filteredBooks);

        // Cek apakah ada NFT yang tidak punya data book di Supabase
        const orphanNftIds = ids.filter(nftId =>
          !books.some(book => String(book.id) === String(nftId))
        );

        if (orphanNftIds.length > 0) {
          console.warn("⚠️ [BookselfScreen] NFTs without book data in Supabase:", orphanNftIds);
          console.log("🔗 [BookselfScreen] Fetching metadata from blockchain for orphan NFTs...");

          // Ambil metadata dari Blockscout API response untuk NFT yang tidak ada di Supabase
          const orphanBooks = orphanNftIds.map((nftId) => {
            try {
              // Find NFT item dari libereNfts array
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const nftItem = libereNfts.find((item: any) => String(item.id) === String(nftId));

              if (!nftItem) {
                console.warn(`⚠️ [BookselfScreen] NFT ${nftId} not found in libereNfts array`);
                return null;
              }

              console.log(`📦 [BookselfScreen] Processing orphan NFT ${nftId}:`, nftItem);

              // Extract metadata dari API response
              const metadata = nftItem.metadata || {};
              const imageUrl = nftItem.image_url || metadata.image || "";
              const quantity = Number(nftItem.value) || 1; // Jumlah NFT yang dimiliki

              console.log(`📝 [BookselfScreen] Metadata for NFT ${nftId}:`, {
                name: metadata.name,
                description: metadata.description,
                imageUrl,
                quantity
              });

              // Create book object dari metadata Blockscout
              return {
                id: Number(nftId),
                title: metadata.name || `Book #${nftId}`,
                author: "Unknown Author", // Tidak ada di blockchain metadata
                publisher: "Unknown Publisher", // Tidak ada di blockchain metadata
                description: metadata.description || "No description available.",
                metadataUri: imageUrl, // Cover image URL
                epub: "", // Tidak ada di blockchain metadata
                priceEth: "0",
                royalty: 0,
                addressReciepent: "0x0000000000000000000000000000000000000000",
                addressRoyaltyRecipient: "0x0000000000000000000000000000000000000000",
                quantity: quantity, // Jumlah NFT yang dimiliki
              };
            } catch (error) {
              console.error(`❌ [BookselfScreen] Failed to process metadata for NFT ${nftId}:`, error);
              return null;
            }
          });

          // Filter out null values dan gabungkan dengan filtered books
          const validOrphanBooks = orphanBooks.filter(book => book !== null) as Book[];
          console.log("🎉 [BookselfScreen] Successfully fetched orphan books:", validOrphanBooks.length);

          setNftBooks([...filteredBooks, ...validOrphanBooks]);
        } else {
          setNftBooks(filteredBooks);
        }
        setLoading(false);
      } catch (err) {
        console.error("Failed to get Books Data", err);
        setLoading(false);
      }
    };

    fetchBookself();
  }, [books, client]);

  const navigate = useNavigate();
  return (
    <HomeLayout>
      <div className="w-full h-full flex items-center justify-center mt-16">
        <section
          className="w-full flex justify-start items-center rounded-lg relative max-w-screen-xl mx-6 p-12 bg-cover bg-center"
          style={{ backgroundImage: "url('/images/auth-illustration.png')" }}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs rounded-lg"></div>
          <div className="relative z-10 flex flex-col gap-4 text-white">
            <button
              onClick={() => navigate("/books")}
              className="cursor-pointer hover:underline w-fit text-sm"
            >
              &larr; Back
            </button>
            <h2 className="text-4xl md:text-5xl font-extrabold">My Bookshelf</h2>
            <p className="text-base md:text-lg max-w-2xl">
              Your personal space to view, track, and enjoy books you own or
              borrow — all in one organized collection, ready anytime whether
              digital, physical, or from the community.
            </p>
          </div>
        </section>
      </div>
      <div className="w-full h-fit flex items-center justify-center mt-12">
        <section className="w-full max-w-screen-xl px-6">
          <BookselfBookList key={refreshKey} books={nftBooks} isLoading={loading} />
        </section>
      </div>
    </HomeLayout>
  );
};

export default BookselfScreen;
