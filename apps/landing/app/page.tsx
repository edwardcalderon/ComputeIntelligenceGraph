"use client";

import React, { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js"; // newsletter only
import { GraphParticleTypography } from "../components/GraphParticleTypography";
import { SpaceBackground } from "../components/SpaceBackground";
import { AuthButton } from "../components/AuthButton";
import { AuthenticatedLanding } from "../components/AuthenticatedLanding";
import { ThemeToggle } from "../components/ThemeToggle";
import { LocaleSwitcher } from "../components/LocaleSwitcher";
import { useCIGAuth } from "../components/AuthProvider";
import { useTranslation } from "@cig-technology/i18n/react";
import { DitheringShader } from "../components/DitheringShader";
import { useTheme } from "./providers";
import {
  Cloud,
  GitGraph,
  MessageSquare,
  Shield,
  Search,
  LayoutDashboard,
  Github,
  BookOpen,
  ArrowRight,
  ChevronRight,
  ChevronDown,
  ArrowUp,
  Terminal,
  Server,
  Monitor,
  BrainCircuit,
} from "lucide-react";

/* ─── Utility ─────────────────────────────────────────────────────────── */

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

/* ─── Scroll-reveal hook (IntersectionObserver) ───────────────────────── */

function useReveal<T extends HTMLElement>(
  threshold = 0.15,
  rootMargin = "0px 0px -40px 0px"
) {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold, rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  return { ref, visible };
}

/* ─── Smooth scroll helper ────────────────────────────────────────────── */

function smoothScrollTo(id: string) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

/* ─── CIG Icon (inline SVG) ───────────────────────────────────────────── */

const CigIconSvg: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="20 20 216 216" xmlns="http://www.w3.org/2000/svg" fill="none">
    <defs>
      <linearGradient id="graphGrad" x1="48" y1="40" x2="208" y2="208" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#2563EB"/>
        <stop offset="100%" stopColor="#14B8A6"/>
      </linearGradient>
      <linearGradient id="clawGrad" x1="96" y1="44" x2="160" y2="184" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#2563EB"/>
        <stop offset="55%" stopColor="#06B6D4"/>
        <stop offset="100%" stopColor="#22C55E"/>
      </linearGradient>
      <radialGradient id="coreGlow" cx="50%" cy="50%" r="60%">
        <stop offset="0%" stopColor="#ECFEFF"/>
        <stop offset="55%" stopColor="#A5F3FC"/>
        <stop offset="100%" stopColor="#22D3EE"/>
      </radialGradient>
      <filter id="iconShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#0F172A" floodOpacity="0.12"/>
      </filter>
    </defs>
    <g filter="url(#iconShadow)" transform="rotate(90 128 128)">
      <g stroke="url(#graphGrad)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" opacity="0.95">
        <line x1="128" y1="52" x2="74" y2="174"/>
        <line x1="128" y1="52" x2="182" y2="174"/>
        <line x1="74" y1="174" x2="128" y2="146"/>
        <line x1="128" y1="146" x2="182" y2="174"/>
        <line x1="74" y1="174" x2="182" y2="174"/>
      </g>
      <g fill="white" stroke="url(#graphGrad)" strokeWidth="6">
        <circle cx="128" cy="52" r="14"/>
        <circle cx="74" cy="174" r="14"/>
        <circle cx="182" cy="174" r="14"/>
        <circle cx="128" cy="146" r="18"/>
      </g>
      <g fill="url(#coreGlow)">
        <circle cx="128" cy="52" r="8"/>
        <circle cx="74" cy="174" r="8"/>
        <circle cx="182" cy="174" r="8"/>
        <circle cx="128" cy="146" r="11"/>
      </g>
      <rect x="118" y="58" width="20" height="54" rx="10" fill="url(#clawGrad)"/>
      <path d="M120 108 C101 118 90 140 94 164 C96 175 105 181 116 178 C110 165 111 139 120 108Z" fill="url(#clawGrad)" stroke="#0F3B8F" strokeOpacity="0.18" strokeWidth="2"/>
      <path d="M136 108 C155 118 166 140 162 164 C160 175 151 181 140 178 C146 165 145 139 136 108Z" fill="url(#clawGrad)" stroke="#0F3B8F" strokeOpacity="0.18" strokeWidth="2"/>
      <circle cx="128" cy="86" r="16" fill="white" stroke="url(#clawGrad)" strokeWidth="6"/>
      <circle cx="128" cy="86" r="8" fill="url(#coreGlow)"/>
    </g>
  </svg>
);

/* ─── Hero (animated icon + title sequence) ───────────────────────────── */

const PHASE_DURATION = 1600; // ms per phase
const PHASES = [
  { word: "Compute",      icon: "monitor" },
  { word: "Intelligence",  icon: "brain" },
  { word: "Graph",         icon: "graph" },
  { word: "all",           icon: "cig" },
] as const;

const HeroSection: React.FC = () => {
  const t = useTranslation();
  const [phase, setPhase] = useState(-1); // -1 = initial idle

  useEffect(() => {
    // Start sequence after a short entrance delay
    const start = setTimeout(() => setPhase(0), 800);
    return () => clearTimeout(start);
  }, []);

  useEffect(() => {
    if (phase < 0) return;
    const next = phase >= PHASES.length ? 0 : phase + 1;
    const delay = phase >= PHASES.length ? PHASE_DURATION : PHASE_DURATION;
    const timer = setTimeout(() => setPhase(next), delay);
    return () => clearTimeout(timer);
  }, [phase]);

  const activePhase = phase >= PHASES.length ? PHASES.length - 1 : phase;

  // Icon to show in the circle
  const renderIcon = () => {
    const cls = "size-14 transition-all duration-500";
    switch (PHASES[Math.min(Math.max(activePhase, 0), PHASES.length - 1)]?.icon) {
      case "monitor":
        return <Monitor className={cn(cls, "text-cyan-400")} strokeWidth={1.5} />;
      case "brain":
        return <BrainCircuit className={cn(cls, "text-emerald-400")} strokeWidth={1.5} />;
      case "graph":
        return <GitGraph className={cn(cls, "text-blue-400")} strokeWidth={1.5} />;
      case "cig":
        return <CigIconSvg className="size-24" />;
      default:
        return <Monitor className={cn(cls, "text-zinc-500")} strokeWidth={1.5} />;
    }
  };

  // Highlight color for each word (index-based for i18n)
  const wordColor = (idx: number) => {
    if (activePhase < 0) return undefined;
    const current = PHASES[activePhase];
    if (!current) return undefined;
    if (current.word === "all") return "from-cyan-300 via-emerald-300 to-blue-400";
    if (activePhase === idx) return "highlight";
    return undefined;
  };

  const titleKeys = ["hero.title.compute", "hero.title.intelligence", "hero.title.graph"] as const;

  return (
    <section
      id="hero"
      className="relative w-full min-h-[100vh] flex flex-col items-center justify-center text-center gap-8 px-4 py-20"
    >
      {/* Animated icon circle */}
      <div className="relative mb-2 animate-fade-in" style={{ animationDelay: "0.1s" }}>
        <span className="absolute inset-0 rounded-full bg-gradient-to-tr from-cyan-500 via-blue-500 to-violet-500 opacity-50 blur-2xl animate-glow" />
        <div className="relative flex items-center justify-center size-28 rounded-full border-2 border-zinc-200 dark:border-zinc-700/60 bg-white dark:bg-zinc-900 shadow-2xl z-10 overflow-hidden">
          <div key={activePhase} className="animate-fade-in-fast">
            {renderIcon()}
          </div>
        </div>
      </div>

      {/* Interactive graph-particle "CIG" text with space animation behind */}
      <div className="relative w-full max-w-lg h-[160px] overflow-visible animate-fade-in" style={{ animationDelay: "0.18s" }}>
        <div className="absolute -inset-x-12 -inset-y-16 pointer-events-none">
          <SpaceBackground
            particleCount={300}
            particleColor="rgba(34,211,238,0.35)"
            backgroundColor="transparent"
            contained
          />
        </div>
        <div className="absolute -inset-x-8 -inset-y-10 pointer-events-auto">
          <GraphParticleTypography
            text="CIG"
            className="h-full w-full text-cyan-400"
            fontSize={110}
            particleSize={1.8}
            particleDensity={4}
            connectionDistance={18}
            connectionOpacity={0.4}
            dispersionStrength={14}
            returnSpeed={0.08}
            color="#22d3ee"
          />
        </div>
      </div>

      <div
        className="flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 rounded-full px-4 py-1.5 bg-zinc-100/60 dark:bg-zinc-900/60 animate-fade-in"
        style={{ animationDelay: "0.25s" }}
      >
        <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
        {t("hero.badge")}
      </div>

      {/* Animated title */}
      <h1
        className="text-5xl md:text-7xl font-extrabold leading-[1.1] tracking-tight drop-shadow-lg animate-slide-up"
        style={{ animationDelay: "0.35s" }}
      >
        {titleKeys.map((key, i) => {
          const highlight = wordColor(i);
          const isAll = highlight && highlight !== "highlight";
          const isActive = highlight === "highlight";

          return (
            <React.Fragment key={key}>
              <span
                className={cn(
                  "inline-block transition-all duration-500",
                  isAll
                    ? "bg-gradient-to-r from-cyan-300 via-emerald-300 to-blue-400 bg-clip-text text-transparent"
                    : isActive
                      ? "text-emerald-400 drop-shadow-[0_0_24px_rgba(52,211,153,0.5)]"
                      : "bg-gradient-to-b from-zinc-800 to-zinc-500 dark:from-zinc-100 dark:to-zinc-400 bg-clip-text text-transparent"
                )}
              >
                {t(key)}
              </span>
              {i < titleKeys.length - 1 && (
                <>{i === 1 ? <br /> : " "}</>
              )}
            </React.Fragment>
          );
        })}
      </h1>

    <p
      className="text-lg md:text-xl text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto font-normal leading-relaxed animate-fade-in"
      style={{ animationDelay: "0.55s" }}
    >
      {(() => {
        const parts = t("hero.description", { highlight: "\x00" }).split("\x00");
        return <>{parts[0]}<span className="text-zinc-800 dark:text-zinc-200 font-medium">{t("hero.descHighlight")}</span>{parts[1]}</>;
      })()}
    </p>

    <div
      className="flex flex-wrap justify-center gap-4 mt-2 animate-fade-in"
      style={{ animationDelay: "0.7s" }}
    >
      <button
        onClick={() => smoothScrollTo("get-started")}
        className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-500/20 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-blue-500/30 focus:outline-none focus:ring-2 focus:ring-cyan-400 cursor-pointer"
      >
        {t("hero.getStarted")} <ArrowRight size={18} />
      </button>
      <a
        href="https://github.com/edwardcalderon/ComputeIntelligenceGraph"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-full border border-zinc-300 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/80 px-8 py-3.5 text-base font-semibold text-zinc-800 dark:text-zinc-200 shadow transition-all duration-300 hover:scale-105 hover:border-zinc-400 dark:hover:border-zinc-500 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-zinc-500"
      >
        <Github size={18} /> {t("hero.viewOnGithub")}
      </a>
    </div>

    {/* Scroll down indicator */}
    <button
      onClick={() => smoothScrollTo("how-it-works")}
      className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors duration-300 cursor-pointer animate-fade-in"
      style={{ animationDelay: "1s" }}
      aria-label="Scroll down"
    >
      <span className="text-xs font-medium tracking-widest uppercase">{t("hero.scroll")}</span>
      <ChevronDown size={20} className="animate-bounce-gentle" />
    </button>
  </section>
  );
};

/* ─── How It Works ────────────────────────────────────────────────────── */

interface Step {
  num: string;
  titleKey: string;
  descKey: string;
  icon: React.ReactNode;
}

const steps: Step[] = [
  { num: "01", titleKey: "howItWorks.step1.title", descKey: "howItWorks.step1.desc", icon: <Terminal size={24} className="text-cyan-400" /> },
  { num: "02", titleKey: "howItWorks.step2.title", descKey: "howItWorks.step2.desc", icon: <Search size={24} className="text-blue-400" /> },
  { num: "03", titleKey: "howItWorks.step3.title", descKey: "howItWorks.step3.desc", icon: <GitGraph size={24} className="text-violet-400" /> },
  { num: "04", titleKey: "howItWorks.step4.title", descKey: "howItWorks.step4.desc", icon: <MessageSquare size={24} className="text-emerald-400" /> },
];

const HowItWorks: React.FC = () => {
  const t = useTranslation();
  const { ref, visible } = useReveal<HTMLElement>();
  return (
    <section
      id="how-it-works"
      ref={ref}
      className={cn(
        "w-full flex flex-col items-center gap-10 transition-all duration-700",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
      )}
    >
      <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-center">
        {t("howItWorks.title")}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full">
        {steps.map((step, i) => (
          <div
            key={step.num}
            className={cn(
              "group relative rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-white/50 dark:bg-zinc-900/50 p-6 transition-all duration-500 hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-white/80 dark:hover:bg-zinc-900/80 hover:-translate-y-1 shadow-sm dark:shadow-none",
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            )}
            style={{
              transitionDelay: visible ? `${200 + i * 120}ms` : "0ms",
            }}
          >
            <div className="flex items-start gap-4">
              <div className="flex-none flex items-center justify-center size-12 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/50 group-hover:border-zinc-300 dark:group-hover:border-zinc-600 transition-colors duration-300">
                {step.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-zinc-500">
                    {step.num}
                  </span>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    {t(step.titleKey)}
                  </h3>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {t(step.descKey)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

/* ─── Features ────────────────────────────────────────────────────────── */

interface Feature {
  icon: React.ReactNode;
  titleKey: string;
  descKey: string;
}

const features: Feature[] = [
  { icon: <Cloud size={22} className="text-cyan-400" />, titleKey: "features.discovery.title", descKey: "features.discovery.desc" },
  { icon: <GitGraph size={22} className="text-blue-400" />, titleKey: "features.graph.title", descKey: "features.graph.desc" },
  { icon: <MessageSquare size={22} className="text-violet-400" />, titleKey: "features.chat.title", descKey: "features.chat.desc" },
  { icon: <Shield size={22} className="text-emerald-400" />, titleKey: "features.security.title", descKey: "features.security.desc" },
  { icon: <LayoutDashboard size={22} className="text-amber-400" />, titleKey: "features.dashboard.title", descKey: "features.dashboard.desc" },
  { icon: <Server size={22} className="text-rose-400" />, titleKey: "features.selfHosted.title", descKey: "features.selfHosted.desc" },
];

const FeaturesSection: React.FC = () => {
  const t = useTranslation();
  const { ref, visible } = useReveal<HTMLElement>();
  return (
    <section
      ref={ref}
      className={cn(
        "w-full flex flex-col items-center gap-10 transition-all duration-700",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
      )}
    >
      <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-center">
        {t("features.title")}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 w-full">
        {features.map((f, i) => (
          <div
            key={f.titleKey}
            className={cn(
              "rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-white/50 dark:bg-zinc-900/50 p-6 transition-all duration-500 hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-white/80 dark:hover:bg-zinc-900/80 hover:-translate-y-1 shadow-sm dark:shadow-none",
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            )}
            style={{
              transitionDelay: visible ? `${150 + i * 100}ms` : "0ms",
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center size-10 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/50">
                {f.icon}
              </div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                {t(f.titleKey)}
              </h3>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{t(f.descKey)}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

/* ─── Architecture Snippet ────────────────────────────────────────────── */

const ArchitectureBlock: React.FC = () => {
  const t = useTranslation();
  const { ref, visible } = useReveal<HTMLElement>();
  return (
    <section
      ref={ref}
      className={cn(
        "w-full rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-white/50 dark:bg-zinc-900/50 p-8 text-center transition-all duration-700 shadow-sm dark:shadow-none",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
      )}
    >
      <h2 className="text-2xl font-bold mb-6">{t("architecture.title")}</h2>
      <div className="flex flex-wrap items-center justify-center gap-3 text-sm font-mono text-zinc-700 dark:text-zinc-300">
        {[
          { label: t("architecture.setupWizard"), color: "border-cyan-500/40" },
          { label: "→" },
          { label: t("architecture.discoveryEngine"), color: "border-blue-500/40" },
          { label: "→" },
          { label: t("architecture.graphDB"), color: "border-violet-500/40" },
          { label: "→" },
          { label: t("architecture.dashboardChatbot"), color: "border-emerald-500/40" },
        ].map((item, i) =>
          item.color ? (
            <span
              key={i}
              className={cn(
                "rounded-lg border bg-zinc-100/60 dark:bg-zinc-800/60 px-4 py-2 transition-all duration-500 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60",
                item.color,
                visible ? "opacity-100 scale-100" : "opacity-0 scale-95"
              )}
              style={{ transitionDelay: visible ? `${300 + i * 80}ms` : "0ms" }}
            >
              {item.label}
            </span>
          ) : (
            <span
              key={i}
              className={cn(
                "text-zinc-400 dark:text-zinc-600 mx-1 transition-opacity duration-500",
                visible ? "opacity-100" : "opacity-0"
              )}
              style={{ transitionDelay: visible ? `${300 + i * 80}ms` : "0ms" }}
            >
              {item.label}
            </span>
          )
        )}
      </div>
      <p className="text-sm text-zinc-500 dark:text-zinc-500 mt-6 max-w-md mx-auto">
        {t("architecture.footer")}
      </p>
    </section>
  );
};

/* ─── Links / Resources ──────────────────────────────────────────────── */

interface ResourceLink {
  href: string;
  labelKey: string;
  icon: React.ReactNode;
}

const resourceLinks: ResourceLink[] = [
  { href: "https://github.com/edwardcalderon/ComputeIntelligenceGraph", labelKey: "resources.github", icon: <Github size={22} /> },
  { href: "#", labelKey: "resources.docs", icon: <BookOpen size={22} /> },
  { href: "#", labelKey: "resources.demo", icon: <LayoutDashboard size={22} /> },
];

const ResourcesBlock: React.FC = () => {
  const t = useTranslation();
  const { ref, visible } = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={cn(
        "flex flex-wrap justify-center gap-4 w-full transition-all duration-700",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      )}
    >
      {resourceLinks.map((link, i) => (
        <a
          key={link.labelKey}
          href={link.href}
          target={link.href.startsWith("http") ? "_blank" : undefined}
          rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
          className={cn(
            "flex items-center gap-2.5 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 px-7 py-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200 shadow transition-all duration-300 hover:scale-105 hover:border-zinc-300 dark:hover:border-zinc-500 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/80 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-cyan-400/50",
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}
          style={{ transitionDelay: visible ? `${i * 100}ms` : "0ms" }}
        >
          {link.icon}
          <span>{t(link.labelKey)}</span>
          <ChevronRight size={14} className="text-zinc-500" />
        </a>
      ))}
    </div>
  );
};

/* ─── Get Started (CTA) ──────────────────────────────────────────────── */

type SubmitState = "idle" | "loading" | "success" | "duplicate" | "error";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const GetStartedSection: React.FC = () => {
  const t = useTranslation();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [state, setState] = useState<SubmitState>("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  const { ref, visible } = useReveal<HTMLElement>();

  const validate = (val: string) => {
    if (!val.trim()) return "Please enter your email.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim()))
      return "Enter a valid email address.";
    return "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate(email);
    if (err) {
      setError(err);
      return;
    }
    setState("loading");
    setError("");
    inputRef.current?.blur();

    try {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { error: sbError } = await supabase
        .from("newsletter_subscriptions")
        .insert({ email: email.trim().toLowerCase(), source: "landing" });

      if (sbError) {
        if (sbError.code === "23505") {
          setState("duplicate");
        } else {
          setState("error");
        }
        return;
      }

      setState("success");
      setEmail("");
    } catch {
      setState("error");
    }
  };

  const handleReset = () => {
    setState("idle");
    setEmail("");
    setError("");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <section
      id="get-started"
      ref={ref}
      className={cn(
        "w-full flex flex-col items-center text-center gap-5 mt-4 relative scroll-mt-24 transition-all duration-700",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
      )}
    >
      <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
        {t("cta.title")}
      </h2>
      <p className="text-base text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
        {t("cta.desc")}
      </p>

      {state === "success" ? (
        <div className="flex flex-col items-center gap-4 mt-2 animate-fade-in-fast">
          <div className="flex items-center gap-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-6 py-4 rounded-2xl shadow">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-semibold">{t("auth.onTheList")}</span>
          </div>
          <button
            onClick={handleReset}
            className="text-xs text-zinc-500 hover:text-cyan-400 underline underline-offset-2 transition-colors duration-200 cursor-pointer"
          >
            {t("cta.addAnother")}
          </button>
        </div>
      ) : state === "duplicate" ? (
        <div className="flex flex-col items-center gap-4 mt-2 animate-fade-in-fast">
          <div className="flex items-center gap-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 px-6 py-4 rounded-2xl shadow">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
            </svg>
            <span className="text-sm font-semibold">{t("auth.alreadySubscribed")}</span>
          </div>
          <button
            onClick={handleReset}
            className="text-xs text-zinc-500 hover:text-cyan-400 underline underline-offset-2 transition-colors duration-200 cursor-pointer"
          >
            {t("cta.tryDifferent")}
          </button>
        </div>
      ) : (
        <>
          <form
            onSubmit={handleSubmit}
            className="flex w-full max-w-md gap-2.5 items-center justify-center mt-2"
          >
            <input
              ref={inputRef}
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError("");
                if (state === "error") setState("idle");
              }}
              placeholder={t("cta.placeholder")}
              disabled={state === "loading"}
              className={cn(
                "flex-1 rounded-full border px-5 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 transition-all duration-300 focus:outline-none shadow bg-white dark:bg-zinc-900 disabled:opacity-50",
                error || state === "error"
                  ? "border-red-500 focus:border-red-400"
                  : "border-zinc-300 dark:border-zinc-700 focus:border-cyan-400"
              )}
            />
            <button
              type="submit"
              disabled={!email.trim() || state === "loading"}
              className={cn(
                "inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-7 py-3 text-sm font-semibold text-white shadow-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-400",
                email.trim() && state !== "loading"
                  ? "hover:scale-105 hover:shadow-xl cursor-pointer opacity-100"
                  : "opacity-50 cursor-not-allowed"
              )}
            >
              {state === "loading" ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  {t("cta.subscribing")}
                </>
              ) : (
                t("cta.notifyMe")
              )}
            </button>
          </form>
          {error && (
            <span className="text-red-400 text-xs font-medium mt-1 animate-fade-in-fast">
              {error}
            </span>
          )}
          {state === "error" && !error && (
            <span className="text-red-400 text-xs font-medium mt-1 animate-fade-in-fast">
              {t("common.error")}
            </span>
          )}
        </>
      )}
    </section>
  );
};

/* ─── Footer ──────────────────────────────────────────────────────────── */

const Footer: React.FC = () => {
  const t = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  return (
    <footer className="relative w-full overflow-hidden border-t border-zinc-200 dark:border-zinc-800/50">
      <div className="absolute inset-0 pointer-events-none" style={{ opacity: isDark ? 0.5 : 0.35 }}>
        <DitheringShader
          width={1920}
          height={80}
          colorBack={isDark ? "#09090b" : "#fafafa"}
          colorFront={isDark ? "#22d3ee" : "#06b6d4"}
          shape="warp"
          type="8x8"
          pxSize={3}
          speed={0.3}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
      <div className="relative z-10 text-center text-xs text-zinc-500 dark:text-zinc-600 pt-8 pb-2">
        <p>{t("footer.copyright", { year: new Date().getFullYear() })}</p>
        <p
          className="mt-1 text-zinc-700"
          title={process.env.NEXT_PUBLIC_RELEASE_TAG || `v${process.env.NEXT_PUBLIC_APP_VERSION}`}
        >
          {t("common.version", { version: process.env.NEXT_PUBLIC_APP_VERSION || "" })}
          {process.env.NEXT_PUBLIC_APP_BUILD
            ? ` · ${t("common.build", { build: process.env.NEXT_PUBLIC_APP_BUILD })}`
            : ""}
        </p>
      </div>
    </footer>
  );
};

/* ─── Back to Top ─────────────────────────────────────────────────────── */

const BackToTop: React.FC = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to top"
      className={cn(
        "fixed bottom-6 right-6 z-40 flex items-center justify-center size-11 rounded-full border border-zinc-300 dark:border-zinc-700 bg-white/90 dark:bg-zinc-900/90 text-zinc-600 dark:text-zinc-300 shadow-lg backdrop-blur transition-all duration-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white hover:scale-110 hover:border-zinc-400 dark:hover:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 cursor-pointer",
        show
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 translate-y-4 pointer-events-none"
      )}
    >
      <ArrowUp size={18} />
    </button>
  );
};

/* ─── Page ────────────────────────────────────────────────────────────── */

// Public landing — safe to render without AuthProvider in scope
function PublicLanding() {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-zinc-50 via-white to-zinc-100 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 text-zinc-900 dark:text-zinc-50 relative overflow-x-hidden">
      {/* Top auth bar */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <LocaleSwitcher />
        <ThemeToggle />
        <AuthButton />
      </div>

      {/* Blob glows — both modes */}
      <div className="pointer-events-none fixed -top-40 -left-40 w-[600px] h-[600px] bg-gradient-to-tr from-cyan-600 via-blue-600 to-violet-600 opacity-[0.10] dark:opacity-[0.07] rounded-full blur-3xl animate-pulse-slow z-0" />
      <div className="pointer-events-none fixed -bottom-40 -right-40 w-[500px] h-[500px] bg-gradient-to-bl from-violet-600 via-blue-600 to-cyan-600 opacity-[0.08] dark:opacity-[0.05] rounded-full blur-3xl animate-pulse-slow z-0" />

      <div className="relative w-full max-w-4xl mx-auto flex flex-col items-center gap-24 z-10">
        <HeroSection />
        <HowItWorks />
        <FeaturesSection />
        <ArchitectureBlock />
        <ResourcesBlock />
        <GetStartedSection />
        <Footer />
      </div>

      <BackToTop />
    </div>
  );
}

export default function HomePage() {
  const { user, signOut } = useCIGAuth();

  // Normalize logout entrypoints so both dashboard-initiated sign-out and the
  // final landing redirect end on the clean unauthenticated home page.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("signout") === "1") {
      window.history.replaceState({}, "", window.location.pathname);
      signOut();
      return;
    }
    if (params.get("logged_out") === "1") {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [signOut]);

  if (user) return <AuthenticatedLanding />;
  return <PublicLanding />;
}
