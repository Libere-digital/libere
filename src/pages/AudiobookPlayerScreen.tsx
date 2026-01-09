import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { supabase } from "../libs/supabase";
import { usePrivy } from "@privy-io/react-auth";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { contractABI, contractAddress } from "../smart-contract.abi";
import { libraryPoolABI, libraryPoolAddress } from "../library-pool.abi";
import { FaPlay, FaPause, FaBackward, FaForward, FaArrowLeft, FaVolumeMute, FaVolumeUp } from "react-icons/fa";
import { MdSpeed } from "react-icons/md";

console.log('🎵 [AudiobookPlayerScreen] Audiobook player with NFT verification');

const AudiobookPlayerScreen = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const bookId = id || "unknown";
  const { user, authenticated } = usePrivy();
  const audioRef = useRef<HTMLAudioElement>(null);

  // Access verification states
  const [ownsNFT, setOwnsNFT] = useState<boolean | null>(null);
  const [hasBorrowed, setHasBorrowed] = useState<boolean | null>(null);

  // Book data
  const [bookTitle, setBookTitle] = useState<string>("Loading...");
  const [bookAuthor, setBookAuthor] = useState<string>("");
  const [bookCover, setBookCover] = useState<string>("");
  const [audiobookUrl, setAudiobookUrl] = useState<string>("");

  // Player states
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [volume, setVolume] = useState<number>(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState<boolean>(false);

  // Loading & error states
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // =============================================================
  // 🔐 ACCESS VERIFICATION (NFT Ownership OR Library Borrowing)
  // =============================================================
  useEffect(() => {
    const verifyAccess = async () => {
      if (!authenticated || !user?.wallet?.address) {
        console.log('⚠️ [Access Check] User not authenticated');
        setOwnsNFT(false);
        setHasBorrowed(false);
        return;
      }

      try {
        console.log('🔐 [Access Check] Verifying access for audiobook #' + bookId);

        const addressToCheck = user.smartWallet?.address || user.wallet.address;
        console.log('🎯 [Access Check] Using address:', addressToCheck);

        const publicClient = createPublicClient({
          chain: baseSepolia,
          transport: http('https://sepolia.base.org'),
        });

        // Check NFT ownership
        console.log('📖 [Access Check] Checking NFT ownership...');
        const balance = await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: contractABI,
          functionName: 'balanceOf',
          args: [addressToCheck as `0x${string}`, BigInt(bookId)],
        }) as bigint;

        console.log('   NFT Balance:', balance.toString());

        // Check library borrowing
        console.log('📚 [Access Check] Checking library borrow status...');
        const usableBalance = await publicClient.readContract({
          address: libraryPoolAddress as `0x${string}`,
          abi: libraryPoolABI,
          functionName: 'usableBalanceOf',
          args: [addressToCheck as `0x${string}`, BigInt(bookId)],
        }) as bigint;

        console.log('   Usable balance (borrowed):', usableBalance.toString());

        const hasNFT = balance > 0n;
        const hasBorrow = usableBalance > 0n;

        console.log('🎯 [FINAL CHECK]', { hasNFT, hasBorrow, willGrantAccess: hasNFT || hasBorrow });

        setOwnsNFT(hasNFT);
        setHasBorrowed(hasBorrow);

        if (hasNFT) {
          console.log('✅ [Access Check] User OWNS this book NFT');
        } else if (hasBorrow) {
          console.log('✅ [Access Check] User has BORROWED this book');
        } else {
          console.log('❌ [Access Check] User has NO access');
        }

      } catch (error) {
        console.error('❌ [Access Check] Error:', error);
        setOwnsNFT(false);
        setHasBorrowed(false);
      }
    };

    verifyAccess();
  }, [bookId, authenticated, user?.wallet?.address, user?.smartWallet?.address]);

  // Redirect if no access
  useEffect(() => {
    if (ownsNFT === null || hasBorrowed === null) {
      return; // Still checking
    }

    if (ownsNFT === true || hasBorrowed === true) {
      console.log('✅ [Access Check] Access granted');
      return;
    }

    // No access - redirect
    console.log('🚫 [Access Check] Redirecting - no access');
    alert('⚠️ You do not have access to this audiobook!\n\nPlease purchase the book or borrow it from the library.');
    navigate(`/books/${bookId}`);
  }, [ownsNFT, hasBorrowed, bookId, navigate]);

  // =============================================================
  // 📚 LOAD BOOK METADATA
  // =============================================================
  useEffect(() => {
    const loadBook = async () => {
      if (!authenticated || !user?.wallet?.address) {
        return;
      }

      try {
        setLoading(true);
        setError(null);

        console.log(`📚 [LoadBook] Fetching book #${bookId}...`);

        const { data: book, error: fetchError } = await supabase
          .from('Book')
          .select('id, title, author, metadataUri, audiobook')
          .eq('id', parseInt(bookId, 10))
          .single();

        if (fetchError || !book) {
          console.error('❌ [LoadBook] Failed:', fetchError);
          setError('Book not found');
          setLoading(false);
          return;
        }

        if (!book.audiobook) {
          console.error('❌ [LoadBook] No audiobook available');
          setError('This book does not have an audiobook');
          setLoading(false);
          return;
        }

        console.log('✅ [LoadBook] Book loaded:', book.title);
        setBookTitle(book.title);
        setBookAuthor(book.author);
        setBookCover(book.metadataUri);
        setAudiobookUrl(book.audiobook);

        // Load saved progress from localStorage
        const savedTime = localStorage.getItem(`audiobook-progress-${bookId}`);
        if (savedTime && audioRef.current) {
          const time = parseFloat(savedTime);
          console.log(`📍 [LoadBook] Resuming from ${time}s`);
          audioRef.current.currentTime = time;
        }

        setLoading(false);

      } catch (err) {
        console.error('❌ [LoadBook] Error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load audiobook');
        setLoading(false);
      }
    };

    loadBook();
  }, [bookId, authenticated, user?.wallet?.address]);

  // =============================================================
  // 🎵 AUDIO PLAYER CONTROLS
  // =============================================================
  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const skip = (seconds: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, Math.min(duration, currentTime + seconds));
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const newTime = parseFloat(e.target.value);
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const newVolume = parseFloat(e.target.value);
    audioRef.current.volume = newVolume;
    setVolume(newVolume);
  };

  const changeSpeed = (rate: number) => {
    if (!audioRef.current) return;
    audioRef.current.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // =============================================================
  // 💾 PROGRESS TRACKING
  // =============================================================
  useEffect(() => {
    if (!isPlaying || !audioRef.current) return;

    const interval = setInterval(() => {
      if (audioRef.current) {
        const time = audioRef.current.currentTime;
        const percent = Math.floor((time / duration) * 100);

        localStorage.setItem(`audiobook-progress-${bookId}`, time.toString());
        localStorage.setItem(`audiobook-progress-percent-${bookId}`, percent.toString());

        console.log(`💾 [Progress] Saved: ${time.toFixed(1)}s (${percent}%)`);
      }
    }, 5000); // Save every 5 seconds

    return () => clearInterval(interval);
  }, [isPlaying, duration, bookId]);

  // =============================================================
  // 🎨 RENDER
  // =============================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-2 border-amber-500"></div>
          <p className="mt-4 text-zinc-700 font-medium">Loading audiobook...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-50">
        <div className="text-center text-red-600 px-4 max-w-md">
          <svg className="w-20 h-20 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-xl font-semibold mb-2">Error Loading Audiobook</p>
          <p className="text-sm">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-6 px-6 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 flex flex-col">
      {/* Header */}
      <div className="w-full bg-white border-b border-zinc-200 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
        >
          <FaArrowLeft className="text-zinc-700 text-xl" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-zinc-900 truncate">{bookTitle}</h1>
          <p className="text-sm text-zinc-500 truncate">{bookAuthor}</p>
        </div>
      </div>

      {/* Main Player */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Album Art */}
          <div className="w-full aspect-square mb-8 rounded-2xl overflow-hidden shadow-2xl">
            <img
              src={bookCover}
              alt={bookTitle}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Book Info */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-zinc-900 mb-2">{bookTitle}</h2>
            <p className="text-lg text-zinc-600">{bookAuthor}</p>
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <div className="flex justify-between text-sm text-zinc-500 mt-2">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Main Controls */}
          <div className="flex items-center justify-center gap-6 mb-6">
            <button
              onClick={() => skip(-15)}
              className="p-3 hover:bg-zinc-200 rounded-full transition-colors"
              title="Skip backward 15s"
            >
              <FaBackward className="text-zinc-700 text-xl" />
            </button>

            <button
              onClick={togglePlay}
              className="p-6 bg-amber-500 hover:bg-amber-600 rounded-full transition-colors shadow-lg"
            >
              {isPlaying ? (
                <FaPause className="text-white text-3xl" />
              ) : (
                <FaPlay className="text-white text-3xl ml-1" />
              )}
            </button>

            <button
              onClick={() => skip(15)}
              className="p-3 hover:bg-zinc-200 rounded-full transition-colors"
              title="Skip forward 15s"
            >
              <FaForward className="text-zinc-700 text-xl" />
            </button>
          </div>

          {/* Secondary Controls */}
          <div className="flex items-center justify-between gap-4">
            {/* Volume Control */}
            <div className="flex items-center gap-2 flex-1">
              {volume === 0 ? (
                <FaVolumeMute className="text-zinc-600" />
              ) : (
                <FaVolumeUp className="text-zinc-600" />
              )}
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={handleVolumeChange}
                className="flex-1 h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-zinc-600"
              />
            </div>

            {/* Speed Control */}
            <div className="relative">
              <button
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                className="flex items-center gap-1 px-3 py-2 bg-zinc-200 hover:bg-zinc-300 rounded-lg transition-colors"
              >
                <MdSpeed className="text-zinc-700" />
                <span className="text-sm font-medium text-zinc-700">{playbackRate}x</span>
              </button>

              {showSpeedMenu && (
                <div className="absolute bottom-full right-0 mb-2 bg-white border border-zinc-200 rounded-lg shadow-lg py-1 min-w-[80px]">
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                    <button
                      key={rate}
                      onClick={() => changeSpeed(rate)}
                      className={`w-full px-4 py-2 text-sm text-left hover:bg-zinc-100 transition-colors ${
                        playbackRate === rate ? 'bg-amber-50 text-amber-600 font-semibold' : 'text-zinc-700'
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Hidden Audio Element */}
      <audio
        ref={audioRef}
        src={audiobookUrl}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={() => {
          setIsPlaying(false);
          console.log('🎵 [Audio] Playback ended');
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />
    </div>
  );
};

export default AudiobookPlayerScreen;
