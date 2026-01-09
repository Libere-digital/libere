/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { contractAddress, contractABI } from "../../smart-contract.abi";
import { libraryPoolAddress, libraryPoolABI } from "../../library-pool.abi";
import CivilibAccessButton from "./CivilibAccessButton";
import CategoryBadge from "../CategoryBadge";
import type { Book } from "../../core/interfaces/book.interface";

interface Props {
  book: Book;
  client: any;
  clientPublic: any;
  libraryAddress?: string; // Optional: specific library pool address
  useMonochromeColors?: boolean; // Enable for The Room 19
}

const CivilibBookCard = ({ book, client, clientPublic, libraryAddress, useMonochromeColors = false }: Props) => {
  const [totalStock, setTotalStock] = useState(0);
  const [frozenNow, setFrozenNow] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userBorrowExpiry, setUserBorrowExpiry] = useState<number | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const availableBooks = totalStock - frozenNow;
  const isBookAvailable = availableBooks > 0;

  // Format expiry time
  const formatExpiryTime = (expiryTimestamp: number) => {
    const now = Math.floor(Date.now() / 1000); // Current time in seconds
    const timeLeft = expiryTimestamp - now;

    if (timeLeft <= 0) return "Expired";

    const days = Math.floor(timeLeft / 86400);
    const hours = Math.floor((timeLeft % 86400) / 3600);
    const minutes = Math.floor((timeLeft % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
  };


  // Use provided libraryAddress or default to libraryPoolAddress
  const effectiveLibraryAddress = libraryAddress || libraryPoolAddress;

  useEffect(() => {
    const fetchBookAvailability = async () => {
      try {
        // Check if clientPublic exists
        if (!clientPublic) {
          console.warn("clientPublic not available");
          setLoading(false);
          return;
        }

        // Fetch total stock from main contract (balanceOf library pool)
        const totalStockBalance: any = await clientPublic.readContract({
          address: contractAddress,
          abi: contractABI,
          functionName: "balanceOf",
          args: [effectiveLibraryAddress, BigInt(book.id)],
        });

        setTotalStock(Number(totalStockBalance));

        // Try to fetch frozen/borrowed count from library pool contract
        try {
          const availabilityData: any = await clientPublic.readContract({
            address: effectiveLibraryAddress,
            abi: libraryPoolABI,
            functionName: "previewAvailability",
            args: [BigInt(book.id)],
          });

          // previewAvailability returns [available, frozenNow]
          const frozen = Number(availabilityData[1]);
          setFrozenNow(frozen);
        } catch (previewError: any) {
          console.warn(`previewAvailability not available for ${effectiveLibraryAddress}, assuming all books are available`);
          // If previewAvailability doesn't exist (new contracts), assume all books are available
          setFrozenNow(0);
        }

        setLoading(false);
      } catch (error: any) {
        console.error("Error fetching book availability:", error);
        // Set defaults on error
        setTotalStock(0);
        setFrozenNow(0);
        setLoading(false);
      }
    };

    fetchBookAvailability();
  }, [clientPublic, book.id, effectiveLibraryAddress, refreshTrigger]);

  return (
    <li className="w-full h-full">
      <div
        className="w-full h-full flex flex-col p-5 rounded-lg border border-zinc-200 hover:border-zinc-300 hover:shadow-md transition-all duration-200 relative"
      >
        {/* Availability Tag - Top Right */}
        {!loading && totalStock > 0 && (
          <div className="absolute top-3 right-3 z-10">
            {availableBooks > 0 ? (
              <span className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
                Available
              </span>
            ) : (
              <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
                Not Available
              </span>
            )}
          </div>
        )}

        <div className="relative w-full h-56 bg-zinc-100 rounded overflow-hidden flex-shrink-0">
          <img
            src={book.metadataUri}
            alt={book.title}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="w-full mt-3 flex-1 flex flex-col">
          <h5 className="text-lg font-semibold tracking-tight text-zinc-900">
            {book.title}
          </h5>
          <p className="line-clamp-1 text-xs text-zinc-500 mt-1">
            {book.author}
          </p>
          {/* Category Badge */}
          {book.category && (
            <div className="mt-2">
              <CategoryBadge
                category={book.category}
                size="sm"
                useMonochromeColors={useMonochromeColors}
              />
            </div>
          )}
          <div className="flex flex-col items-start justify-start mt-3 mb-3 w-full gap-2">
            {loading ? (
              <span className="bg-zinc-100 text-zinc-600 text-xs font-semibold px-2.5 py-0.5 rounded-sm animate-pulse">
                Loading availability...
              </span>
            ) : totalStock === 0 ? (
              <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-2.5 py-0.5 rounded-sm">
                Not in library collection
              </span>
            ) : (
              <>
                <span
                  className={
                    availableBooks > 0
                      ? "bg-green-200 text-green-900 text-xs font-semibold px-2.5 py-0.5 rounded-sm"
                      : "bg-red-200 text-red-900 text-xs font-semibold px-2.5 py-0.5 rounded-sm"
                  }
                >
                  Availability: {availableBooks}/{totalStock}
                </span>
                {/* Show expiry time if user has borrowed this book */}
                {userBorrowExpiry && userBorrowExpiry > 1 && (
                  <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-sm">
                    Due: {formatExpiryTime(userBorrowExpiry)}
                  </span>
                )}
                {/* Show "Borrowed" badge if expiry is placeholder (value = 1) */}
                {userBorrowExpiry === 1 && (
                  <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-sm">
                    Currently Borrowed
                  </span>
                )}
              </>
            )}
          </div>
          <div className="w-full flex items-center gap-2 justify-between mt-auto">
            <CivilibAccessButton
              client={client}
              clientPublic={clientPublic}
              isBookAvailable={isBookAvailable}
              bookId={book.id}
              smartWalletAddress={client?.account.address}
              onBorrowStatusChange={(expiry) => {
                setUserBorrowExpiry(expiry);
                // Trigger availability refresh when borrow status changes
                setRefreshTrigger(prev => prev + 1);
              }}
              libraryAddress={effectiveLibraryAddress}
            />
          </div>
        </div>
      </div>
    </li>
  );
};

export default CivilibBookCard;
