import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CIG — Compute Intelligence Graph",
  description:
    "Open-source platform that discovers your infrastructure — cloud, on-premise, or local — builds a dependency graph, and lets you query it conversationally.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
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
      <body className="bg-zinc-950 text-zinc-50 antialiased">{children}</body>
    </html>
  );
}
