if (typeof window !== 'undefined') {
  (window as any).global = window;
  (window as any).process = {
    ...((window as any).process || {}),
    env: { DEBUG: undefined },
    version: '',
    nextTick: (fn: any) => setTimeout(fn, 0),
    listeners: () => [],
    on: () => {},
    removeListener: () => {},
  };
}

import type { AppProps } from "next/app";
import Head from "next/head";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import "@/index.css";

export default function App({ Component, pageProps }: AppProps) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem storageKey="medicare-theme">
        <AuthProvider>
          <TooltipProvider>
            <Head>
              <title>MediCare AI</title>
              <meta name="description" content="AI health companion for appointments, triage, and health records." />
              <meta name="viewport" content="width=device-width, initial-scale=1" />
            </Head>
            <Toaster />
            <Sonner />
            <Component {...pageProps} />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
