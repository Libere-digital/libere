import HomeLayout from "../components/layouts/HomeLayout";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import config from "../libs/config";
import CivilibBookList from "../components/civilib/CivilibBookList";
import type { Book } from "../core/interfaces/book.interface";

const baseUrl = config.env.supabase.baseUrl;
const libraryPoolAddress = '0xA31D6d3f2a6C5fBA99E451CCAAaAdf0bca12cbF0';

// Library data mapping
const libraryData = {
  1: {
    name: 'The Room 19',
    tagline: 'Independent library at the heart of Bandung',
    logoPath: '/library-logos/room19.png',
    logoFallback: 'T19',
    address: {
      street: 'Jl. Dipati Ukur No.66C, Lebakgede',
      city: 'Kecamatan Coblong, Kota Bandung',
      postal: 'Jawa Barat 40132',
    },
    mapEmbed: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3960.9037064795!2d107.61526731477396!3d-6.902247995014827!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e68e7b1e9e9e9e9%3A0x1e9e9e9e9e9e9e9!2sJl.%20Dipati%20Ukur%20No.66C%2C%20Lebakgede%2C%20Kecamatan%20Coblong%2C%20Kota%20Bandung%2C%20Jawa%20Barat%2040132!5e0!3m2!1sen!2sid!4v1234567890123!5m2!1sen!2sid',
    mapLink: 'https://maps.app.goo.gl/RhFxAx4YUW7sk3CH6',
  },
  2: {
    name: 'Perpustakaan Digital Kota Bandung',
    tagline: 'Dinas Arsip dan Perpustakaan Kota Bandung',
    logoPath: '/library-logos/bandung.png',
    logoFallback: 'PKB',
    address: {
      street: 'Jl. Kawaluyaan Indah II No.4, Jatisari',
      city: 'Kec. Buahbatu, Kota Bandung',
      postal: 'Jawa Barat',
    },
    mapEmbed: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3960.3726449871615!2d107.63588731477454!3d-6.957745995007234!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e68e9ad1e0f1471%3A0x2a211d4736dab1d3!2sDinas%20Arsip%20dan%20Perpustakaan%20Kota%20Bandung%20(Disarpus)!5e0!3m2!1sen!2sid!4v1734175834567!5m2!1sen!2sid',
    mapLink: 'https://www.google.com/maps/place/Dinas+Arsip+dan+Perpustakaan+Kota+Bandung+(Disarpus)/@-6.9577459,107.6358873,17z/data=!3m1!4b1!4m6!3m5!1s0x2e68e9ad1e0f1471:0x2a211d4736dab1d3!8m2!3d-6.9577512!4d107.6384622!16s%2Fg%2F1hc1l6d_1',
  },
};

const LibraryDetailScreen = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const libraryId = id ? parseInt(id) : 1;
  const library = libraryData[libraryId as keyof typeof libraryData] || libraryData[1];

  const [books, setBooks] = useState<Book[]>([]);
  const [nftBooks, setNftBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

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

        const res = await fetch(
          `https://base-sepolia.blockscout.com/api/v2/addresses/${libraryPoolAddress}/nft?type=ERC-1155`
        );
        const data = await res.json();

        // Extract NFT IDs
        const ids: string[] = data.items.map((i: any) => i.id);

        // Filter books that exist in library
        const filteredBooks = books.filter((book) =>
          ids.includes(String(book.id))
        );

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
  }, [books]);

  return (
    <HomeLayout>
      <div className="min-h-screen flex flex-col">
        {/* Header Section with Logo and Tagline */}
        <div className="w-full flex flex-col items-center justify-center mt-8 mb-8">
          <div className="max-w-screen-xl w-full px-4 sm:px-6">
            {/* Back Button */}
            <button
              onClick={() => navigate("/libraries")}
              className="cursor-pointer hover:underline w-fit flex items-center gap-2 text-zinc-600 hover:text-zinc-900 mb-4"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back to Libraries
            </button>

            <div className="flex items-center gap-4 mb-4">
              {/* Logo */}
              <div className="w-16 h-16 rounded-full bg-white border-2 border-amber-200 shadow-md flex items-center justify-center overflow-hidden">
                <img
                  src={library.logoPath}
                  alt={`${library.name} Logo`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement!.innerHTML = `<div class="w-full h-full bg-[#C4C961] flex items-center justify-center"><span class="text-white text-xs font-bold">${library.logoFallback}</span></div>`;
                  }}
                />
              </div>

              {/* Title and Tagline */}
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900">
                  {library.name}
                </h1>
                <p className="text-sm text-zinc-600 mt-1">
                  {library.tagline}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Books Section */}
        <div className="w-full h-fit flex items-start justify-center mb-12">
          <section className="w-full max-w-screen-xl px-4 sm:px-6">
            {nftBooks.length === 0 && !loading ? (
              <div className="bg-white rounded-xl border-2 border-dashed border-zinc-300 p-12 text-center">
                <div className="text-zinc-400 text-5xl mb-4">📚</div>
                <h3 className="text-xl font-semibold text-zinc-900 mb-2">
                  No books in this library yet
                </h3>
                <p className="text-zinc-600">
                  Books will appear here once they are added to the library.
                </p>
              </div>
            ) : (
              <CivilibBookList
                books={nftBooks}
                isLoading={loading}
                libraryAddress={libraryPoolAddress}
              />
            )}
          </section>
        </div>

        {/* Footer with Map and Address */}
        <div className="w-full flex items-center justify-center mt-auto py-12 bg-zinc-50 border-t border-zinc-200">
          <div className="max-w-screen-xl w-full px-4 sm:px-6">
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
                <h3 className="text-xl font-bold text-zinc-900 mb-4">Visit Us</h3>
                <div className="flex items-start gap-3 mb-4">
                  <svg
                    className="w-5 h-5 text-amber-600 mt-1 flex-shrink-0"
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
                    <p className="text-zinc-900 font-medium">
                      {library.address.street}
                    </p>
                    <p className="text-zinc-600 text-sm">
                      {library.address.city}
                    </p>
                    <p className="text-zinc-600 text-sm">{library.address.postal}</p>
                  </div>
                </div>
                <a
                  href={library.mapLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-amber-600 hover:text-amber-700 font-medium text-sm"
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
    </HomeLayout>
  );
};

export default LibraryDetailScreen;
