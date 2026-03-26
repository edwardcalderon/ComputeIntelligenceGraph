"use client";

export interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
}

export interface FooterBarProps {
  brandLabel: string;
  // When provided previously, this controlled the brand link target.
  // Now optional and ignored to make brand non-clickable by default.
  brandHref?: string;
  subtitle?: string;
  links: FooterLink[];
  meta?: string;
  className?: string;
}

export function FooterBar({
  brandLabel,
  brandHref,
  subtitle,
  links,
  meta,
  className = "",
}: FooterBarProps) {
  const metaParts = meta ? meta.split(" · ") : [];
  const mobileMetaLead = metaParts[0] ?? "";
  const mobileMetaTail = metaParts.slice(1).join(" · ");

  return (
    <div
      className={`relative overflow-hidden rounded-[2rem] border border-zinc-200/80 bg-white/95 px-5 py-6 shadow-[0_18px_56px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-zinc-950/90 dark:shadow-[0_24px_64px_rgba(0,0,0,0.38)] ${className}`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-80 dark:opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(6,182,212,0.42) 1px, transparent 0), linear-gradient(135deg, rgba(6,182,212,0.12), transparent 42%, rgba(37,99,235,0.12))",
          backgroundSize: "12px 12px, 100% 100%",
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/70 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 left-0 w-40 bg-gradient-to-r from-cyan-500/10 to-transparent blur-2xl" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-40 bg-gradient-to-l from-blue-500/10 to-transparent blur-2xl" />
      <div className="pointer-events-none absolute inset-x-6 top-6 h-20 rounded-full bg-cyan-400/10 blur-3xl animate-pulse" />

      <div className="relative flex flex-col gap-6 text-center lg:flex-row lg:items-end lg:justify-between lg:gap-8 lg:text-left">
        <div className="flex flex-col gap-4 lg:min-w-0 lg:flex-1">
          {/* Brand/logo block is now non-interactive (no link) */}
          <div className="group flex flex-col items-center gap-3 lg:flex-row lg:items-center lg:gap-4">
            <span className="flex size-16 items-center justify-center rounded-[1.4rem] border border-cyan-500/20 bg-zinc-950/80 p-2 text-cyan-400 shadow-[0_10px_30px_rgba(8,145,178,0.2)] transition-transform group-hover:scale-[1.02] dark:border-cyan-400/20 dark:bg-black/40 dark:text-cyan-300 lg:size-12 lg:rounded-2xl lg:p-1.5">
            <svg viewBox="20 20 216 216" className="size-10" xmlns="http://www.w3.org/2000/svg" fill="none" aria-hidden="true">
              <defs>
                <linearGradient id="footerGraphGrad" x1="48" y1="40" x2="208" y2="208" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#2563EB" />
                  <stop offset="100%" stopColor="#14B8A6" />
                </linearGradient>
                <radialGradient id="footerCoreGlow" cx="50%" cy="50%" r="60%">
                  <stop offset="0%" stopColor="#ECFEFF" />
                  <stop offset="55%" stopColor="#A5F3FC" />
                  <stop offset="100%" stopColor="#22D3EE" />
                </radialGradient>
              </defs>
              <g transform="rotate(90 128 128)">
                <g stroke="url(#footerGraphGrad)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" opacity="0.95">
                  <line x1="128" y1="52" x2="74" y2="174" />
                  <line x1="128" y1="52" x2="182" y2="174" />
                  <line x1="74" y1="174" x2="128" y2="146" />
                  <line x1="128" y1="146" x2="182" y2="174" />
                  <line x1="74" y1="174" x2="182" y2="174" />
                </g>
                <g fill="white" stroke="url(#footerGraphGrad)" strokeWidth="6">
                  <circle cx="128" cy="52" r="14" />
                  <circle cx="74" cy="174" r="14" />
                  <circle cx="182" cy="174" r="14" />
                  <circle cx="128" cy="146" r="18" />
                </g>
                <circle cx="128" cy="146" r="9" fill="url(#footerCoreGlow)" />
              </g>
            </svg>
          </span>
            <div className="flex flex-col items-center gap-2 lg:items-start lg:gap-1.5">
              <span className="text-[0.8rem] font-semibold uppercase tracking-[0.34em] text-zinc-950 transition-colors group-hover:text-cyan-700 dark:text-zinc-50 dark:group-hover:text-cyan-300">
                {brandLabel}
              </span>

              {subtitle ? (
                <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-600 dark:text-zinc-400 lg:hidden">
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-zinc-700 dark:text-zinc-200 lg:justify-start">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noopener noreferrer" : undefined}
                className="transition-colors hover:text-zinc-950 dark:hover:text-white"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>

        {meta ? (
          <div className="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-600 dark:text-zinc-400 lg:max-w-2xl lg:items-end lg:text-right">
            <div className="hidden lg:block">{meta}</div>
            <div className="lg:hidden">
              <div>{mobileMetaLead}</div>
              {mobileMetaTail ? <div className="mt-1">{mobileMetaTail}</div> : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}