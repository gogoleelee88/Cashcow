'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/auth.store';
import { api } from '../../lib/api';
import { Toaster } from '../ui/toaster';

const queryClientConfig = {
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,       // 2 minutes
      gcTime: 1000 * 60 * 10,          // 10 minutes
      retry: (failureCount: number, error: any) => {
        if (error?.response?.status === 401 || error?.response?.status === 404) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
};

function AuthInitializer() {
  const { isAuthenticated, setUser, logout, setLoading } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    api.auth.me().then((res) => {
      if (res.success) setUser(res.data);
      else logout();
    }).catch(() => {
      logout();
    }).finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient(queryClientConfig));

  return (
    <QueryClientProvider client={queryClient}>
      <AuthInitializer />
      {children}
      <Toaster />
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
