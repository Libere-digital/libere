/* eslint-disable @typescript-eslint/no-explicit-any */
import { encodeFunctionData } from "viem";
import { baseSepolia } from "viem/chains";
import { useEffect, useState } from "react";
import { libraryPoolAddress, libraryPoolABI } from "../../library-pool.abi";
import { FiSlash } from "react-icons/fi";
import { FaBookReader } from "react-icons/fa";
import { BiArrowBack } from "react-icons/bi";
import { useNavigate } from "react-router-dom";

interface Props {
  client: any;
  clientPublic: any;
  isBookAvailable: boolean;
  bookId: number;
  smartWalletAddress: string;
  onBorrowStatusChange?: (expiry: number | null) => void;
  libraryAddress?: string; // Optional: specific library pool address
}

const CivilibAccessButton = ({
  client,
  clientPublic,
  isBookAvailable,
  bookId,
  smartWalletAddress,
  onBorrowStatusChange,
  libraryAddress,
}: Props) => {
  // Use provided libraryAddress or default to libraryPoolAddress
  const effectiveLibraryAddress = libraryAddress || libraryPoolAddress;
  const [hasBorrowed, setHasBorrowed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const navigate = useNavigate();

  // Check if user has borrowed this book using getActiveBorrows
  useEffect(() => {
    const checkBorrowStatus = async () => {
      if (!clientPublic || !smartWalletAddress) return;

      try {
        // All libraries now use getActiveBorrows (returns expiry time)
        const activeBorrows: any = await clientPublic.readContract({
          address: effectiveLibraryAddress,
          abi: libraryPoolABI,
          functionName: "getActiveBorrows",
          args: [smartWalletAddress],
        });

        // Check if user has borrowed this specific book
        const borrowForThisBook = activeBorrows.find(
          (borrow: any) => Number(borrow.tokenId) === bookId
        );

        if (borrowForThisBook) {
          setHasBorrowed(true);
          const expiryTimestamp = Number(borrowForThisBook.expiry);

          // Notify parent component about expiry
          if (onBorrowStatusChange) {
            onBorrowStatusChange(expiryTimestamp);
          }
        } else {
          setHasBorrowed(false);
          if (onBorrowStatusChange) {
            onBorrowStatusChange(null);
          }
        }
      } catch (error) {
        console.error("getActiveBorrows failed:", error);
        setHasBorrowed(false);
        if (onBorrowStatusChange) {
          onBorrowStatusChange(null);
        }
      }
    };

    checkBorrowStatus();
  }, [bookId, clientPublic, smartWalletAddress, effectiveLibraryAddress]); // Remove onBorrowStatusChange to prevent infinite loop

  // Borrow book from library pool
  const onBorrowBook = async () => {
    if (!client) {
      setStatusMessage("Please connect your wallet");
      return;
    }

    setLoading(true);
    setStatusMessage("Borrowing book...");

    try {
      const tx = await client.sendTransaction({
        chain: baseSepolia,
        to: effectiveLibraryAddress,
        data: encodeFunctionData({
          abi: libraryPoolABI,
          functionName: "borrowFromPool",
          args: [BigInt(bookId)],
        }),
      });

      console.log("Borrow tx:", tx);
      setStatusMessage("Book borrowed successfully!");

      // Refresh borrow status after a short delay to allow blockchain to update
      setTimeout(async () => {
        setStatusMessage("");
        setLoading(false);

        // Fetch updated borrow status with expiry
        try {
          const activeBorrows: any = await clientPublic.readContract({
            address: effectiveLibraryAddress,
            abi: libraryPoolABI,
            functionName: "getActiveBorrows",
            args: [smartWalletAddress],
          });

          const borrowForThisBook = activeBorrows.find(
            (borrow: any) => Number(borrow.tokenId) === bookId
          );

          if (borrowForThisBook) {
            setHasBorrowed(true);
            const expiryTimestamp = Number(borrowForThisBook.expiry);

            if (onBorrowStatusChange) {
              onBorrowStatusChange(expiryTimestamp);
            }
          }
        } catch (error) {
          console.error("Error fetching updated borrow status:", error);
        }
      }, 2000);
    } catch (error: any) {
      console.error("Error borrowing book:", error);
      setStatusMessage(`Error: ${error.message || "Failed to borrow"}`);
      setLoading(false);
    }
  };

  // Return borrowed book
  const onReturnBook = async () => {
    if (!client) {
      setStatusMessage("Please connect your wallet");
      return;
    }

    setLoading(true);
    setStatusMessage("Returning book...");

    try {
      const tx = await client.sendTransaction({
        chain: baseSepolia,
        to: effectiveLibraryAddress,
        data: encodeFunctionData({
          abi: libraryPoolABI,
          functionName: "returnMyBorrow",
          args: [BigInt(bookId)],
        }),
      });

      console.log("Return tx:", tx);
      setStatusMessage("Book returned successfully!");

      // Refresh borrow status after a short delay
      setTimeout(() => {
        setHasBorrowed(false);
        setStatusMessage("");
        setLoading(false);

        // Notify parent that book was returned
        if (onBorrowStatusChange) {
          onBorrowStatusChange(null);
        }
      }, 2000);
    } catch (error: any) {
      console.error("Error returning book:", error);
      setStatusMessage(`Error: ${error.message || "Failed to return"}`);
      setLoading(false);
    }
  };

  const onOpenEpub = () => {
    // Navigate with state to indicate user came from library page
    navigate(`/read-book/${bookId}`, { state: { fromLibrary: true } });
  };

  return (
    <div className="w-full space-y-2">
      {/* Status Message */}
      {statusMessage && (
        <div className={`text-xs text-center py-1 rounded ${
          statusMessage.includes("Error")
            ? "bg-red-50 text-red-700"
            : statusMessage.includes("successfully")
            ? "bg-green-50 text-green-700"
            : "bg-blue-50 text-blue-700"
        }`}>
          {statusMessage}
        </div>
      )}

      {/* Buttons */}
      {hasBorrowed ? (
        // User has borrowed this book - Show Read & Return buttons (regardless of availability)
        <div className="flex gap-2 w-full">
          <button
            onClick={onOpenEpub}
            disabled={loading}
            className="flex-1 cursor-pointer flex flex-row gap-2 justify-center items-center bg-zinc-900 text-white px-2.5 py-2 rounded-md disabled:bg-zinc-400 disabled:cursor-not-allowed hover:bg-zinc-800 transition-colors font-medium"
          >
            <FaBookReader /> Read Book
          </button>
          <button
            onClick={onReturnBook}
            disabled={loading}
            className="cursor-pointer flex flex-row gap-2 justify-center items-center bg-white border-2 border-zinc-900 text-zinc-900 px-3 py-2 rounded-md disabled:bg-zinc-200 disabled:cursor-not-allowed disabled:border-zinc-400 disabled:text-zinc-400 hover:bg-zinc-900 hover:text-white transition-colors font-medium"
          >
            <BiArrowBack /> Return
          </button>
        </div>
      ) : isBookAvailable ? (
        // User hasn't borrowed but book is available - Show Borrow button
        <button
          onClick={onBorrowBook}
          disabled={loading}
          className="cursor-pointer flex flex-row gap-2 justify-center items-center w-full bg-zinc-900 text-white px-2.5 py-2 rounded-md disabled:bg-zinc-400 disabled:cursor-not-allowed hover:bg-zinc-800 transition-colors font-medium"
        >
          <FaBookReader /> {loading ? "Borrowing..." : "Borrow"}
        </button>
      ) : (
        // Book not available and user hasn't borrowed
        <button
          disabled={true}
          className="cursor-pointer flex flex-row gap-2 justify-center items-center w-full bg-white border border-zinc-300 text-zinc-400 px-2.5 py-2 rounded-md disabled:bg-zinc-100 disabled:cursor-not-allowed font-medium"
        >
          <FiSlash />
          Not available
        </button>
      )}
    </div>
  );
};

export default CivilibAccessButton;
