"use client";

export interface LegalSection {
  title: string;
  body: string;
}

export interface LegalDrawerProps {
  eyebrow: string;
  title: string;
  description: string;
  backHref: string;
  backLabel: string;
  sections: LegalSection[];
  note?: string;
  fullPolicyHref?: string;
  fullPolicyLabel?: string;
  className?: string;
}

export function LegalDrawer({
  eyebrow,
  title,
  description,
  backHref,
  backLabel,
  sections,
  note,
  fullPolicyHref,
  fullPolicyLabel = "Full policy →",
  className = "",
}: LegalDrawerProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-[2rem] border border-zinc-200/80 bg-white/95 shadow-[0_24px_90px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-zinc-950/95 dark:shadow-[0_24px_90px_rgba(0,0,0,0.45)] ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-violet-500/10" />

      <div className="relative grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
        <aside className="border-b border-zinc-200/80 bg-zinc-50/85 p-6 dark:border-white/10 dark:bg-zinc-900/70 lg:border-b-0 lg:border-r lg:p-8">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700 dark:text-cyan-300">
            <span className="size-2 rounded-full bg-cyan-500" />
            {eyebrow}
          </div>

          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-4xl">
            {title}
          </h1>

          <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-600 dark:text-zinc-300 sm:text-base">
            {description}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href={backHref}
              className="inline-flex items-center rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-cyan-600 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-cyan-300"
            >
              {backLabel}
            </a>
            {fullPolicyHref ? (
              <a
                href={fullPolicyHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:border-cyan-500 hover:text-cyan-600 dark:border-white/20 dark:text-zinc-300 dark:hover:border-cyan-400 dark:hover:text-cyan-300"
              >
                {fullPolicyLabel}
              </a>
            ) : null}
          </div>

          {note ? (
            <p className="mt-8 max-w-md text-xs leading-6 text-zinc-500 dark:text-zinc-400">
              {note}
            </p>
          ) : null}
        </aside>

        <div className="p-6 sm:p-8 lg:p-10">
          <div className="space-y-4">
            {sections.map((section) => (
              <section
                key={section.title}
                className="rounded-3xl border border-zinc-200/80 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-zinc-900/60"
              >
                <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-zinc-900 dark:text-zinc-100">
                  {section.title}
                </h2>
                <p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                  {section.body}
                </p>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}