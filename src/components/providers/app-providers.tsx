"use client";

import { useEffect } from "react";
import { registerServiceWorker } from "@/lib/pwa/register-service-worker";

export function AppProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return children;
}