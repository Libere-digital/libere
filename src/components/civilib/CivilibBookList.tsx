import { useState } from "react";
import { createPublicClient, http } from "viem";
import CivilibBookCard from "./CivilibBookCard";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { baseSepolia } from "viem/chains";
import type { Book } from "../../core/interfaces/book.interface";
import { getCategoryColors } from "../../utils/categoryColors";

interface Props {
  books: Book[];
  isLoading: boolean;
  libraryAddress?: string; // Optional: specific library pool address
  useMonochromeColors?: boolean; // Enable for The Room 19
  useBlock71Colors?: boolean; // Enable for Block71 Indonesia
}

const CivilibBookList = ({ books, libraryAddress, useMonochromeColors = false, useBlock71Colors = false }: Props) => {
  const { client } = useSmartWallets();
  const clientPublic = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });

  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Get unique categories from books (excluding undefined/null)
  const categories: string[] = ['All', ...Array.from(new Set(
    books.map(b => b.category).filter((cat): cat is string => Boolean(cat))
  ))];

  // Filter books by selected category
  const filteredBooks = selectedCategory === 'All'
    ? books
    : books.filter(b => b.category === selectedCategory);

  // Block71 category color mapping (teal/blue gradient scheme)
  const getBlock71CategoryColor = (category: string): string => {
    const colorMap: Record<string, string> = {
      'All': 'from-slate-600 to-slate-700',
      'Fiksi': 'from-teal-500 to-teal-600',
      'Non-Fiksi': 'from-cyan-500 to-cyan-600',
      'Sejarah': 'from-blue-500 to-blue-600',
      'Teknologi': 'from-sky-500 to-sky-600',
      'Seni': 'from-indigo-500 to-indigo-600',
    };
    return colorMap[category] || 'from-teal-500 to-cyan-600';
  };

  return (
    <section className="w-full flex justify-center items-center">
      <div className="w-full">
        {/* Category Filter Tabs */}
        {categories.length > 1 && (
          <div className="flex items-center gap-3 overflow-x-auto pb-2 mb-6 scrollbar-hide">
            {categories.map((category) => {
              const colors = useMonochromeColors ? getCategoryColors(category) : null;
              const block71Gradient = useBlock71Colors ? getBlock71CategoryColor(category) : '';

              // Block71 style: Rectangular gradient chips with icon
              if (useBlock71Colors) {
                return (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`group relative overflow-hidden px-5 py-2.5 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
                      selectedCategory === category
                        ? 'shadow-lg scale-105'
                        : 'shadow-md hover:shadow-lg hover:scale-105'
                    }`}
                  >
                    {/* Gradient background */}
                    <div className={`absolute inset-0 bg-gradient-to-r ${block71Gradient} ${
                      selectedCategory === category
                        ? 'opacity-100'
                        : 'opacity-70 group-hover:opacity-90'
                    } transition-opacity`} />

                    {/* Category icon (dot indicator) */}
                    <div className="relative flex items-center gap-2 text-white">
                      <span className={`w-1.5 h-1.5 rounded-full bg-white ${
                        selectedCategory === category ? 'opacity-100' : 'opacity-0 group-hover:opacity-70'
                      } transition-opacity`} />
                      <span className="relative z-10">{category}</span>
                    </div>
                  </button>
                );
              }

              // The Room 19 monochrome style
              if (useMonochromeColors) {
                return (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                      selectedCategory === category
                        ? `${colors!.bgActive} ${colors!.textActive} shadow-md`
                        : `${colors!.bg} ${colors!.text} ${colors!.bgHover}`
                    }`}
                  >
                    {category}
                  </button>
                );
              }

              // Default Bandung style
              return (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                    selectedCategory === category
                      ? 'bg-amber-500 text-white shadow-md'
                      : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                  }`}
                >
                  {category}
                </button>
              );
            })}
          </div>
        )}

        {/* Books Grid */}
        <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 auto-rows-fr">
          {filteredBooks.map((book) => (
            <CivilibBookCard
              key={book.title}
              book={book}
              client={client}
              clientPublic={clientPublic}
              libraryAddress={libraryAddress}
              useMonochromeColors={useMonochromeColors}
            />
          ))}
        </ul>

        {/* Empty State */}
        {filteredBooks.length === 0 && (
          <div className="text-center py-12">
            <p className="text-zinc-500">
              No books found in {selectedCategory} category.
            </p>
          </div>
        )}
      </div>
    </section>
  );
};

export default CivilibBookList;
