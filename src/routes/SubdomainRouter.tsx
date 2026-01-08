import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getLibraryFromSubdomain, isLibrarySubdomain } from '../utils/subdomain';

/**
 * SubdomainRouter Component
 *
 * Handles automatic routing based on subdomain:
 * - If on library subdomain (e.g., theroom19.libere.digital), redirect to /libraries/:slug
 * - If on main domain (www.libere.digital), normal routing applies
 */
const SubdomainRouter = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const hostname = window.location.hostname;
    const librarySlug = getLibraryFromSubdomain(hostname);

    // If we're on a library subdomain
    if (isLibrarySubdomain(hostname) && librarySlug) {
      // Only redirect if we're not already on the library page
      if (!location.pathname.startsWith(`/libraries/${librarySlug}`)) {
        // Redirect to library detail page
        navigate(`/libraries/${librarySlug}`, { replace: true });
      }
    }

    setIsReady(true);
  }, [location.pathname, navigate]);

  // Show nothing while redirecting (prevents flash of wrong content)
  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
          <p className="text-sm text-zinc-600">Loading library...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default SubdomainRouter;
