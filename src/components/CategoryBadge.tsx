import { getCategoryBadgeColors } from '../utils/categoryColors';

interface CategoryBadgeProps {
  category: string;
  size?: 'sm' | 'md';
  useMonochromeColors?: boolean; // Enable for The Room 19
}

const CategoryBadge = ({
  category,
  size = 'sm',
  useMonochromeColors = false
}: CategoryBadgeProps) => {
  const sizeClasses = size === 'sm'
    ? 'px-2 py-0.5 text-xs'
    : 'px-3 py-1 text-sm';

  // Use monochrome colors if enabled, otherwise default amber
  const colors = useMonochromeColors
    ? getCategoryBadgeColors(category)
    : { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' };

  return (
    <span className={`inline-flex items-center rounded-full
                      ${colors.bg} ${colors.text} border ${colors.border}
                      font-medium ${sizeClasses}`}>
      {category}
    </span>
  );
};

export default CategoryBadge;
