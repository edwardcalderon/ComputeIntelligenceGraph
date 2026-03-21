import { Sidebar } from "../../components/Sidebar";
import { Header } from "../../components/Header";
import { Footer } from "../../components/Footer";
import { ChatWidget } from "../../components/ChatWidget";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-cig-base">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
        <Footer />
      </div>
      <ChatWidget />
    </div>
  );
}
