import { useEffect, useState } from "react";

interface DonationSplashScreenProps {
  bookTitle: string;
  bookCover: string;
  donatedBy?: string;
  donatedAt?: string;
  onFinish: () => void;
  duration?: number; // Duration in milliseconds (default 3000ms = 3 seconds)
}

const DonationSplashScreen = ({
  bookTitle,
  bookCover,
  donatedBy,
  donatedAt,
  onFinish,
  duration = 3000,
}: DonationSplashScreenProps) => {
  const [isVisible, setIsVisible] = useState(true);
  const [progress, setProgress] = useState(0);

  // Format donation date
  const formatDonationDate = (dateString?: string) => {
    if (!dateString) return null;

    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(date);
    } catch (e) {
      return dateString;
    }
  };

  // Auto-close after duration
  useEffect(() => {
    // Progress bar animation
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + (100 / (duration / 50)); // Update every 50ms
      });
    }, 50);

    // Close splash screen
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        onFinish();
      }, 300); // Wait for fade-out animation
    }, duration);

    return () => {
      clearTimeout(timer);
      clearInterval(progressInterval);
    };
  }, [duration, onFinish]);

  if (!isVisible) {
    return null;
  }

  const formattedDate = formatDonationDate(donatedAt);

  return (
    <div
      className={`fixed inset-0 z-50 bg-gradient-to-br from-amber-50 via-white to-amber-50 flex items-center justify-center transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Decorative background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 left-0 w-96 h-96 bg-amber-500 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-amber-400 rounded-full blur-3xl"></div>
      </div>

      {/* Main content */}
      <div className="relative max-w-2xl w-full px-8 py-12 animate-fade-in">
        {/* Book mockup */}
        <div className="flex flex-col items-center mb-8">
          {/* Book cover with 3D effect */}
          <div className="relative mb-6 transform perspective-1000">
            <div className="w-48 h-64 rounded-lg overflow-hidden shadow-2xl border-4 border-white transform hover:scale-105 transition-transform duration-300">
              <img
                src={bookCover}
                alt={bookTitle}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = '/placeholder-book.png';
                }}
              />
            </div>
            {/* Book spine shadow */}
            <div className="absolute -right-2 top-2 w-48 h-64 bg-zinc-800 opacity-20 rounded-lg blur-md -z-10"></div>
          </div>

          {/* Book title */}
          <h1 className="text-3xl font-bold text-zinc-900 text-center mb-2 max-w-lg">
            {bookTitle}
          </h1>
        </div>

        {/* Donation info card */}
        {donatedBy && (
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-amber-100 mb-6">
            {/* Donation icon */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center shadow-lg">
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </div>
            </div>

            {/* Donation message */}
            <div className="text-center">
              <p className="text-lg text-zinc-700 mb-2">
                This book was donated by
              </p>
              <p className="text-2xl font-bold text-amber-600 mb-3">
                {donatedBy}
              </p>

              {/* Company Logo (if PT Everidea) */}
              {donatedBy?.includes('Everidea') && (
                <div className="flex justify-center my-4">
                  <img
                    src="/donation-logos/everidea.png"
                    alt="Everidea Logo"
                    className="h-16 object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}

              {formattedDate && (
                <p className="text-sm text-zinc-500">
                  on {formattedDate}
                </p>
              )}
            </div>

            {/* Decorative divider */}
            <div className="flex items-center justify-center my-6">
              <div className="h-px bg-gradient-to-r from-transparent via-amber-300 to-transparent w-full max-w-xs"></div>
            </div>

            {/* Thank you message */}
            <p className="text-center text-sm text-zinc-600 italic">
              Thank you for your contribution to Indonesian literacy
            </p>
          </div>
        )}

        {/* Progress bar */}
        <div className="w-full bg-zinc-200 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-gradient-to-r from-amber-400 to-amber-600 h-full rounded-full transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          ></div>
        </div>

        {/* Skip button */}
        <div className="flex justify-center mt-6">
          <button
            onClick={() => {
              setIsVisible(false);
              setTimeout(onFinish, 100);
            }}
            className="text-sm text-zinc-500 hover:text-zinc-700 underline transition-colors"
          >
            Skip
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }

        .perspective-1000 {
          perspective: 1000px;
        }
      `}</style>
    </div>
  );
};

export default DonationSplashScreen;
