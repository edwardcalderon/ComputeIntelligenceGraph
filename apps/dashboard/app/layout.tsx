import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Sidebar } from "../components/Sidebar";
import { Header } from "../components/Header";
import { ChatWidget } from "../components/ChatWidget";

export const metadata: Metadata = {
  title: "CIG Dashboard",
  description: "Compute Intelligence Graph — infrastructure dashboard.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
        <Providers>
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <div className="flex flex-1 flex-col overflow-hidden">
              <Header />
              <main className="flex-1 overflow-y-auto p-6">{children}</main>
            </div>
          </div>
          <ChatWidget />
        </Providers>
      </body>
    </html>
  );
}
