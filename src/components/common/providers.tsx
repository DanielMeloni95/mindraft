"use client";

import * as React from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";

import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TooltipProvider delayDuration={250} skipDelayDuration={400}>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            className:
              "!bg-[var(--surface)] !text-[var(--foreground)] !border !border-[var(--border)] !rounded-[var(--radius-lg)] !shadow-[var(--shadow-overlay)]",
          }}
        />
      </TooltipProvider>
    </ThemeProvider>
  );
}
