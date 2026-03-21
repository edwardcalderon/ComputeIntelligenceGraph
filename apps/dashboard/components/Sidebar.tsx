"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppStore } from "../lib/store";
import { UserMenu } from "./UserMenu";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  color: string; // CIG accent color for active state glow
}

const navItems: NavItem[] = [
  { label: "Overview",        href: "/",                icon: <HomeIcon />,      color: "#06b6d4" },
  { label: "Resources",       href: "/resources",       icon: <ResourcesIcon />, color: "#3b82f6" },
  { label: "Graph",           href: "/graph",           icon: <GraphIcon />,     color: "#8b5cf6" },
  { label: "Costs",           href: "/costs",           icon: <CostsIcon />,     color: "#a855f7" },
  { label: "Security",        href: "/security",        icon: <SecurityIcon />,  color: "#10b981" },
  { label: "Device Approval", href: "/device-approval", icon: <DeviceIcon />,    color: "#f59e0b" },
  { label: "Targets",         href: "/targets",         icon: <TargetsIcon />,   color: "#ef4444" },
  { label: "Bootstrap",       href: "/bootstrap",       icon: <BootstrapIcon />, color: "#06b6d4" },
];

const secondaryItems: NavItem[] = [
  { label: "Profile",  href: "/profile",  icon: <ProfileIcon />,  color: "#3b82f6" },
  { label: "Settings", href: "/settings", icon: <SettingsIcon />, color: "#8b5cf6" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen } = useAppStore();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-30 flex w-60 flex-col transition-transform duration-200",
          "bg-[#050b14] border-r border-white/[0.06]",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          "lg:static lg:translate-x-0",
        ].join(" ")}
      >
        {/* Logo — links back to landing */}
        <a
          href={process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}
          className="group flex h-14 items-center gap-3 px-5 border-b border-white/[0.06] transition-colors hover:bg-white/[0.03]"
        >
          {/* Glow dot */}
          <div className="relative flex items-center justify-center size-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
            <div className="size-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
            <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-[0_0_12px_rgba(6,182,212,0.3)]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-base font-bold tracking-tight text-white">
              CIG
            </span>
            <span className="text-[10px] font-mono text-white/30">
              v{process.env.NEXT_PUBLIC_APP_VERSION}
            </span>
          </div>
        </a>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2.5">
          {/* Section label */}
          <p className="px-3 mb-2 text-[10px] uppercase tracking-[0.15em] font-semibold text-white/25">
            Platform
          </p>
          <ul className="space-y-0.5">
            {navItems.map(({ label, href, icon, color }) => {
              const active = isActive(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={() => setSidebarOpen(false)}
                    className={[
                      "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150",
                      active
                        ? "text-white bg-white/[0.07]"
                        : "text-white/50 hover:text-white/80 hover:bg-white/[0.04]",
                    ].join(" ")}
                  >
                    {/* Active indicator bar */}
                    {active && (
                      <div
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                        style={{
                          backgroundColor: color,
                          boxShadow: `0 0 8px ${color}80`,
                        }}
                      />
                    )}
                    <span
                      className="flex items-center justify-center size-5 transition-colors"
                      style={{ color: active ? color : undefined }}
                    >
                      {icon}
                    </span>
                    {label}
                    {/* Subtle glow on active */}
                    {active && (
                      <div
                        className="absolute inset-0 rounded-lg pointer-events-none"
                        style={{
                          background: `radial-gradient(ellipse at left, ${color}12 0%, transparent 70%)`,
                        }}
                      />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Secondary section */}
          <div className="mt-6">
            <p className="px-3 mb-2 text-[10px] uppercase tracking-[0.15em] font-semibold text-white/25">
              Account
            </p>
            <ul className="space-y-0.5">
              {secondaryItems.map(({ label, href, icon, color }) => {
                const active = isActive(href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={() => setSidebarOpen(false)}
                      className={[
                        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150",
                        active
                          ? "text-white bg-white/[0.07]"
                          : "text-white/50 hover:text-white/80 hover:bg-white/[0.04]",
                      ].join(" ")}
                    >
                      {active && (
                        <div
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                          style={{
                            backgroundColor: color,
                            boxShadow: `0 0 8px ${color}80`,
                          }}
                        />
                      )}
                      <span
                        className="flex items-center justify-center size-5 transition-colors"
                        style={{ color: active ? color : undefined }}
                      >
                        {icon}
                      </span>
                      {label}
                      {active && (
                        <div
                          className="absolute inset-0 rounded-lg pointer-events-none"
                          style={{
                            background: `radial-gradient(ellipse at left, ${color}12 0%, transparent 70%)`,
                          }}
                        />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        {/* User menu at bottom */}
        <div className="border-t border-white/[0.06]">
          <UserMenu />
        </div>
      </aside>
    </>
  );
}

/* ─── Icons ─────────────────────────────────────────────────────────────── */

function HomeIcon() {
  return (
    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  );
}
function ResourcesIcon() {
  return (
    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 0 1-3-3m3 3a3 3 0 1 0 6 0m-6 0H2.25m13.5 0a3 3 0 0 0 3-3m-3 3a3 3 0 1 1-6 0m6 0h3.75m-3.75 0V6m-7.5 8.25V6m0 0a3 3 0 0 1 3-3m-3 3a3 3 0 1 0 6 0m-6 0H2.25m13.5 0a3 3 0 0 0-3-3m3 3a3 3 0 1 1-6 0m6 0h3.75" />
    </svg>
  );
}
function GraphIcon() {
  return (
    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" />
    </svg>
  );
}
function CostsIcon() {
  return (
    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}
function SecurityIcon() {
  return (
    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
    </svg>
  );
}
function ProfileIcon() {
  return (
    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
    </svg>
  );
}
function SettingsIcon() {
  return (
    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  );
}
function DeviceIcon() {
  return (
    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
    </svg>
  );
}
function TargetsIcon() {
  return (
    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
    </svg>
  );
}
function BootstrapIcon() {
  return (
    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
    </svg>
  );
}
