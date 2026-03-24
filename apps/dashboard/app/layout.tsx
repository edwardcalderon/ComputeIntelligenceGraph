import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { Providers } from "./providers";
import { BootstrapRedirect } from "../components/BootstrapRedirect";
import { AppUpdateWatcher } from "../components/AppUpdateWatcher";

export const metadata: Metadata = {
  title: "CIG Dashboard",
  description: "Compute Intelligence Graph — infrastructure dashboard.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
        <Suspense>
          <Providers>
            <AppUpdateWatcher />
            <BootstrapRedirect>
              {children}
            </BootstrapRedirect>
          </Providers>
        </Suspense>
      </body>
    </html>
  );
}
