import { BootstrapRedirect } from "../../components/BootstrapRedirect";
import { Sidebar } from "../../components/Sidebar";
import { Header } from "../../components/Header";
import { Footer } from "../../components/Footer";
import { ChatWidget } from "../../components/ChatWidget";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <BootstrapRedirect>
      <div className="flex h-screen overflow-hidden bg-cig-base">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Header />
          <main className="min-w-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
            {children}
          </main>
          <Footer />
        </div>
        <ChatWidget />
      </div>
    </BootstrapRedirect>
  );
}
