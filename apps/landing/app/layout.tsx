import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CIG — Compute Intelligence Graph",
  description: "Discover and manage your cloud infrastructure intelligently.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
