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

    console.log('🌐 [SubdomainRouter] Hostname:', hostname);
    console.log('   Library slug:', librarySlug || 'none (main platform)');
    console.log('   Current path:', location.pathname);
    console.log('   Is library subdomain?', isLibrarySubdomain(hostname));

    // If we're on a library subdomain (theroom19, bandung, block71)
    if (isLibrarySubdomain(hostname) && librarySlug) {
      console.log('✅ [SubdomainRouter] On library subdomain:', librarySlug);

      // Allow reading/listening routes without redirect
      const allowedPaths = [
        `/libraries/${librarySlug}`,
        '/read-book/',
        '/listen-audiobook/'
      ];

      const isAllowedPath = allowedPaths.some(path => location.pathname.startsWith(path));

      if (!isAllowedPath) {
        console.log('🔀 [SubdomainRouter] Redirecting to /libraries/' + librarySlug);
        // Redirect to library detail page
        navigate(`/libraries/${librarySlug}`, { replace: true });
      } else {
        console.log('✅ [SubdomainRouter] On allowed path:', location.pathname);
      }
    } else {
      console.log('✅ [SubdomainRouter] Main platform - no redirect');
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
