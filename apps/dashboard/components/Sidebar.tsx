"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppStore } from "../lib/store";

const navItems = [
  { label: "Overview", href: "/" },
  { label: "Resources", href: "/resources" },
  { label: "Graph", href: "/graph" },
  { label: "Costs", href: "/costs" },
  { label: "Security", href: "/security" },
  { label: "Settings", href: "/settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen } = useAppStore();

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={[
          "fixed inset-y-0 left-0 z-30 flex w-56 flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transition-transform duration-200",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          "lg:static lg:translate-x-0",
        ].join(" ")}
      >
        {/* Logo */}
        <div className="flex h-14 items-center px-4 border-b border-gray-200 dark:border-gray-700">
          <span className="text-lg font-semibold text-gray-900 dark:text-white">
            CIG
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-2">
            {navItems.map(({ label, href }) => {
              const active = pathname === href;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={() => setSidebarOpen(false)}
                    className={[
                      "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                        : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800",
                    ].join(" ")}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </>
  );
}
