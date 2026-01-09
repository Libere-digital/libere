import HomeLayout from '../components/layouts/HomeLayout';
import { getLibraryCanonicalUrl } from '../utils/subdomain';

const LibraryListScreen = () => {
  // Hardcoded library data - simple and direct
  const libraries = [
    {
      id: 1,
      slug: 'theroom19',
      name: 'The Room 19',
      address: '0xA31D6d3f2a6C5fBA99E451CCAAaAdf0bca12cbF0',
      description: 'Bandung Public Library serves the creative community of Bandung with a curated selection of digital books.',
      logoPath: '/library-logos/room19.png',
      logoFallback: 'T19',
      location: 'Bandung, Indonesia',
      stats: {
        books: 98,
        members: 843,
        copies: 267
      }
    },
    {
      id: 2,
      slug: 'bandung',
      name: 'Bandung City Digital Library',
      address: '0xa1371f33A4C90a397862c9c05919Aa6B4A3761cD',
      description: 'Dinas Arsip dan Perpustakaan Kota Bandung menyediakan koleksi buku digital untuk masyarakat Bandung',
      logoPath: '/library-logos/bandung.png',
      logoFallback: 'PKB',
      location: 'Jl. Kawaluyaan Indah II No.4, Jatisari, Kec. Buahbatu, Kota Bandung',
      stats: {
        books: 98,
        members: 843,
        copies: 267
      }
    },
    {
      id: 3,
      slug: 'block71',
      name: 'Block71 Indonesia',
      address: '0x72A421C93dA185adF33F8fC6bF90FEA850E1AC0b',
      description: 'Global network of entrepreneurial hubs by NUS Enterprise, fostering innovation and connecting tech startups across Jakarta, Bandung, Singapore, and beyond.',
      logoPath: '/library-logos/block71.png',
      logoFallback: 'B71',
      location: 'Kuningan, Jakarta Selatan',
      stats: {
        books: 98,
        members: 843,
        copies: 267
      }
    }
  ];

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

  return (
    <HomeLayout>
      <div className="min-h-screen">
        {/* Header Section */}
        <div className="w-full flex flex-col items-center justify-center mt-12 mb-8">
          <div className="max-w-screen-xl w-full px-4 sm:px-6">
            <div className="inline-flex">
              <span className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-full text-xs font-medium border border-amber-200">
                Partner Libraries
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mt-4 leading-tight">
              <span className="text-zinc-900">Discover </span>
              <span className="bg-gradient-to-r from-amber-500 to-yellow-500 bg-clip-text text-transparent">
                Libraries
              </span>
            </h1>

            <p className="text-base text-zinc-600 mt-3 max-w-2xl">
              Explore decentralized libraries and borrow books powered by blockchain.
            </p>
          </div>
        </div>

        {/* Library Cards Grid */}
        <div className="w-full flex items-start justify-center pb-8">
          <div className="max-w-screen-xl w-full px-4 sm:px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {libraries.map((library) => (
                <div key={library.id} className="w-full">
                  {/* Library Card */}
                  <div className="bg-white rounded-2xl border border-zinc-200 shadow-md hover:shadow-xl transition-all duration-300">
                {/* Header with extra padding top for logo */}
                <div className={`relative h-40 ${
                  library.slug === 'block71'
                    ? 'bg-gradient-to-br from-[#0A4D68] to-[#05BFDB]'
                    : library.slug === 'theroom19'
                      ? 'bg-gradient-to-br from-zinc-900 to-zinc-700'
                      : 'bg-gradient-to-br from-amber-100 to-yellow-100'
                }`}>
                  <div
                    className="absolute inset-0 bg-cover bg-center opacity-40"
                    style={{
                      backgroundImage: `url('https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=800&h=400&fit=crop')`,
                    }}
                  />

                  {/* Logo positioned at bottom of header */}
                  <div className="absolute -bottom-10 left-6">
                    <div className="w-20 h-20 rounded-full bg-white border-4 border-white shadow-lg flex items-center justify-center overflow-hidden">
                      <img
                        src={library.logoPath}
                        alt={`${library.name} Logo`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Fallback to styled text if image not found
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.parentElement!.innerHTML = `<div class="w-full h-full bg-[#C4C961] flex items-center justify-center"><span class="text-white text-xs font-bold">${library.logoFallback}</span></div>`;
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Content with padding-top for logo */}
                <div className="pt-12 px-5 pb-5">
                  {/* Library Name */}
                  <h2 className="text-xl font-bold text-zinc-900 mb-1.5">
                    {library.name}
                  </h2>

                  {/* Location */}
                  <div className="flex items-center gap-1.5 text-zinc-600 mb-3">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-xs">{library.location}</span>
                  </div>

                  {/* Description */}
                  <p className="text-zinc-600 text-xs leading-relaxed mb-4">
                    {library.description}
                  </p>

                  {/* Stats */}
                  <div className="flex items-center justify-around py-2.5 mb-3 bg-amber-50 rounded-lg border border-amber-100">
                    <div className="flex flex-col items-center">
                      <div className="text-xl font-bold text-zinc-900">
                        {library.stats.books}
                      </div>
                      <div className="text-[10px] text-zinc-600">Books</div>
                    </div>
                    <div className="w-px h-6 bg-zinc-200" />
                    <div className="flex flex-col items-center">
                      <div className="text-xl font-bold text-zinc-900">
                        {library.stats.members}
                      </div>
                      <div className="text-[10px] text-zinc-600">Members</div>
                    </div>
                    <div className="w-px h-6 bg-zinc-200" />
                    <div className="flex flex-col items-center">
                      <div className="text-xl font-bold text-zinc-900">
                        {library.stats.copies}
                      </div>
                      <div className="text-[10px] text-zinc-600">Copies</div>
                    </div>
                  </div>

                  {/* Contract Address */}
                  <div className="mb-3 pb-3 border-b border-zinc-200">
                    <div className="text-xs text-zinc-400 mb-1">Contract Address</div>
                    <div className="font-mono text-xs text-zinc-600 flex items-center justify-between">
                      <span>{truncateAddress(library.address)}</span>
                      <button
                        onClick={() => navigator.clipboard.writeText(library.address)}
                        className="text-amber-600 hover:text-amber-700 ml-2"
                        title="Copy address"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Action Button */}
                  <a
                    href={getLibraryCanonicalUrl(library.slug)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors shadow-md hover:shadow-lg"
                  >
                    <span>Visit Library</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </HomeLayout>
  );
};

export default LibraryListScreen;
