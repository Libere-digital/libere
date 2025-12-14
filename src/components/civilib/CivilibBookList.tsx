import { useState } from "react";
import { createPublicClient, http } from "viem";
import CivilibBookCard from "./CivilibBookCard";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { baseSepolia } from "viem/chains";
import type { Book } from "../../core/interfaces/book.interface";

interface Props {
  books: Book[];
  isLoading: boolean;
  libraryAddress?: string; // Optional: specific library pool address
}

const CivilibBookList = ({ books, libraryAddress }: Props) => {
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

  return (
    <section className="w-full flex justify-center items-center">
      <div className="w-full">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold">Books</h2>
        </div>

        {/* Category Filter Tabs */}
        {categories.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
            {categories.map((category) => (
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
            ))}
          </div>
        )}

        {/* Books Grid */}
        <ul className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 xs:gap-10">
          {filteredBooks.map((book) => (
            <CivilibBookCard
              key={book.title}
              book={book}
              client={client}
              clientPublic={clientPublic}
              libraryAddress={libraryAddress}
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
