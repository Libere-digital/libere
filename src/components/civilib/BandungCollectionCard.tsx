import { useNavigate } from "react-router-dom";
import { FaBookReader } from "react-icons/fa";
import CategoryBadge from "../CategoryBadge";
import type { BandungCollectionItem } from "../../libs/supabase-helpers";

interface Props {
  item: BandungCollectionItem;
}

const BandungCollectionCard = ({ item }: Props) => {
  const navigate = useNavigate();

  const onRead = () => {
    navigate(`/read-book/bc-${item.id}`, { state: { fromBandungCollection: true, collectionItem: item } });
  };

  return (
    <li className="w-full h-full">
      <div className="w-full h-full flex flex-col p-5 rounded-lg border border-zinc-200 hover:border-zinc-300 hover:shadow-md transition-all duration-200 relative">
        {/* Badge */}
        <div className="absolute top-3 right-3 z-10">
          <span className="bg-zinc-900 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
            Free Read
          </span>
        </div>

        {/* Cover */}
        <div className="relative w-full h-56 bg-zinc-100 rounded overflow-hidden flex-shrink-0">
          {item.cover_url ? (
            <img
              src={item.cover_url}
              alt={item.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-zinc-200">
              <span className="text-zinc-400 text-4xl">📄</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="w-full mt-3 flex-1 flex flex-col">
          <h5 className="text-lg font-semibold tracking-tight text-zinc-900">
            {item.title}
          </h5>
          <p className="line-clamp-1 text-xs text-zinc-500 mt-1">
            {item.author}
          </p>

          {item.category && (
            <div className="mt-2">
              <CategoryBadge category={item.category} size="sm" />
            </div>
          )}

          <div className="flex flex-col items-start justify-start mt-3 mb-3 w-full gap-2">
            <span className="bg-zinc-100 text-zinc-700 text-xs font-semibold px-2.5 py-0.5 rounded-sm">
              Baca langsung · gratis
            </span>
          </div>

          <div className="w-full flex items-center gap-2 justify-between mt-auto">
            <button
              onClick={onRead}
              className="cursor-pointer flex flex-row gap-2 justify-center items-center w-full bg-zinc-900 text-white px-2.5 py-2 rounded-md hover:bg-zinc-800 transition-colors font-medium"
            >
              <FaBookReader /> Baca
            </button>
          </div>
        </div>
      </div>
    </li>
  );
};

export default BandungCollectionCard;
