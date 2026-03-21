import { Sidebar } from "../../components/Sidebar";
import { Header } from "../../components/Header";
import { ChatWidget } from "../../components/ChatWidget";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
        <footer className="shrink-0 text-center text-[10px] text-gray-400 dark:text-gray-600 py-1 border-t border-gray-200 dark:border-gray-800">
          <a
            href={process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}
            className="hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
          >
            cig.lat
          </a>
          {" · "}CIG Dashboard · v{process.env.NEXT_PUBLIC_APP_VERSION}
        </footer>
      </div>
      <ChatWidget />
    </div>
  );
}
