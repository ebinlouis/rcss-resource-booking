import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 120000, // 2 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
