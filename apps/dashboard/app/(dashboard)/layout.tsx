import { Sidebar } from "../../components/Sidebar";
import { Header } from "../../components/Header";
import { ChatWidget } from "../../components/ChatWidget";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#050b14]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
        <footer className="shrink-0 text-center text-[10px] text-white/20 py-2 border-t border-white/[0.04]">
          <a
            href={process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}
            className="hover:text-white/40 transition-colors"
          >
            cig.lat
          </a>
          {" · "}CIG Dashboard{" · "}
          <span title={process.env.NEXT_PUBLIC_RELEASE_TAG || ""}>
            v{process.env.NEXT_PUBLIC_APP_VERSION}
            {process.env.NEXT_PUBLIC_APP_BUILD ? `+build.${process.env.NEXT_PUBLIC_APP_BUILD}` : ""}
          </span>
        </footer>
      </div>
      <ChatWidget />
    </div>
  );
}
