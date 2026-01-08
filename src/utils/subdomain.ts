/**
 * Subdomain Utility for Multi-Tenant Library System
 *
 * Maps subdomains to library slugs for direct access:
 * - theroom19.libere.digital → The Room 19
 * - bandung.libere.digital → Bandung City Digital Library
 * - block71.libere.digital → Block71 Indonesia
 * - app.libere.digital → Main platform (home/books)
 */

export const MAIN_DOMAIN = 'libere.digital';
export const APP_SUBDOMAIN = 'app';

// Subdomain to library slug mapping
export const SUBDOMAIN_MAP: Record<string, string> = {
  'theroom19': 'theroom19',
  'bandung': 'bandung',
  'block71': 'block71',
};

// Library slug to subdomain mapping (reverse)
export const SLUG_TO_SUBDOMAIN: Record<string, string> = {
  'theroom19': 'theroom19',
  'bandung': 'bandung',
  'block71': 'block71',
};

/**
 * Extract subdomain from hostname
 * @param hostname - window.location.hostname
 * @returns subdomain string or null
 */
export const getSubdomain = (hostname: string): string | null => {
  // Remove www. if present
  const host = hostname.replace(/^www\./, '');

  console.log('[getSubdomain] Input hostname:', hostname);
  console.log('[getSubdomain] Cleaned host:', host);

  // Split by dots
  const parts = host.split('.');
  console.log('[getSubdomain] Parts:', parts);

  // If hostname is exactly main domain (libere.digital or www.libere.digital)
  if (host === MAIN_DOMAIN || host === `www.${MAIN_DOMAIN}`) {
    console.log('[getSubdomain] Matched main domain - returning null');
    return null;
  }

  // If app subdomain (app.libere.digital) - treat as main platform
  if (host === `${APP_SUBDOMAIN}.${MAIN_DOMAIN}`) {
    console.log('[getSubdomain] Matched app subdomain - returning null');
    return null;
  }

  // If localhost or IP (for development)
  if (host === 'localhost' || host.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    console.log('[getSubdomain] Matched localhost/IP - returning null');
    return null;
  }

  // If subdomain exists (e.g., theroom19.libere.digital)
  if (parts.length >= 3) {
    console.log('[getSubdomain] Found subdomain:', parts[0]);
    return parts[0];
  }

  console.log('[getSubdomain] No subdomain found - returning null');
  return null;
};

/**
 * Get library slug from current subdomain
 * @param hostname - window.location.hostname
 * @returns library slug or null
 */
export const getLibraryFromSubdomain = (hostname: string): string | null => {
  const subdomain = getSubdomain(hostname);

  if (!subdomain) {
    return null;
  }

  return SUBDOMAIN_MAP[subdomain] || null;
};

/**
 * Check if current hostname is a library subdomain
 * @param hostname - window.location.hostname
 * @returns boolean
 */
export const isLibrarySubdomain = (hostname: string): boolean => {
  const subdomain = getSubdomain(hostname);
  return subdomain !== null && subdomain in SUBDOMAIN_MAP;
};

/**
 * Get canonical URL for a library
 * @param librarySlug - library identifier
 * @returns full URL with subdomain
 */
export const getLibraryCanonicalUrl = (librarySlug: string): string => {
  const subdomain = SLUG_TO_SUBDOMAIN[librarySlug];

  if (!subdomain) {
    return `https://${APP_SUBDOMAIN}.${MAIN_DOMAIN}/libraries/${librarySlug}`;
  }

  return `https://${subdomain}.${MAIN_DOMAIN}`;
};

/**
 * Generate meta tags for library subdomain
 * @param librarySlug - library identifier
 * @param libraryName - library display name
 * @returns meta tag object
 */
export const getLibraryMetaTags = (librarySlug: string, libraryName: string) => {
  const canonicalUrl = getLibraryCanonicalUrl(librarySlug);

  return {
    canonical: canonicalUrl,
    title: `${libraryName} | Libere Digital Library`,
    description: `Access digital books and resources at ${libraryName}. Borrow, read, and explore our collection on Libere.`,
    ogUrl: canonicalUrl,
    ogSiteName: libraryName,
  };
};
