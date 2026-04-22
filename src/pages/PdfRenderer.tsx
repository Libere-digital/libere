import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import WatermarkOverlay from "../components/reader/WatermarkOverlay";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaSearchPlus, FaSearchMinus } from "react-icons/fa";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfRendererProps {
  pdfData: ArrayBuffer | Blob;
  bookId: string;
  bookTitle: string;
  hasBorrowed: boolean;
  borrowExpiry: number | null;
}

const PdfRenderer = ({ pdfData, bookId, bookTitle, hasBorrowed, borrowExpiry }: PdfRendererProps) => {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // Refs to each page div in scroll mode for IntersectionObserver
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(() => {
    const saved = parseInt(localStorage.getItem(`pdf-page-${bookId}`) || "1", 10);
    return saved > 0 ? saved : 1;
  });
  const [pageInput, setPageInput] = useState(() => {
    const saved = parseInt(localStorage.getItem(`pdf-page-${bookId}`) || "1", 10);
    return String(saved > 0 ? saved : 1);
  });
  const [scale, setScale] = useState(1.0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [viewMode, setViewMode] = useState<"scroll" | "page">("scroll");
  const [progress, setProgress] = useState(0);
  // Track whether we need to scroll to currentPage after switching to scroll mode
  const pendingScrollRef = useRef(false);

  // Memoize file so react-pdf doesn't reload on every render
  const pdfFile = useMemo(() => {
    if (pdfData instanceof Blob) return pdfData;
    // ArrayBuffer — wrap in object react-pdf accepts
    return { data: new Uint8Array(pdfData) };
  }, [pdfData]);

  // Track container width via ResizeObserver (used as base width for pages)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width - 32);
    });
    ro.observe(el);
    setContainerWidth(el.clientWidth - 32);
    return () => ro.disconnect();
  }, []);

  // Save progress to localStorage whenever currentPage changes
  useEffect(() => {
    if (numPages > 0) {
      const pct = Math.round((currentPage / numPages) * 100);
      setProgress(pct);
      localStorage.setItem(`book-progress-${bookId}`, String(pct));
      localStorage.setItem(`pdf-page-${bookId}`, String(currentPage));
    }
  }, [currentPage, numPages, bookId]);

  // IntersectionObserver to update currentPage while scrolling
  useEffect(() => {
    if (viewMode !== "scroll" || numPages === 0) return;

    const observers: IntersectionObserver[] = [];

    pageRefs.current.forEach((el, pageNum) => {
      const obs = new IntersectionObserver(
        ([entry]) => {
          // When page crosses 50% visibility threshold, set it as current
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            setCurrentPage(pageNum);
            setPageInput(String(pageNum));
          }
        },
        {
          root: scrollContainerRef.current,
          threshold: 0.5,
        }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, [viewMode, numPages]);

  // When switching from page → scroll mode, scroll to the current page
  useEffect(() => {
    if (viewMode === "scroll" && pendingScrollRef.current) {
      pendingScrollRef.current = false;
      // Small delay to let pages render first
      setTimeout(() => {
        const el = pageRefs.current.get(currentPage);
        if (el) el.scrollIntoView({ behavior: "instant", block: "start" });
      }, 100);
    }
  }, [viewMode, currentPage]);

  const handleSwitchToScroll = () => {
    pendingScrollRef.current = true;
    setViewMode("scroll");
  };

  const handleSwitchToPage = () => {
    // currentPage already reflects visible page from IntersectionObserver
    setViewMode("page");
  };

  const goToPrev = useCallback(() => {
    setCurrentPage((p) => {
      const next = Math.max(1, p - 1);
      setPageInput(String(next));
      return next;
    });
  }, []);

  const goToNext = useCallback(() => {
    setCurrentPage((p) => {
      const next = Math.min(numPages, p + 1);
      setPageInput(String(next));
      return next;
    });
  }, [numPages]);

  // Arrow key navigation (page mode only)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (viewMode !== "page") return;
      if (e.key === "ArrowLeft") { e.preventDefault(); goToPrev(); }
      if (e.key === "ArrowRight") { e.preventDefault(); goToNext(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goToPrev, goToNext, viewMode]);

  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseInt(pageInput, 10);
    if (!isNaN(n) && n >= 1 && n <= numPages) {
      setCurrentPage(n);
    } else {
      setPageInput(String(currentPage));
    }
  };

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

  // The effective page width passed to react-pdf Page component
  // containerWidth is the base; scale multiplies on top
  const pageWidth = containerWidth > 0 ? containerWidth * scale : undefined;

  return (
    <div className="h-screen flex flex-col bg-zinc-50">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200 shadow-sm flex-none">
        <div className="max-w-screen-xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-3">
          {/* Left */}
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

          {/* Right controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* View mode toggle */}
            <div className="flex items-center border border-zinc-200 rounded-lg overflow-hidden text-xs font-medium">
              <button
                onClick={handleSwitchToScroll}
                className={`px-3 py-1.5 transition-colors ${
                  viewMode === "scroll" ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-50"
                }`}
              >
                Scroll
              </button>
              <button
                onClick={handleSwitchToPage}
                className={`px-3 py-1.5 transition-colors ${
                  viewMode === "page" ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-50"
                }`}
              >
                Page
              </button>
            </div>

            <div className="h-5 w-px bg-zinc-200" />

            {/* Zoom controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setScale((s) => Math.max(0.5, Math.round((s - 0.1) * 10) / 10))}
                disabled={scale <= 0.5}
                className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg disabled:opacity-30 transition-colors"
                title="Zoom out"
              >
                <FaSearchMinus className="text-sm" />
              </button>
              <span className="text-xs text-zinc-600 w-10 text-center">{Math.round(scale * 100)}%</span>
              <button
                onClick={() => setScale((s) => Math.min(3.0, Math.round((s + 0.1) * 10) / 10))}
                disabled={scale >= 3.0}
                className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg disabled:opacity-30 transition-colors"
                title="Zoom in"
              >
                <FaSearchPlus className="text-sm" />
              </button>
            </div>

            <div className="h-5 w-px bg-zinc-200" />

            {/* Progress */}
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-20 sm:w-32 h-1.5 bg-zinc-200 rounded-full">
                <div
                  className="bg-zinc-800 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-zinc-600 w-8 text-right">{progress}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* PDF content */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden bg-zinc-100">
        <Document
          file={pdfFile}
          onLoadSuccess={({ numPages: n }) => {
            setNumPages(n);
            // Clamp restored page within actual page count
            setCurrentPage((p) => {
              const clamped = Math.min(p, n);
              setPageInput(String(clamped));
              return clamped;
            });
          }}
          loading={
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-zinc-700 mb-3" />
                <p className="text-zinc-500 text-sm">Loading PDF…</p>
              </div>
            </div>
          }
          error={
            <div className="flex items-center justify-center h-full">
              <div className="text-center px-4">
                <p className="text-red-600 font-semibold mb-1">Failed to load PDF</p>
                <button onClick={() => navigate(-1)} className="mt-3 px-4 py-1.5 bg-zinc-900 text-white rounded-lg text-sm">
                  Go back
                </button>
              </div>
            </div>
          }
          className="h-full"
        >
          {viewMode === "scroll" ? (
            // ── Scroll mode: all pages stacked ──────────────────────────
            <div
              ref={scrollContainerRef}
              className="h-full overflow-auto py-4 px-4"
            >
              {numPages > 0 &&
                Array.from({ length: numPages }, (_, i) => {
                  const pageNum = i + 1;
                  return (
                    <div
                      key={pageNum}
                      ref={(el) => {
                        if (el) pageRefs.current.set(pageNum, el);
                        else pageRefs.current.delete(pageNum);
                      }}
                      className="mb-3"
                    >
                      <Page
                        pageNumber={pageNum}
                        width={pageWidth}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        className="shadow-md rounded mx-auto"
                        loading={
                          <div
                            className="bg-zinc-200 rounded mx-auto animate-pulse"
                            style={{ width: pageWidth || 600, height: Math.round((pageWidth || 600) * 1.414) }}
                          />
                        }
                      />
                    </div>
                  );
                })}
            </div>
          ) : (
            // ── Page mode: single page ───────────────────────────────────
            <div className="h-full overflow-auto flex justify-center items-start py-6 px-4">
              <Page
                pageNumber={currentPage}
                width={pageWidth}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                className="shadow-lg rounded"
                loading={
                  <div
                    className="bg-zinc-200 rounded animate-pulse"
                    style={{ width: pageWidth || 600, height: Math.round((pageWidth || 600) * 1.414) }}
                  />
                }
              />
            </div>
          )}
        </Document>

        <WatermarkOverlay isEnabled={true} />
      </div>

      {/* Page navigation footer (page mode only) */}
      {viewMode === "page" && (
        <div className="bg-white border-t border-zinc-200 flex-none">
          <div className="max-w-screen-xl mx-auto px-4 h-12 flex items-center justify-between gap-4">
            <button
              onClick={goToPrev}
              disabled={currentPage <= 1}
              className="px-4 py-1.5 bg-zinc-900 text-white text-sm font-medium rounded-lg disabled:opacity-30 hover:bg-zinc-800 transition-colors"
            >
              ← Prev
            </button>

            <form onSubmit={handlePageInputSubmit} className="flex items-center gap-2 text-sm text-zinc-600">
              <span>Page</span>
              <input
                type="number"
                min={1}
                max={numPages}
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onBlur={handlePageInputSubmit as any}
                className="w-14 text-center border border-zinc-300 rounded-lg py-0.5 text-sm font-medium focus:outline-none focus:border-zinc-600"
              />
              <span>of {numPages}</span>
            </form>

            <button
              onClick={goToNext}
              disabled={currentPage >= numPages}
              className="px-4 py-1.5 bg-zinc-900 text-white text-sm font-medium rounded-lg disabled:opacity-30 hover:bg-zinc-800 transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      <style>{`@media print { body { display: none !important; } }`}</style>
    </div>
  );
};

export default PdfRenderer;
