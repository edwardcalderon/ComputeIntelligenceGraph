import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { LOCALE_META } from "@cig-technology/i18n";
import "./globals.css";
import { Providers } from "./providers";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  "http://localhost:3000";

export const viewport: Viewport = {
  themeColor: "#22d3ee",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "CIG — Compute Intelligence Graph",
  description:
    "Open-source platform that discovers your infrastructure — cloud, on-premise, or local — builds a dependency graph, and lets you query it conversationally.",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/icon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icon-180x180.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/site.webmanifest",
};

function getServerPreferredLocale(): keyof typeof LOCALE_META {
  try {
    const h = headers();
    const al = h.get("accept-language") || "";
    const supported = Object.keys(LOCALE_META) as Array<keyof typeof LOCALE_META>;
    const candidates = al
      .split(",")
      .map((p) => p.trim().split(";")[0])
      .map((tag) => tag.split("-")[0])
      .filter(Boolean);
    for (const c of candidates) {
      const base = c as keyof typeof LOCALE_META;
      if (supported.includes(base)) return base;
    }
    return "en";
  } catch {
    return "en";
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialLocale = getServerPreferredLocale();
  // Note: Client-side i18n will detect this lang/dir and hydrate accordingly.
  return (
    <html lang={initialLocale} dir={LOCALE_META[initialLocale].dir} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("cig-theme")!=="light")document.documentElement.classList.add("dark")}catch(e){document.documentElement.classList.add("dark")}`,
          }}
        />
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
