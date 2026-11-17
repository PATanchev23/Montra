import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { ApiError } from '../api/client';
import { onUserChange } from '../api/session';
import { Toaster } from '../components/ui/Toaster';
import { TooltipProvider } from '../components/ui/Tooltip';
import { useApplyLanguage } from './useApplyLanguage';
import { useApplyTheme } from './useApplyTheme';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Retry only transient failures; a 4xx will not fix itself.
        retry: (failureCount, error) =>
          failureCount < 2 &&
          (!(error instanceof ApiError) || error.status === 0 || error.status >= 500),
      },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  useApplyTheme();
  const language = useApplyLanguage();
  // Nothing cached for one user may be shown to the next.
  useEffect(() => onUserChange(() => queryClient.clear()), [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <TooltipProvider delayDuration={250}>
          {/* A new language re-mounts the pages, so every formatted figure and date follows it.
              Cached server data survives: the query client sits above. */}
          <Fragment key={language}>{children}</Fragment>
          <Toaster />
        </TooltipProvider>
      </MotionConfig>
    </QueryClientProvider>
  );
}
