"use client";

import { CIGAuthProvider } from "@cig/auth";

export function Providers({ children }: { children: React.ReactNode }) {
  return <CIGAuthProvider>{children}</CIGAuthProvider>;
}
