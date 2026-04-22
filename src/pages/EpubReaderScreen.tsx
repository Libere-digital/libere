import { useNavigate } from "react-router-dom";
import { ReactReader } from "react-reader";
import { useState, useEffect, useRef } from "react";
import { FaArrowLeft, FaBookmark, FaRegBookmark } from "react-icons/fa";
import WatermarkOverlay from "../components/reader/WatermarkOverlay";

interface EpubReaderScreenProps {
  epubData: ArrayBuffer;
  bookId: string;
  bookTitle: string;
  hasBorrowed: boolean;
  borrowExpiry: number | null;
}

const EpubReaderScreen = ({
  epubData,
  bookId,
  bookTitle,
  hasBorrowed,
  borrowExpiry,
}: EpubReaderScreenProps) => {
  const navigate = useNavigate();

  const [location, setLocation] = useState<string | number>(
    () => localStorage.getItem(`book-location-${bookId}`) || 0
  );
  const [progress, setProgress] = useState<number>(
    () => parseInt(localStorage.getItem(`book-progress-${bookId}`) || "0", 10)
  );
  const [isBookmarked, setIsBookmarked] = useState<boolean>(
    () => !!localStorage.getItem(`book-bookmark-${bookId}`)
  );
  const [readingMode, setReadingMode] = useState<"paginated" | "scrolled">(
    () => (localStorage.getItem(`reading-mode-${bookId}`) as "paginated" | "scrolled") || "paginated"
  );
  const [locationsReady, setLocationsReady] = useState(false);
  const [hoverProgress, setHoverProgress] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState(0);
  const renditionRef = useRef<any>(null);

  // Disable right-click and common DevTools shortcuts
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes(e.key)) ||
        (e.metaKey && e.altKey && ["i", "j", "c"].includes(e.key)) ||
        ((e.ctrlKey || e.metaKey) && ["u", "s"].includes(e.key))
      ) {
        e.preventDefault();
      }
    };
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Check if current page matches saved bookmark
  useEffect(() => {
    const savedBookmark = localStorage.getItem(`book-bookmark-${bookId}`);
    setIsBookmarked(savedBookmark === location.toString());
  }, [location, bookId]);

  const calculateProgress = () => {
    if (!renditionRef.current || !locationsReady) return;
    try {
      const { book } = renditionRef.current;
      if (!book?.locations?.total) return;

      let currentCfi = location.toString();
      if (!currentCfi || currentCfi === "0") {
        const cur = renditionRef.current.currentLocation();
        currentCfi = cur?.start?.cfi || "";
      }
      if (!currentCfi || currentCfi === "0") return;

      const percentage = book.locations.percentageFromCfi(currentCfi);
      if (percentage == null) return;

      const pct = Math.round(percentage * 100);
      setProgress(pct);
      localStorage.setItem(`book-progress-${bookId}`, pct.toString());
    } catch (_) {
      // silent
    }
  };

  useEffect(() => {
    if (locationsReady && location && location !== 0) {
      setTimeout(calculateProgress, 300);
    }
  }, [location, locationsReady]);

  const handleLocationChanged = (epubcfi: string) => {
    setLocation(epubcfi);
    localStorage.setItem(`book-location-${bookId}`, epubcfi);
    if (locationsReady && renditionRef.current) {
      setTimeout(calculateProgress, 300);
    }
  };

  const handleReadingModeChange = (mode: "paginated" | "scrolled") => {
    setReadingMode(mode);
    localStorage.setItem(`reading-mode-${bookId}`, mode);
    setLocationsReady(false);
    renditionRef.current = null;
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!renditionRef.current || !locationsReady) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    try {
      const { book } = renditionRef.current;
      if (book?.locations) {
        renditionRef.current.display(book.locations.cfiFromPercentage(pct));
      }
    } catch (_) {
      // silent
    }
  };

  const handleProgressHover = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setHoverProgress(Math.round(Math.max(0, Math.min(100, (x / rect.width) * 100))));
    setHoverPosition(x);
  };

  const handleBookmarkToggle = () => {
    const loc = location.toString();
    if (isBookmarked) {
      localStorage.removeItem(`book-bookmark-${bookId}`);
      setIsBookmarked(false);
    } else {
      localStorage.setItem(`book-bookmark-${bookId}`, loc);
      setIsBookmarked(true);
    }
  };

  const handleJumpToBookmark = () => {
    const saved = localStorage.getItem(`book-bookmark-${bookId}`);
    if (saved && renditionRef.current) {
      renditionRef.current.display(saved);
    }
  };

  // Format borrow expiry
  const formatTimeRemaining = (expiry: number): string => {
    const left = expiry - Math.floor(Date.now() / 1000);
    if (left <= 0) return "Expired";
    const d = Math.floor(left / 86400);
    const h = Math.floor((left % 86400) / 3600);
    const m = Math.floor((left % 3600) / 60);
    if (d > 0) return `${d}d ${h}h left`;
    if (h > 0) return `${h}h ${m}m left`;
    return `${m}m left`;
  };

  return (
    <div className="h-screen flex flex-col bg-zinc-50">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200 shadow-sm flex-none">
        <div className="max-w-screen-xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-3">
          {/* Left: back + title */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-900 transition-colors shrink-0"
            >
              <FaArrowLeft className="text-sm" />
              <span className="hidden sm:inline text-sm font-medium">Back</span>
            </button>
            <div className="hidden sm:block h-5 w-px bg-zinc-200" />
            <span className="text-sm font-semibold text-zinc-900 truncate">{bookTitle}</span>
            {hasBorrowed && borrowExpiry && (
              <span className="hidden lg:inline shrink-0 px-2 py-0.5 bg-zinc-100 text-zinc-600 text-xs font-medium rounded-full">
                {formatTimeRemaining(borrowExpiry)}
              </span>
            )}
          </div>

          {/* Right: mode toggle + bookmark + progress */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Reading mode */}
            <div className="hidden md:flex items-center border border-zinc-200 rounded-lg overflow-hidden text-xs font-medium">
              <button
                onClick={() => handleReadingModeChange("paginated")}
                className={`px-3 py-1.5 transition-colors ${
                  readingMode === "paginated" ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-50"
                }`}
              >
                Page
              </button>
              <button
                onClick={() => handleReadingModeChange("scrolled")}
                className={`px-3 py-1.5 transition-colors ${
                  readingMode === "scrolled" ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-50"
                }`}
              >
                Scroll
              </button>
            </div>

            <div className="hidden md:block h-5 w-px bg-zinc-200" />

            {/* Bookmark */}
            <div className="flex items-center gap-1">
              <button
                onClick={handleBookmarkToggle}
                className={`p-2 rounded-lg transition-colors ${
                  isBookmarked ? "text-amber-500 hover:bg-amber-50" : "text-zinc-400 hover:bg-zinc-100"
                }`}
                title={isBookmarked ? "Remove bookmark" : "Bookmark this page"}
              >
                {isBookmarked ? <FaBookmark className="text-sm" /> : <FaRegBookmark className="text-sm" />}
              </button>
              {localStorage.getItem(`book-bookmark-${bookId}`) && (
                <button
                  onClick={handleJumpToBookmark}
                  className="hidden sm:block px-2 py-1 text-xs text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
                >
                  Go to mark
                </button>
              )}
            </div>

            <div className="hidden sm:block h-5 w-px bg-zinc-200" />

            {/* Progress bar */}
            <div className="flex items-center gap-2">
              <div
                onClick={handleProgressClick}
                onMouseMove={handleProgressHover}
                onMouseLeave={() => setHoverProgress(null)}
                className={`relative w-20 sm:w-36 md:w-48 h-1.5 bg-zinc-200 rounded-full group ${
                  locationsReady ? "cursor-pointer hover:bg-zinc-300" : "opacity-40 cursor-default"
                }`}
              >
                <div
                  className="bg-zinc-800 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
                {hoverProgress !== null && locationsReady && (
                  <div
                    className="absolute -top-7 bg-zinc-900 text-white text-[10px] px-1.5 py-0.5 rounded pointer-events-none -translate-x-1/2"
                    style={{ left: hoverPosition }}
                  >
                    {hoverProgress}%
                  </div>
                )}
              </div>
              <span className="text-xs font-semibold text-zinc-600 w-8 text-right">{progress}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Reader */}
      <div className="flex-1 relative overflow-hidden bg-white">
        <ReactReader
          key={`${bookId}-${readingMode}`}
          url={epubData}
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

            if (rendition?.book?.packaging?.metadata?.title) {
              // title already set from parent, skip
            }

            const book = rendition.book;
            if (book) {
              book.ready
                .then(() => book.locations.generate(1024))
                .then(() => {
                  setLocationsReady(true);
                  setTimeout(calculateProgress, 500);
                })
                .catch(() => {
                  // silent
                });
            }

            rendition.on("relocated", (loc: any) => {
              if (loc?.start?.cfi) {
                const cfi = loc.start.cfi;
                setLocation(cfi);
                localStorage.setItem(`book-location-${bookId}`, cfi);
                setTimeout(calculateProgress, 100);
              }
            });
          }}
        />
        <WatermarkOverlay isEnabled={true} />
      </div>
    </div>
  );
};

export default EpubReaderScreen;
