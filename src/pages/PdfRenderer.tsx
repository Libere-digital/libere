import { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import WatermarkOverlay from '../components/reader/WatermarkOverlay';
import { useNavigate } from 'react-router-dom';

// Configure PDF.js worker from CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

console.log('📦 [PdfRenderer] PDF.js version:', pdfjsLib.version);

interface PdfRendererProps {
  pdfData: ArrayBuffer | Blob;
  bookId: string;
  bookTitle: string;
  hasBorrowed: boolean;
  borrowExpiry: number | null;
}

const PdfRenderer = ({
  pdfData,
  bookId,
  bookTitle,
  hasBorrowed,
  borrowExpiry,
}: PdfRendererProps) => {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [progress, setProgress] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [rendering, setRendering] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'scroll' | 'page'>('scroll'); // Default to scroll mode

  // Log when component mounts
  useEffect(() => {
    console.log('🎨 [PdfRenderer] Component mounted');
    console.log('   Book ID:', bookId);
    console.log('   Book Title:', bookTitle);

    if (pdfData instanceof ArrayBuffer) {
      console.log('   PDF Data type: ArrayBuffer');
      console.log('   PDF Data size:', (pdfData.byteLength / 1024 / 1024).toFixed(2), 'MB');
    } else if (pdfData instanceof Blob) {
      console.log('   PDF Data type: Blob');
      console.log('   PDF Data size:', (pdfData.size / 1024 / 1024).toFixed(2), 'MB');
    }

    console.log('   PDF.js worker:', pdfjsLib.GlobalWorkerOptions.workerSrc);
    console.log('🔄 [PdfRenderer] Loading PDF document...');
  }, []);

  // Load PDF document using PDF.js
  useEffect(() => {
    const loadPdf = async () => {
      try {
        console.log('📥 [PdfRenderer] Starting PDF.js getDocument...');

        // Convert Blob to ArrayBuffer if needed
        let pdfArrayBuffer: ArrayBuffer;
        if (pdfData instanceof Blob) {
          console.log('   Converting Blob to ArrayBuffer...');
          pdfArrayBuffer = await pdfData.arrayBuffer();
        } else {
          pdfArrayBuffer = pdfData;
        }

        // Clone ArrayBuffer to prevent detached error
        console.log('   Cloning ArrayBuffer to prevent detached error...');
        const clonedBuffer = pdfArrayBuffer.slice(0);
        console.log('   Cloned buffer size:', (clonedBuffer.byteLength / 1024 / 1024).toFixed(2), 'MB');

        // Load PDF document with cloned buffer
        const loadingTask = pdfjsLib.getDocument({ data: clonedBuffer });
        const pdf = await loadingTask.promise;

        console.log(`✅ [PdfRenderer] PDF loaded successfully!`);
        console.log(`   Total pages: ${pdf.numPages}`);

        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        setLoading(false);

        // Load saved page
        const savedPage = localStorage.getItem(`pdf-page-${bookId}`);
        if (savedPage) {
          const pageNum = parseInt(savedPage, 10);
          if (pageNum > 0 && pageNum <= pdf.numPages) {
            setCurrentPage(pageNum);
          }
        }
      } catch (err: any) {
        console.error('❌ [PdfRenderer] PDF load error:', err);
        setError(`Failed to load PDF: ${err.message}`);
        setLoading(false);
      }
    };

    loadPdf();
  }, [pdfData, bookId]);

  // Auto-fit PDF to screen width
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    const calculateFitToWidthScale = async () => {
      try {
        const page = await pdfDoc.getPage(1);
        const viewport = page.getViewport({ scale: 1.0 });

        // Get container width
        const container = canvasRef.current?.parentElement;
        if (!container) return;

        const containerWidth = container.clientWidth - 32; // Minus padding
        const pdfWidth = viewport.width;

        // Calculate scale to fit width
        const fitScale = containerWidth / pdfWidth;

        // Clamp between 0.5x and 2.0x for readability
        const initialScale = Math.max(0.5, Math.min(fitScale, 2.0));

        console.log('📐 [PdfRenderer] Auto-fit calculation:');
        console.log('   Container width:', containerWidth);
        console.log('   PDF width:', pdfWidth);
        console.log('   Calculated scale:', fitScale.toFixed(2));
        console.log('   Clamped scale:', initialScale.toFixed(2));

        setScale(initialScale);
      } catch (err) {
        console.error('❌ [PdfRenderer] Auto-fit calculation error:', err);
        // Fallback to 1.0x if calculation fails
        setScale(1.0);
      }
    };

    calculateFitToWidthScale();
  }, [pdfDoc]);

  // Render page(s) based on view mode
  useEffect(() => {
    const renderPages = async () => {
      if (!pdfDoc || rendering) return;

      try {
        setRendering(true);

        if (viewMode === 'scroll') {
          // Scroll mode: Render all pages
          console.log(`📄 [PdfRenderer] Rendering all ${numPages} pages in scroll mode...`);
          const container = scrollContainerRef.current;
          if (!container) return;

          // Clear container
          container.innerHTML = '';

          // Render each page
          for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            const page = await pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale });

            const canvas = document.createElement('canvas');
            canvas.className = 'shadow-lg mb-4 mx-auto';
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            canvas.style.maxWidth = '100%';
            canvas.style.height = 'auto';

            const context = canvas.getContext('2d');
            if (!context) continue;

            await page.render({ canvasContext: context, viewport }).promise;
            container.appendChild(canvas);
          }

          console.log(`✅ [PdfRenderer] All pages rendered in scroll mode`);
        } else {
          // Page mode: Render single page
          if (!canvasRef.current) return;

          console.log(`📄 [PdfRenderer] Rendering page ${currentPage}...`);

          const page = await pdfDoc.getPage(currentPage);
          const canvas = canvasRef.current;
          const context = canvas.getContext('2d');

          if (!context) {
            throw new Error('Cannot get canvas context');
          }

          const viewport = page.getViewport({ scale });
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          await page.render({ canvasContext: context, viewport }).promise;
          console.log(`✅ [PdfRenderer] Page ${currentPage} rendered (scale: ${scale}x)`);
        }

        setRendering(false);
      } catch (err: any) {
        console.error(`❌ [PdfRenderer] Page render error:`, err);
        setRendering(false);
      }
    };

    renderPages();
  }, [pdfDoc, currentPage, scale, viewMode, numPages, rendering]);

  // Calculate and save progress
  useEffect(() => {
    if (numPages > 0) {
      const progressPercent = Math.round((currentPage / numPages) * 100);
      setProgress(progressPercent);

      // Use same key as EPUB reader for consistency (book-progress instead of pdf-progress)
      localStorage.setItem(`book-progress-${bookId}`, progressPercent.toString());
      localStorage.setItem(`pdf-page-${bookId}`, currentPage.toString());

      console.log(`💾 [PdfRenderer] Progress saved: ${progressPercent}% (page ${currentPage}/${numPages})`);

      // Dispatch progress update event (for same-window updates)
      window.dispatchEvent(new CustomEvent('progressUpdate', {
        detail: { bookId, progress: progressPercent }
      }));
    }
  }, [currentPage, numPages, bookId]);

  // Navigation functions (defined before event handlers)
  const goToPreviousPage = useCallback(() => {
    if (currentPage > 1) {
      const newPage = currentPage - 1;
      console.log(`📄 [PdfRenderer] Navigating to page ${newPage}`);
      setCurrentPage(newPage);
    }
  }, [currentPage]);

  const goToNextPage = useCallback(() => {
    if (currentPage < numPages) {
      const newPage = currentPage + 1;
      console.log(`📄 [PdfRenderer] Navigating to page ${newPage}`);
      setCurrentPage(newPage);
    }
  }, [currentPage, numPages]);

  // Disable printing
  useEffect(() => {
    const handleBeforePrint = (e: Event) => {
      e.preventDefault();
      alert('🚫 Printing is disabled for copyright protection');
      return false;
    };

    window.addEventListener('beforeprint', handleBeforePrint);

    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
    };
  }, []);

  // Keyboard navigation (Arrow keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPreviousPage();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToNextPage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [goToPreviousPage, goToNextPage]);

  // Touch swipe navigation (only in page mode)
  useEffect(() => {
    if (viewMode !== 'page') return;

    const container = canvasRef.current?.parentElement;
    if (!container) return;

    let touchStartX = 0;
    let touchEndX = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.changedTouches[0].screenX;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
    };

    const handleSwipe = () => {
      const swipeThreshold = 50; // Minimum swipe distance in pixels
      const diff = touchStartX - touchEndX;

      if (Math.abs(diff) > swipeThreshold) {
        if (diff > 0) {
          // Swiped left - go to next page
          console.log('👈 [PdfRenderer] Swipe left detected - next page');
          goToNextPage();
        } else {
          // Swiped right - go to previous page
          console.log('👉 [PdfRenderer] Swipe right detected - previous page');
          goToPreviousPage();
        }
      }
    };

    container.addEventListener('touchstart', handleTouchStart);
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [goToPreviousPage, goToNextPage, viewMode]);

  const handleZoomIn = () => {
    setScale((prev) => {
      const newScale = Math.min(prev + 0.2, 3.0);
      console.log(`🔍 [PdfRenderer] Zoom in: ${newScale.toFixed(1)}x`);
      return newScale;
    });
  };

  const handleZoomOut = () => {
    setScale((prev) => {
      const newScale = Math.max(prev - 0.2, 0.5);
      console.log(`🔍 [PdfRenderer] Zoom out: ${newScale.toFixed(1)}x`);
      return newScale;
    });
  };

  const handleBack = () => {
    navigate(-1);
  };

  // Format borrow expiry time
  const formatTimeRemaining = (expiryTimestamp: number): string => {
    const now = Math.floor(Date.now() / 1000);
    const timeLeft = expiryTimestamp - now;

    if (timeLeft <= 0) return 'Expired';

    if (timeLeft > 86400) {
      const days = Math.floor(timeLeft / 86400);
      const hours = Math.floor((timeLeft % 86400) / 3600);
      return `${days}d ${hours}h left`;
    } else if (timeLeft > 3600) {
      const hours = Math.floor(timeLeft / 3600);
      const minutes = Math.floor((timeLeft % 3600) / 60);
      return `${hours}h ${minutes}m left`;
    } else {
      const minutes = Math.floor(timeLeft / 60);
      return `${minutes}m left`;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-zinc-50">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200 px-4 py-3">
        <div className="flex items-center justify-between max-w-screen-xl mx-auto">
          {/* Back button */}
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-zinc-700 hover:text-zinc-900"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-medium">Back</span>
          </button>

          {/* Title and progress */}
          <div className="flex-1 mx-4">
            <h1 className="text-sm font-semibold text-zinc-900 truncate">{bookTitle}</h1>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 bg-zinc-200 rounded-full h-1.5 max-w-xs">
                <div
                  className="bg-amber-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs text-zinc-600">{progress}%</span>
            </div>
          </div>

          {/* Borrow status */}
          {hasBorrowed && borrowExpiry && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
              <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs font-medium text-amber-700">
                {formatTimeRemaining(borrowExpiry)}
              </span>
            </div>
          )}

          {/* View mode toggle */}
          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={() => setViewMode('scroll')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                viewMode === 'scroll'
                  ? 'bg-amber-500 text-white'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              }`}
              title="Scroll mode"
            >
              Scroll
            </button>
            <button
              onClick={() => setViewMode('page')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                viewMode === 'page'
                  ? 'bg-amber-500 text-white'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              }`}
              title="Page mode"
            >
              Page
            </button>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={handleZoomOut}
              disabled={scale <= 0.5}
              className="p-2 text-zinc-700 hover:bg-zinc-100 rounded-lg disabled:opacity-50"
              title="Zoom out"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
              </svg>
            </button>
            <span className="text-xs text-zinc-600 px-2">{Math.round(scale * 100)}%</span>
            <button
              onClick={handleZoomIn}
              disabled={scale >= 3.0}
              className="p-2 text-zinc-700 hover:bg-zinc-100 rounded-lg disabled:opacity-50"
              title="Zoom in"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* PDF Viewer with Watermark Overlay */}
      <div className="flex-1 bg-white relative overflow-auto">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
              <p className="mt-4 text-zinc-600">Loading PDF...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-red-600 px-4">
              <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-lg font-semibold mb-2">Failed to Load PDF</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && pdfDoc && (
          <>
            {viewMode === 'scroll' ? (
              <div
                ref={scrollContainerRef}
                className="py-4 pdf-viewer-container"
              />
            ) : (
              <div className="flex justify-center py-4 pdf-viewer-container">
                <canvas
                  ref={canvasRef}
                  className="shadow-lg"
                  style={{ maxWidth: '100%', height: 'auto' }}
                />
              </div>
            )}
          </>
        )}

        {/* Watermark Overlay (same component as EPUB) */}
        <WatermarkOverlay isEnabled={true} />
      </div>

      {/* Navigation Controls - Only show in page mode */}
      {viewMode === 'page' && (
        <div className="bg-white border-t border-zinc-200 py-3 px-6">
          <div className="flex items-center justify-between max-w-screen-xl mx-auto">
            <button
              onClick={goToPreviousPage}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-zinc-900 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium hover:bg-zinc-800 transition-colors"
            >
              ← Previous
            </button>

            <span className="text-sm text-zinc-700 font-medium">
              Page {currentPage} of {numPages}
            </span>

            <button
              onClick={goToNextPage}
              disabled={currentPage === numPages}
              className="px-4 py-2 bg-zinc-900 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium hover:bg-zinc-800 transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* CSS for print blocking */}
      <style>{`
        @media print {
          .pdf-viewer-container {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default PdfRenderer;
