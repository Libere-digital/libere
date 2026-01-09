import StandaloneLayout from "../components/layouts/StandaloneLayout";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import config from "../libs/config";
import CivilibBookList from "../components/civilib/CivilibBookList";
import type { Book } from "../core/interfaces/book.interface";
import { contractAddress } from "../smart-contract.abi";
import ImageCarousel from "../components/carousel/ImageCarousel";

const baseUrl = config.env.supabase.baseUrl;

// Theme configuration interface
interface LibraryTheme {
  colors: {
    primary: string;
    accent: string;
    background: string;
    text: string;
    textLight: string;
  };
  hero: {
    enabled: boolean;
    backgroundGradient: string;
  };
  header: {
    logoSize: string;
    logoBorder: string;
    titleSize: string;
    taglineSize: string;
  };
  footer: {
    background: string;
    iconColor: string;
    linkColor: string;
  };
}

// Library themes - Minimalist Monochrome for The Room 19, Default for others
const libraryThemes: Record<string, LibraryTheme> = {
  'theroom19': {
    colors: {
      primary: '#000000',       // Pure black (inspired by theroom19rsvp.site)
      accent: '#FFFFFF',        // Pure white (minimal aesthetic)
      background: '#FFFFFF',    // White background
      text: '#000000',          // Black text
      textLight: '#525252',     // Neutral gray (zinc-600)
    },
    hero: {
      enabled: true,
      backgroundGradient: 'from-black via-zinc-900 to-zinc-800',
    },
    header: {
      logoSize: 'w-24 h-24',
      logoBorder: 'border-2 border-black',
      titleSize: 'text-5xl sm:text-6xl md:text-7xl',
      taglineSize: 'text-base sm:text-lg',
    },
    footer: {
      background: 'bg-black',
      iconColor: 'text-white',
      linkColor: 'text-white hover:text-zinc-300',
    },
  },
  'block71': {
    colors: {
      primary: '#0A4D68',       // Deep Ocean Blue
      accent: '#05BFDB',        // Bright Teal
      background: '#FFFFFF',    // Clean white
      text: '#1A1A1A',          // Almost black for readability
      textLight: '#4A5568',     // Slate gray for secondary text
    },
    hero: {
      enabled: true,
      backgroundGradient: 'from-[#0A4D68] via-[#088395] to-[#05BFDB]',
    },
    header: {
      logoSize: 'w-20 h-20',
      logoBorder: 'border-2 border-teal-400',
      titleSize: 'text-4xl sm:text-5xl md:text-6xl',
      taglineSize: 'text-sm sm:text-base',
    },
    footer: {
      background: 'bg-gradient-to-br from-[#0A4D68] to-[#088395]',
      iconColor: 'text-teal-400',
      linkColor: 'text-teal-300 hover:text-white',
    },
  },
  'default': {
    colors: {
      primary: '#18181B',       // Zinc-900
      accent: '#F59E0B',        // Amber-500
      background: '#FFFFFF',    // White
      text: '#18181B',          // Zinc-900
      textLight: '#52525B',     // Zinc-600
    },
    hero: {
      enabled: false,
      backgroundGradient: '',
    },
    header: {
      logoSize: 'w-16 h-16',
      logoBorder: 'border-2 border-amber-200',
      titleSize: 'text-2xl sm:text-3xl',
      taglineSize: 'text-sm',
    },
    footer: {
      background: 'bg-zinc-50 border-t border-zinc-200',
      iconColor: 'text-amber-600',
      linkColor: 'text-amber-600 hover:text-amber-700',
    },
  },
};

// Library data mapping with slugs
const libraryData = {
  'theroom19': {
    id: 1,
    name: 'The Room 19',
    tagline: 'Independent library at the heart of Bandung',
    logoPath: '/library-logos/room19.png',
    logoFallback: 'T19',
    instagramUrl: 'https://www.instagram.com/the__room19/',
    poolAddress: '0xA31D6d3f2a6C5fBA99E451CCAAaAdf0bca12cbF0',
    address: {
      street: 'Jl. Dipati Ukur No.66C, Lebakgede',
      city: 'Kecamatan Coblong, Kota Bandung',
      postal: 'Jawa Barat 40132',
    },
    mapEmbed: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3960.9037064795!2d107.61526731477396!3d-6.902247995014827!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e68e7b1e9e9e9e9%3A0x1e9e9e9e9e9e9e9!2sJl.%20Dipati%20Ukur%20No.66C%2C%20Lebakgede%2C%20Kecamatan%20Coblong%2C%20Kota%20Bandung%2C%20Jawa%20Barat%2040132!5e0!3m2!1sen!2sid!4v1234567890123!5m2!1sen!2sid',
    mapLink: 'https://maps.app.goo.gl/RhFxAx4YUW7sk3CH6',
  },
  'bandung': {
    id: 2,
    name: 'Bandung City Digital Library',
    tagline: 'Dinas Arsip dan Perpustakaan Kota Bandung',
    logoPath: '/library-logos/bandung.png',
    logoFallback: 'PKB',
    instagramUrl: '',
    poolAddress: '0xa1371f33A4C90a397862c9c05919Aa6B4A3761cD',
    address: {
      street: 'Jl. Kawaluyaan Indah II No.4, Jatisari',
      city: 'Kec. Buahbatu, Kota Bandung',
      postal: 'Jawa Barat',
    },
    mapEmbed: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3960.3726449871615!2d107.63588731477454!3d-6.957745995007234!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e68e9ad1e0f1471%3A0x2a211d4736dab1d3!2sDinas%20Arsip%20dan%20Perpustakaan%20Kota%20Bandung%20(Disarpus)!5e0!3m2!1sen!2sid!4v1734175834567!5m2!1sen!2sid',
    mapLink: 'https://www.google.com/maps/place/Dinas+Arsip+dan+Perpustakaan+Kota+Bandung+(Disarpus)/@-6.9577459,107.6358873,17z/data=!3m1!4b1!4m6!3m5!1s0x2e68e9ad1e0f1471:0x2a211d4736dab1d3!8m2!3d-6.9577512!4d107.6384622!16s%2Fg%2F1hc1l6d_1',
  },
  'block71': {
    id: 3,
    name: 'Block71 Indonesia',
    tagline: 'Global network of entrepreneurial hubs by NUS Enterprise',
    logoPath: '/library-logos/block71.png',
    logoFallback: 'B71',
    instagramUrl: '',
    poolAddress: '0x72A421C93dA185adF33F8fC6bF90FEA850E1AC0b',
    address: {
      street: 'Ariobimo Sentral 8th Floor, RT.9/RW.4',
      city: 'East Kuningan, Setiabudi, Jakarta Selatan',
      postal: 'DKI Jakarta 12950',
    },
    mapEmbed: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3966.2842!2d106.8291!3d-6.2265!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e69f3e6c8c8c8c8%3A0x1e9e9e9e9e9e9e9!2sAriobimo%20Sentral%2C%20Kuningan%2C%20Jakarta!5e0!3m2!1sen!2sid!4v1734567890123!5m2!1sen!2sid',
    mapLink: 'https://jakarta.block71.co/contact',
  },
};

// Block71 Entrepreneurship Insights
interface NewsInsight {
  id: number;
  title: string;
  excerpt: string;
  category: 'Startup' | 'Technology' | 'Investment' | 'Event';
  date: string;
  imageUrl: string;
  externalUrl: string;
  source: string;
}

const block71Insights: NewsInsight[] = [
  {
    id: 1,
    title: "Microsoft & NUS Enterprise to Fast-Track Growth for 150 AI Startups",
    excerpt: "Microsoft Enterprise Singapore and NUS Enterprise partner to accelerate AI startup development, providing resources and mentorship for entrepreneurs in Southeast Asia's growing tech ecosystem.",
    category: 'Technology',
    date: '2025-10-29',
    imageUrl: '/insights/microsoft-nus.jpg',
    externalUrl: 'https://news.microsoft.com/source/asia/2025/10/29/microsoft-enterprise-singapore-and-nus-enterprise-to-fast-track-growth-for-150-ai-startups/',
    source: 'Microsoft News'
  },
  {
    id: 2,
    title: "Kemkomdigi Luncurkan Garuda Spark Innovation Hub di Block71 Bandung",
    excerpt: "Kementerian Komunikasi dan Digital meluncurkan Garuda Spark Innovation Hub di Block71 Bandung, memperkuat ekosistem startup teknologi Indonesia dengan fasilitas inkubasi dan akselerasi.",
    category: 'Startup',
    date: '2024-11-20',
    imageUrl: '/insights/garuda-spark.jpg',
    externalUrl: 'https://www.sinarharapan.co/kesra/38515993219/kemkomdigi-luncurkan-garuda-spark-innovation-hub-di-block71-bandung',
    source: 'Sinar Harapan'
  },
  {
    id: 3,
    title: "Libere Juara Infinity Hackathon 2025: Atasi Pembajakan Buku Lewat Web3",
    excerpt: "Inovasi Libere menggunakan teknologi blockchain Web3 untuk mengatasi pembajakan buku digital, meraih juara di Infinity Hackathon 2025 yang diselenggarakan Kemenparekraf.",
    category: 'Event',
    date: '2025-01-08',
    imageUrl: '/insights/libere-winner.jpg',
    externalUrl: 'https://www.inilah.com/atasi-pembajakan-buku-lewat-web3-inovasi-libere-juara-infinity-hackathon-2025-kemenekraf',
    source: 'Inilah.com'
  },
];

const LibraryDetailScreen = () => {
  const { id } = useParams<{ id: string }>();
  const librarySlug = id || 'theroom19';
  const library = libraryData[librarySlug as keyof typeof libraryData] || libraryData['theroom19'];
  const theme = libraryThemes[librarySlug] || libraryThemes['default'];

  const [books, setBooks] = useState<Book[]>([]);
  const [nftBooks, setNftBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Bandung library images for carousel
  const bandungImages = [
    '/library-photos/bandung-interior-1.webp',
    '/library-photos/bandung-interior-2.jpg',
    '/library-photos/bandung-registration.jpg'
  ];

  // Fetch all books from database
  useEffect(() => {
    const fetchBooks = async () => {
      try {
        setLoading(true);

        const res = await fetch(`${baseUrl}/rest/v1/Book`, {
          headers: {
            apiKey: config.env.supabase.apiKey,
          },
        });
        const data = await res.json();

        setBooks(data);
        setLoading(false);
      } catch (err) {
        console.error("Failed to get Books Data", err);
        setLoading(false);
      }
    };
    fetchBooks();
  }, []);

  // Fetch library NFTs from Blockscout and filter books
  useEffect(() => {
    const fetchLibraryNFTs = async () => {
      try {
        setLoading(true);

        // Fetch NFTs from main contract owned by library pool address
        const res = await fetch(
          `https://base-sepolia.blockscout.com/api/v2/tokens/${contractAddress}/instances?holder_address_hash=${library.poolAddress}`
        );
        const data = await res.json();

        console.log('Blockscout API Response:', data); // Debug log

        // Extract NFT token IDs
        const ids: string[] = data.items?.map((i: any) => i.id) || [];

        console.log('NFT IDs found in library pool:', ids); // Debug log

        // Filter books that exist in library
        const filteredBooks = books.filter((book) =>
          ids.includes(String(book.id))
        );

        console.log('Filtered books:', filteredBooks); // Debug log

        setNftBooks(filteredBooks);
        setLoading(false);
      } catch (err) {
        console.error("Failed to get Library NFT Data", err);
        setLoading(false);
      }
    };

    if (books.length > 0) {
      fetchLibraryNFTs();
    }
  }, [books, library.poolAddress]);

  return (
    <StandaloneLayout
      librarySlug={librarySlug}
      libraryLogo={library.logoPath}
      libraryName={library.name}
      libraryTagline={library.tagline}
      showScrollNav={librarySlug === 'theroom19'}
    >
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: theme.colors.background }}>
        {/* Conditional Hero Section - The Room 19 & Block71 */}
        {theme.hero.enabled && (
          <div id="home" className={`scroll-mt-16 relative h-[50vh] md:h-[60vh] w-full overflow-hidden bg-gradient-to-br ${theme.hero.backgroundGradient}`}>
            {/* Block71 - Blurred jumbotron image background */}
            {librarySlug === 'block71' && (
              <div className="absolute inset-0">
                <img
                  src="/library-photos/block71-hero.jpg"
                  alt="Block71 Indonesia"
                  className="w-full h-full object-cover blur-md scale-110"
                />
                {/* Dark overlay for better text readability */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#0A4D68]/80 via-[#088395]/70 to-[#05BFDB]/80" />
              </div>
            )}

            {/* The Room 19 - SVG texture */}
            {librarySlug === 'theroom19' && (
              <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC40Ij48cGF0aCBkPSJNMzYgMzRjMC0yLjIxLTEuNzktNC00LTRzLTQgMS43OS00IDQgMS43OSA0IDQgNCA0LTEuNzkgNC00em0wLTEwYzAtMi4yMS0xLjc5LTQtNC00cy00IDEuNzktNCA0IDEuNzkgNCA0IDQgNC0xLjc5IDQtNHptMC0xMGMwLTIuMjEtMS43OS00LTQtNHMtNCAxLjc5LTQgNGMwIDIuMjEgMS43OSA0IDQgNHM0LTEuNzkgNC00eiIvPjwvZz48L2c+PC9zdmc+')]" />
            )}

            {/* Content overlay */}
            <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-4">
              <h1 className={`${theme.header.titleSize} font-black text-white tracking-tight mb-4`}>
                {library.name.toUpperCase()}
              </h1>
              <p className={`${theme.header.taglineSize} text-zinc-300 font-light mb-6`}>
                {library.tagline}
              </p>
              {library.instagramUrl && (
                <a
                  href={library.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-white hover:text-zinc-300 text-base font-normal transition-colors"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                  <span>@the__room19</span>
                </a>
              )}
            </div>
          </div>
        )}

        {/* Gallery Section - Bandung only */}
        {librarySlug === 'bandung' && (
          <div id="gallery" className="w-full flex items-center justify-center pt-6 pb-8">
            <div className="w-full max-w-5xl px-4 sm:px-6">
              {/* Carousel - Full Width */}
              <ImageCarousel
                images={bandungImages}
                interval={5000}
                alt="Bandung City Digital Library"
              />
            </div>
          </div>
        )}

        {/* Books Section */}
        <div id="books" className="scroll-mt-16 w-full h-fit flex items-start justify-center py-16">
          <section className="w-full max-w-screen-xl px-4 sm:px-6">
            {/* Section Header */}
            <div className="mb-8">
              <h2 className="text-3xl md:text-4xl font-black text-black mb-2">
                Digital Books Collection
              </h2>
              <p className="text-zinc-600">
                Explore our curated collection of digital literature
              </p>
            </div>
            {nftBooks.length === 0 && !loading ? (
              <div className="bg-white rounded-xl border-2 border-dashed border-zinc-300 p-12 text-center">
                <div className="text-zinc-400 text-5xl mb-4">📚</div>
                <h3 className="text-xl font-semibold text-zinc-900 mb-2">
                  Collection Coming Soon
                </h3>
                <p className="text-zinc-600">
                  New titles will appear here once they are added to the library.
                </p>
              </div>
            ) : (
              <CivilibBookList
                books={nftBooks}
                isLoading={loading}
                libraryAddress={library.poolAddress}
                useMonochromeColors={librarySlug === 'theroom19'}
                useBlock71Colors={librarySlug === 'block71'}
              />
            )}
          </section>
        </div>

        {/* Entrepreneurship Insights - Block71 only */}
        {librarySlug === 'block71' && (
          <div id="insights" className="scroll-mt-16 w-full flex items-center justify-center py-16 bg-gradient-to-br from-teal-50 to-blue-50">
            <div className="max-w-screen-xl w-full px-4 sm:px-6">
              {/* Section Header */}
              <div className="mb-12 text-center">
                <h2 className="text-3xl md:text-4xl font-black text-zinc-900 mb-2">
                  Latest from the Ecosystem
                </h2>
                <p className="text-zinc-600">
                  News, insights, and updates from the entrepreneurship community
                </p>
              </div>

              {/* Insights Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {block71Insights.map((insight) => (
                  <div
                    key={insight.id}
                    className="bg-white rounded-xl border-2 border-teal-100 hover:border-teal-400 hover:shadow-xl transition-all overflow-hidden"
                  >
                    {/* Image */}
                    <div className="relative h-48 bg-gradient-to-br from-teal-50 to-blue-50">
                      <img
                        src={insight.imageUrl}
                        alt={insight.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      <span className="absolute top-3 right-3 px-3 py-1 bg-teal-500 text-white text-xs font-bold rounded-full">
                        {insight.category}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="p-5">
                      <p className="text-xs text-slate-500 mb-2">
                        {new Date(insight.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })} • {insight.source}
                      </p>
                      <h3 className="text-lg font-bold text-zinc-900 mb-2 line-clamp-2">
                        {insight.title}
                      </h3>
                      <p className="text-sm text-zinc-600 mb-4 line-clamp-3">
                        {insight.excerpt}
                      </p>
                      <a
                        href={insight.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-teal-600 hover:text-teal-700 font-semibold text-sm transition-colors"
                      >
                        <span>Read More</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  </div>
                ))}
              </div>

              {/* CTA to Website */}
              <div className="mt-10 text-center">
                <a
                  href="https://jakarta.block71.co"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-teal-500 text-white hover:bg-teal-600 rounded-lg font-bold text-base transition-colors shadow-lg"
                >
                  <span>Visit Block71 Jakarta</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Reservation Section - The Room 19 only */}
        {librarySlug === 'theroom19' && (
          <div id="reservation" className="scroll-mt-16 w-full flex items-center justify-center py-16 bg-zinc-50">
            <div className="max-w-screen-xl w-full px-4 sm:px-6">
              {/* Section Header */}
              <div className="mb-12 text-center">
                <h2 className="text-3xl md:text-4xl font-black text-black mb-2">
                  Visit Our Space
                </h2>
                <p className="text-zinc-600">
                  Experience our cozy reading environment in person
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                {/* Image */}
                <div className="w-full h-80 md:h-96 rounded-lg overflow-hidden shadow-lg">
                  <img
                    src="/library-photos/theroom19-interior.jpg"
                    alt="The Room 19 Interior"
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Content */}
                <div className="flex flex-col justify-center">
                  <p className="text-zinc-600 mb-4 leading-relaxed text-lg">
                    The Room 19 offers a warm, welcoming space where you can immerse yourself in books, meet fellow readers, and enjoy the ambiance of our independent library.
                  </p>
                  <p className="text-zinc-600 mb-8 leading-relaxed text-lg">
                    Located in the heart of Bandung, we invite you to explore our collection, attend events, or simply find a quiet corner to read.
                  </p>
                  <a
                    href="https://www.theroom19rsvp.site/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white hover:bg-zinc-800 rounded-lg font-bold text-base transition-colors shadow-lg w-fit"
                  >
                    <span>Reserve Your Visit</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer with Map and Address - Themed */}
        <div id="address" className={`scroll-mt-16 w-full flex items-center justify-center mt-auto py-16 ${theme.footer.background}`}>
          <div className="max-w-screen-xl w-full px-4 sm:px-6">
            {/* Section Header */}
            <div className="mb-12 text-center">
              <h2 className={`text-3xl md:text-4xl font-black mb-2 ${(theme.hero.enabled || librarySlug === 'block71') ? 'text-white' : 'text-black'}`}>
                Location & Address
              </h2>
              <p className={`${(theme.hero.enabled || librarySlug === 'block71') ? (librarySlug === 'block71' ? 'text-teal-100' : 'text-zinc-300') : 'text-zinc-600'}`}>
                {librarySlug === 'block71' ? 'Find us in the heart of Jakarta' : 'Find us in the heart of Bandung'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Map */}
              <div className="w-full h-64 rounded-lg overflow-hidden shadow-md">
                <iframe
                  src={library.mapEmbed}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title={`${library.name} Location`}
                />
              </div>

              {/* Address Info */}
              <div className="flex flex-col justify-center">
                <h3 className={`text-xl font-bold mb-4 ${librarySlug === 'theroom19' || librarySlug === 'block71' ? 'text-white' : 'text-zinc-900'}`}>
                  Visit Us
                </h3>
                <div className="flex items-start gap-3 mb-4">
                  <svg
                    className={`w-5 h-5 ${theme.footer.iconColor} mt-1 flex-shrink-0`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <div>
                    <p className={`font-medium ${librarySlug === 'theroom19' || librarySlug === 'block71' ? 'text-white' : 'text-zinc-900'}`}>
                      {library.address.street}
                    </p>
                    <p className={`text-sm ${librarySlug === 'theroom19' || librarySlug === 'block71' ? (librarySlug === 'block71' ? 'text-teal-100' : 'text-zinc-300') : 'text-zinc-600'}`}>
                      {library.address.city}
                    </p>
                    <p className={`text-sm ${librarySlug === 'theroom19' || librarySlug === 'block71' ? (librarySlug === 'block71' ? 'text-teal-100' : 'text-zinc-300') : 'text-zinc-600'}`}>
                      {library.address.postal}
                    </p>
                  </div>
                </div>
                <a
                  href={library.mapLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-2 ${theme.footer.linkColor} font-medium text-sm w-fit`}
                >
                  <span>Open in Google Maps</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </StandaloneLayout>
  );
};

export default LibraryDetailScreen;
