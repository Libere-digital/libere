import { useState } from "react";
import BandungCollectionCard from "./BandungCollectionCard";
import type { BandungCollectionItem } from "../../libs/supabase-helpers";

interface Props {
  items: BandungCollectionItem[];
  isLoading: boolean;
}

const BandungCollectionList = ({ items, isLoading }: Props) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories: string[] = ['All', ...Array.from(new Set(
    items.map(b => b.category).filter(Boolean)
  ))];

  const filtered = selectedCategory === 'All'
    ? items
    : items.filter(b => b.category === selectedCategory);

  if (isLoading) {
    return (
      <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 auto-rows-fr">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="w-full h-80 bg-zinc-100 rounded-lg animate-pulse" />
        ))}
      </ul>
    );
  }

  return (
    <section className="w-full">
      {/* Category Filter */}
      {categories.length > 1 && (
        <div className="flex items-center gap-3 overflow-x-auto pb-2 mb-6 scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-zinc-900 text-white shadow-md'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 auto-rows-fr">
        {filtered.map((item) => (
          <BandungCollectionCard key={item.id} item={item} />
        ))}
      </ul>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <p className="text-zinc-500">Tidak ada buku dalam kategori {selectedCategory}.</p>
        </div>
      )}
    </section>
  );
};

export default BandungCollectionList;
