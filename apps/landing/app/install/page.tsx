import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Download,
  Layers3,
  Sparkles,
  Terminal,
} from "lucide-react";

const steps = [
  {
    title: "Download the installer",
    description:
      "Use the public cig.lat endpoint to fetch the same install script that lives in the repository.",
    icon: Download,
  },
  {
    title: "Run the setup wizard",
    description:
      "The wizard validates prerequisites, asks for the install mode, and launches the correct bootstrap path.",
    icon: Terminal,
  },
  {
    title: "Choose the install mode",
    description:
      "Pick self-hosted for Docker Compose or managed for the cloud-connected node runtime bundle.",
    icon: Layers3,
  },
  {
    title: "Seed the first graph",
    description:
      "The installer captures the first graph snapshot and uploads it as soon as auth is available.",
    icon: Sparkles,
  },
];

const checklist = [
  "Node.js 22 or newer",
  "Docker Engine",
  "Docker Compose v2",
  "At least 4 GB free memory",
  "At least 10 GB free disk",
  "Open ports for the local stack",
];

export const metadata = {
  title: "Install CIG",
  description:
    "Install CIG from the public cig.lat installer, then use the guided setup wizard to bootstrap the first graph.",
  alternates: {
    canonical: "/install",
  },
};

export default function InstallPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-zinc-50 via-white to-zinc-100 text-zinc-900 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 dark:text-zinc-50">
      <div className="pointer-events-none absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-cyan-500/10 blur-3xl dark:bg-cyan-400/10" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[520px] w-[520px] rounded-full bg-violet-500/10 blur-3xl dark:bg-violet-400/10" />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-16 lg:px-8 lg:py-20">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200/80 bg-cyan-50/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-900 dark:border-cyan-800/70 dark:bg-cyan-950/45 dark:text-cyan-100">
            <BadgeCheck size={14} />
            cig.lat/install
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200/80 bg-white/80 px-4 py-1.5 text-xs font-medium text-zinc-600 dark:border-zinc-800/80 dark:bg-zinc-900/80 dark:text-zinc-300">
            <BadgeCheck size={14} />
            Public installer and onboarding guide
          </span>
        </div>

        <section className="grid gap-8 lg:grid-cols-[1.4fr_0.9fr]">
          <div className="space-y-6">
            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-500/90 dark:text-cyan-300/90">
                Install CIG
              </p>
              <h1 className="max-w-3xl text-4xl font-black tracking-tight md:text-6xl">
                Install CIG with one command, then let the wizard handle the rest.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-400 md:text-lg">
                The public installer at cig.lat is the fastest path into the platform.
                It validates your machine, launches the guided setup flow, and boots the
                first graph snapshot so you can connect to the dashboard right away.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href="/install.sh"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-950/20 transition-all hover:-translate-y-0.5 hover:shadow-xl"
              >
                <Download size={16} />
                Download install.sh
              </a>
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white/85 px-6 py-3 text-sm font-semibold text-zinc-800 shadow transition-all hover:-translate-y-0.5 hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900/85 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:bg-zinc-800/85"
              >
                <ArrowLeft size={16} />
                Back to home
              </Link>
            </div>

            <div className="rounded-3xl border border-zinc-200/80 bg-white/85 p-5 shadow-2xl shadow-cyan-950/10 backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/70">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
                    Web install
                  </p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-300">
                    Pipe the hosted script straight into bash.
                  </p>
                </div>
                <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-100">
                  curl | bash
                </span>
              </div>
              <pre className="overflow-x-auto rounded-2xl bg-zinc-950 px-5 py-4 text-sm leading-7 text-cyan-100 shadow-inner">
                <code>{`curl -fsSL https://cig.lat/install.sh | bash`}</code>
              </pre>
              <p className="mt-4 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                The same script is also available from a cloned checkout as
                <span className="font-mono text-zinc-900 dark:text-zinc-100"> ./install.sh</span>.
              </p>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-zinc-200/80 bg-white/85 p-5 shadow-xl shadow-zinc-950/10 dark:border-zinc-800/80 dark:bg-zinc-950/70">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
                Prerequisites
              </p>
              <div className="mt-4 space-y-3">
                {checklist.map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 rounded-2xl border border-zinc-200/70 bg-zinc-50/80 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800/80 dark:bg-zinc-900/70 dark:text-zinc-300"
                  >
                    <BadgeCheck size={16} className="text-emerald-500" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-200/80 bg-white/85 p-5 shadow-xl shadow-zinc-950/10 dark:border-zinc-800/80 dark:bg-zinc-950/70">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
                Install modes
              </p>
              <div className="mt-4 space-y-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                <div className="rounded-2xl border border-zinc-200/70 bg-zinc-50/80 p-4 dark:border-zinc-800/80 dark:bg-zinc-900/70">
                  <p className="mb-1 font-semibold text-zinc-900 dark:text-zinc-100">
                    Self-hosted
                  </p>
                  <p>
                    Best for local development or a small private deployment using Docker Compose.
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200/70 bg-zinc-50/80 p-4 dark:border-zinc-800/80 dark:bg-zinc-900/70">
                  <p className="mb-1 font-semibold text-zinc-900 dark:text-zinc-100">
                    Managed / cloud
                  </p>
                  <p>
                    Best for a Linux host that will enroll against the API and stage the node runtime bundle.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <article
                key={step.title}
                className="rounded-3xl border border-zinc-200/80 bg-white/85 p-5 shadow-lg shadow-zinc-950/10 dark:border-zinc-800/80 dark:bg-zinc-950/70"
                style={{ animationDelay: `${index * 120}ms` }}
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/15 via-blue-500/15 to-violet-500/15 ring-1 ring-cyan-500/20">
                  <Icon size={20} className="text-cyan-500 dark:text-cyan-300" />
                </div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {step.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  {step.description}
                </p>
              </article>
            );
          })}
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-3xl border border-zinc-200/80 bg-white/85 p-6 shadow-xl shadow-zinc-950/10 dark:border-zinc-800/80 dark:bg-zinc-950/70">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
              After install
            </p>
            <div className="mt-4 space-y-4 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              <p>The installer launches the guided onboarding wizard and hands off to the CLI.</p>
              <p>
                Use <span className="font-mono text-zinc-900 dark:text-zinc-100">cig setup</span> to rerun onboarding later.
              </p>
              <p>
                Use <span className="font-mono text-zinc-900 dark:text-zinc-100">cig status</span> and{" "}
                <span className="font-mono text-zinc-900 dark:text-zinc-100">cig open</span> to check the install and open the dashboard URL.
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-200/80 bg-white/85 p-6 shadow-xl shadow-zinc-950/10 dark:border-zinc-800/80 dark:bg-zinc-950/70">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
              Quick links
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <a
                href="/install.sh"
                className="flex items-center justify-between rounded-2xl border border-zinc-200/70 bg-zinc-50/80 px-4 py-4 text-sm font-semibold text-zinc-800 transition-all hover:border-cyan-300 hover:bg-cyan-50/80 dark:border-zinc-800/80 dark:bg-zinc-900/70 dark:text-zinc-200 dark:hover:border-cyan-700 dark:hover:bg-cyan-950/35"
              >
                <span className="inline-flex items-center gap-2">
                  <Terminal size={16} className="text-cyan-500" />
                  Installer script
                </span>
                <ArrowRight size={16} className="text-zinc-500" />
              </a>
              <a
                href="https://cig.lat"
                className="flex items-center justify-between rounded-2xl border border-zinc-200/70 bg-zinc-50/80 px-4 py-4 text-sm font-semibold text-zinc-800 transition-all hover:border-cyan-300 hover:bg-cyan-50/80 dark:border-zinc-800/80 dark:bg-zinc-900/70 dark:text-zinc-200 dark:hover:border-cyan-700 dark:hover:bg-cyan-950/35"
              >
                <span className="inline-flex items-center gap-2">
                  <Download size={16} className="text-violet-500" />
                  Landing page
                </span>
                <ArrowRight size={16} className="text-zinc-500" />
              </a>
            </div>

            <p className="mt-4 text-sm leading-6 text-zinc-500 dark:text-zinc-500">
              The installer and the guide are both published from the CIG landing app, so the public URL always matches the deployed site.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
