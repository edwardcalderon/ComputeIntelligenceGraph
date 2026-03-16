import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CIG Installation Wizard",
  description: "Step-by-step setup for Compute Intelligence Graph.",
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
