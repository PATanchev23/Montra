import { useEffect } from 'react';
import { useUiStore } from '../stores/ui';

/** Keeps the `.dark` class on <html> in sync with the preference and the OS setting. */
export function useApplyTheme() {
  const theme = useUiStore((state) => state.theme);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      document.documentElement.classList.toggle('dark', dark);
    };
    apply();
    if (theme !== 'system') return;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
}
