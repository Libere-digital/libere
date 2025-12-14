interface CategoryBadgeProps {
  category: string;
  size?: 'sm' | 'md';
}

const CategoryBadge = ({ category, size = 'sm' }: CategoryBadgeProps) => {
  const sizeClasses = size === 'sm'
    ? 'px-2 py-0.5 text-xs'
    : 'px-3 py-1 text-sm';

  return (
    <span className={`inline-flex items-center rounded-full bg-amber-100 text-amber-800 font-medium ${sizeClasses}`}>
      {category}
    </span>
  );
};

export default CategoryBadge;
