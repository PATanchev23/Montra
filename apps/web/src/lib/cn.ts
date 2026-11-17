import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * Montra's type scale (`text-caption`, `text-figure` … in styles/index.css)
 * registered as font sizes, so merging `text-caption` with a colour such as
 * `text-positive` keeps both instead of treating them as rivals.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      // `rounded-control`, `rounded-field`, `rounded-panel`: one wins when merged.
      radius: ['control', 'field', 'panel'],
      text: [
        'micro',
        'caption',
        'body-sm',
        'body',
        'body-lg',
        'title',
        'figure-sm',
        'figure',
        'display',
        'figure-xl',
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
