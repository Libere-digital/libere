// Category color schemes for The Room 19 (monochrome aesthetic)
// Grayscale gradient fitting the minimalist black/white theme

interface ColorScheme {
  bg: string;
  bgHover: string;
  bgActive: string;
  text: string;
  textActive: string;
  border: string;
}

const categoryColorMap: Record<string, ColorScheme> = {
  'Fiksi': {
    bg: 'bg-zinc-900',
    bgHover: 'hover:bg-zinc-800',
    bgActive: 'bg-black',
    text: 'text-white',
    textActive: 'text-white',
    border: 'border-zinc-800',
  },
  'Non-Fiksi': {
    bg: 'bg-zinc-700',
    bgHover: 'hover:bg-zinc-600',
    bgActive: 'bg-zinc-800',
    text: 'text-white',
    textActive: 'text-white',
    border: 'border-zinc-600',
  },
  'Sejarah': {
    bg: 'bg-zinc-500',
    bgHover: 'hover:bg-zinc-400',
    bgActive: 'bg-zinc-600',
    text: 'text-white',
    textActive: 'text-white',
    border: 'border-zinc-400',
  },
  'Teknologi': {
    bg: 'bg-zinc-300',
    bgHover: 'hover:bg-zinc-200',
    bgActive: 'bg-zinc-400',
    text: 'text-zinc-900',
    textActive: 'text-white',
    border: 'border-zinc-200',
  },
  'Seni': {
    bg: 'bg-zinc-100',
    bgHover: 'hover:bg-zinc-50',
    bgActive: 'bg-zinc-200',
    text: 'text-zinc-900',
    textActive: 'text-zinc-900',
    border: 'border-zinc-100',
  },
  'All': {
    bg: 'bg-white',
    bgHover: 'hover:bg-zinc-50',
    bgActive: 'bg-black',
    text: 'text-zinc-900',
    textActive: 'text-white',
    border: 'border-zinc-300',
  },
};

const defaultColors: ColorScheme = {
  bg: 'bg-zinc-200',
  bgHover: 'hover:bg-zinc-100',
  bgActive: 'bg-zinc-300',
  text: 'text-zinc-900',
  textActive: 'text-zinc-900',
  border: 'border-zinc-200',
};

/**
 * Get color scheme for a category
 * Returns monochrome grayscale colors for The Room 19 aesthetic
 */
export const getCategoryColors = (category: string): ColorScheme => {
  return categoryColorMap[category] || defaultColors;
};

/**
 * Get badge-specific colors (lighter for small badges)
 */
export const getCategoryBadgeColors = (category: string) => {
  const scheme = getCategoryColors(category);
  return {
    bg: scheme.bg,
    text: scheme.text,
    border: scheme.border,
  };
};
