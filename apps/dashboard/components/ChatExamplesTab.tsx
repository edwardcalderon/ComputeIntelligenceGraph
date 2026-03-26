"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Send } from "lucide-react";
import {
  AlertCard,
  AlertStrip,
  BarChartCard,
  GaugeCard,
  SparklineCard,
  TimelineCard,
} from "@cig/ui";
import { useTranslation } from "@cig-technology/i18n/react";

type TemplateDefinition = {
  id: string;
  lane: "ops" | "sales" | "trace";
  badge: string;
  title: string;
  summary: string;
  prompt: string;
  preview: React.ReactNode;
};

// ─── Demo data ────────────────────────────────────────────────────────────────

const ALERT_ITEMS = [
  { severity: "critical" as const, title: "Stock crítico", subtitle: "2 productos bajo mínimo", value: 2 },
  { severity: "critical" as const, title: "Pedido bloqueado", subtitle: "PED-8821 · crédito insuf.", value: 1 },
  { severity: "attention" as const, title: "Créditos mora", subtitle: "13 casos · $37.4M", value: 13 },
  { severity: "partial" as const, title: "Meta diciembre", subtitle: "76% completada", value: "76%" },
  { severity: "ok" as const, title: "Pedidos en tránsito", subtitle: "Todo operando normal", value: 12 },
];

const SALES_KPIS = [
  { value: "$84.2M", label: "Total acum.", variant: "neutral" as const },
  { value: "+12.4%", label: "vs sem. ant.", variant: "positive" as const },
  { value: "$12.0M", label: "Mejor día", variant: "warning" as const },
];

const SALES_POINTS = [40, 35, 28, 32, 18, 10, 14, 7];

const SALES_CHANNELS = [
  { name: "Online", points: [88, 91, 94, 93, 97, 98, 97], direction: "up" as const, delta: "18%", color: "#6C3DE8" },
  { name: "Presencial", points: [95, 93, 91, 92, 89, 91, 87], direction: "down" as const, delta: "5%", color: "#EF9F27" },
  { name: "B2B", points: [90, 92, 94, 95, 95, 97, 98], direction: "up" as const, delta: "22%", color: "#1D9E75" },
];

const GAUGE_DETAIL = [
  { label: "Logrado", value: "$38.0M / $50.0M", valueColor: "green" as const },
  { label: "Días restantes", value: "8 días hábiles", valueColor: "navy" as const },
  { label: "Ritmo necesario", value: "$1.5M / día", valueColor: "amber" as const },
  { label: "Ritmo actual", value: "$1.6M / día ↑", valueColor: "green" as const },
];

const TIMELINE_EVENTS = [
  { time: "08:41", source: "Sistema", title: "PED-8821 creado", description: "Cliente: Dist. Andina · $6.8M", type: "start" as const },
  { time: "08:41", source: "Motor de crédito", title: "Validación de crédito", description: "Saldo disponible: $3.2M — Mínimo: $5.0M", type: "process" as const },
  { time: "08:41", source: "Automático", title: "Límite de crédito insuficiente", description: "Regla CAR-04 §2.3 — diferencia: −$1.8M", type: "error" as const },
  { time: "08:42", source: "Notificación", title: "Escalado a Gerente de zona", description: "Pendiente aprobación manual o ajuste de cupo.", type: "pending" as const },
];

const BAR_ROWS = [
  { label: "Online", percent: 72, displayValue: "72%", color: "#6C3DE8" },
  { label: "Presencial", percent: 44, displayValue: "44%", color: "#9F77F5" },
  { label: "B2B", percent: 58, displayValue: "58%", color: "#378ADD" },
  { label: "Mayorista", percent: 31, displayValue: "31%", color: "#EF9F27" },
];

const TEMPLATE_SECTIONS = [
  {
    id: "ops" as const,
    label: "Operations",
    description: "Health, alerts, and daily execution.",
  },
  {
    id: "sales" as const,
    label: "Revenue",
    description: "Revenue pace, goals, and channel mix.",
  },
  {
    id: "trace" as const,
    label: "Traceability",
    description: "Root cause and key event tracing.",
  },
] satisfies Array<{ id: TemplateDefinition["lane"]; label: string; description: string }>;

const ALL_SECTION = {
  id: "all" as const,
  label: "All templates",
  description: "Reusable prompts for the main chat workflows.",
};

const TEMPLATE_DEFINITIONS: TemplateDefinition[] = [
  {
    id: "alerts-today",
    lane: "ops",
    badge: "Alertas",
    title: "Resumen de alertas de hoy",
    summary: "Trae un strip ejecutivo con el balance crítico, atención y estado normal.",
    prompt: "resumen alertas hoy",
    preview: (
      <AlertCard
        title="Panel de alertas"
        timestamp="Ahora"
        items={ALERT_ITEMS}
        showFeedback={false}
      />
    ),
  },
  {
    id: "sales-last-7-days",
    lane: "sales",
    badge: "Tendencia",
    title: "Ventas de los últimos 7 días",
    summary: "Compara el pulso de ventas por canal y resalta la dirección semanal.",
    prompt: "ventas últimos 7 días",
    preview: (
      <SparklineCard
        title="ERP · Ventas · Tendencia"
        period="7 días"
        kpis={SALES_KPIS}
        mainPoints={SALES_POINTS}
        showDayLabels
        channels={SALES_CHANNELS}
        showFeedback={false}
      />
    ),
  },
  {
    id: "monthly-goal",
    lane: "sales",
    badge: "Meta",
    title: "¿Cómo vamos con la meta?",
    summary: "Muestra avance, ritmo necesario y ritmo real de la meta comercial.",
    prompt: "¿cómo vamos con la meta?",
    preview: (
      <GaugeCard
        title="ERP · Meta mensual"
        period="Dic 2024"
        percent={76}
        sublabel="de la meta"
        detail={GAUGE_DETAIL}
        showFeedback={false}
      />
    ),
  },
  {
    id: "blocked-order",
    lane: "trace",
    badge: "Trazabilidad",
    title: "¿Por qué se bloqueó el pedido 8821?",
    summary: "Explica el evento, la regla aplicada y el siguiente paso operativo.",
    prompt: "¿por qué se bloqueó el pedido 8821?",
    preview: (
      <TimelineCard
        title="ERP · Trazabilidad · PED-8821"
        rightLabel="Bloqueado"
        events={TIMELINE_EVENTS}
        causeBox="Saldo disponible $3.2M · Límite requerido $5.0M · Política CAR-04 §2.3"
        kmsQuote="Requiere aprobación del gerente de zona antes de aplicar."
        showFeedback={false}
      />
    ),
  },
  {
    id: "sales-by-channel",
    lane: "sales",
    badge: "Distribución",
    title: "Distribución de ventas por canal",
    summary: "Entrega el mix comercial y el peso de cada canal en el total acumulado.",
    prompt: "distribución de ventas por canal",
    preview: (
      <BarChartCard
        title="ERP · Ventas · Canales"
        period="Nov 2024"
        bigNumber="$84.2M"
        bigLabel="Total acumulado"
        delta="12%"
        deltaDirection="up"
        rows={BAR_ROWS}
        showFeedback={false}
      />
    ),
  },
];

function TemplateCard({
  template,
  laneLabel,
  triggerLabel,
  actionLabel,
  onUseTemplate,
}: {
  template: TemplateDefinition;
  laneLabel: string;
  triggerLabel: string;
  actionLabel: string;
  onUseTemplate: (prompt: string) => void;
}) {
  return (
    <article className="flex h-full min-w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] snap-center flex-col overflow-hidden rounded-[24px] border border-slate-200/85 bg-white/92 shadow-[0_18px_42px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-zinc-700/55 dark:bg-zinc-950/72 dark:shadow-[0_18px_42px_rgba(0,0,0,0.22)] sm:min-w-[21rem] sm:max-w-[21rem] sm:snap-start">
      <div className="border-b border-slate-200/70 bg-[radial-gradient(circle_at_top_left,rgba(108,61,232,0.12),transparent_45%),radial-gradient(circle_at_top_right,rgba(29,158,117,0.10),transparent_42%)] px-3 py-3 dark:border-zinc-800/70 sm:px-4 sm:py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-slate-200/80 bg-white/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:border-zinc-700/60 dark:bg-zinc-900/70 dark:text-zinc-400">
                {laneLabel}
              </span>
              <span className="inline-flex items-center rounded-full border border-violet-200/80 bg-violet-500/8 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-700 dark:border-violet-400/30 dark:bg-violet-400/10 dark:text-violet-300">
                {template.badge}
              </span>
            </div>
            <h3 className="mt-2 text-sm font-semibold text-slate-900 dark:text-zinc-100">
              {template.title}
            </h3>
            <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-slate-500 dark:text-zinc-400">
              {template.summary}
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/78 px-3 py-2.5 dark:border-zinc-700/60 dark:bg-zinc-900/70">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-zinc-500">
              {triggerLabel}
            </p>
            <p className="truncate text-[12px] font-medium italic text-slate-700 dark:text-zinc-200">
              &ldquo;{template.prompt}&rdquo;
            </p>
          </div>

          <button
            type="button"
            onClick={() => onUseTemplate(template.prompt)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-violet-300/60 bg-violet-500/8 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-700 transition-colors hover:bg-violet-500/14 dark:border-violet-400/30 dark:bg-violet-400/10 dark:text-violet-300 dark:hover:bg-violet-400/16"
          >
            <Send className="h-3.5 w-3.5" />
            {actionLabel}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 px-3 py-3 sm:px-4">
        <div className="h-[10.75rem] overflow-hidden rounded-[20px] sm:h-[13.75rem]">
          {template.preview}
        </div>
      </div>
    </article>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ChatTemplatesTab({
  onUseTemplate,
}: {
  onUseTemplate: (prompt: string) => void;
}) {
  const t = useTranslation();
  const carouselRef = useRef<HTMLDivElement>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const [activeLane, setActiveLane] = useState<typeof ALL_SECTION.id | TemplateDefinition["lane"]>("all");
  const [activeTemplateIndex, setActiveTemplateIndex] = useState(0);
  const triggerLabel = t("chat.exampleTrigger");
  const actionLabel = t("chat.useTemplate");
  const availableSections = [ALL_SECTION, ...TEMPLATE_SECTIONS];
  const visibleTemplates =
    activeLane === "all"
      ? TEMPLATE_DEFINITIONS
      : TEMPLATE_DEFINITIONS.filter((template) => template.lane === activeLane);
  const activeSection =
    availableSections.find((section) => section.id === activeLane) ?? ALL_SECTION;

  function scrollCarouselTo(left: number) {
    const node = carouselRef.current;
    if (!node) {
      return;
    }
    if (typeof node.scrollTo === "function") {
      node.scrollTo({ left, behavior: "smooth" });
      return;
    }
    node.scrollLeft = left;
  }

  function updateActiveTemplateIndex() {
    const node = carouselRef.current;
    if (!node || visibleTemplates.length === 0) {
      return;
    }

    const children = Array.from(node.children) as HTMLElement[];
    if (children.length === 0) {
      return;
    }

    const viewportCenter = node.scrollLeft + node.clientWidth / 2;
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    children.forEach((child, index) => {
      const childCenter = child.offsetLeft + child.offsetWidth / 2;
      const distance = Math.abs(childCenter - viewportCenter);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    setActiveTemplateIndex((current) => (current === nearestIndex ? current : nearestIndex));
  }

  function shiftCarousel(direction: "prev" | "next") {
    const node = carouselRef.current;
    if (!node) {
      return;
    }
    const delta = Math.max(node.clientWidth * 0.8, 280) * (direction === "next" ? 1 : -1);
    if (typeof node.scrollBy === "function") {
      node.scrollBy({ left: delta, behavior: "smooth" });
      return;
    }
    node.scrollLeft += delta;
  }

  function goToTemplate(index: number) {
    const node = carouselRef.current;
    if (!node) {
      return;
    }

    const child = node.children.item(index) as HTMLElement | null;
    if (!child) {
      return;
    }

    const targetLeft = Math.max(0, child.offsetLeft - (node.clientWidth - child.offsetWidth) / 2);
    scrollCarouselTo(targetLeft);
  }

  function handleCarouselScroll() {
    if (typeof window === "undefined") {
      return;
    }

    if (scrollFrameRef.current !== null) {
      window.cancelAnimationFrame(scrollFrameRef.current);
    }

    scrollFrameRef.current = window.requestAnimationFrame(() => {
      updateActiveTemplateIndex();
      scrollFrameRef.current = null;
    });
  }

  useEffect(() => {
    scrollCarouselTo(0);
    setActiveTemplateIndex(0);
  }, [activeLane]);

  useEffect(() => {
    return () => {
      if (scrollFrameRef.current !== null && typeof window !== "undefined") {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
    };
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto overflow-x-hidden overscroll-contain" style={{ scrollbarWidth: "thin" }}>
      <div className="flex-shrink-0">
        <AlertStrip critical={2} attention={2} />
      </div>

      <div className="border-b border-slate-200/80 px-4 pb-4 pt-4 dark:border-zinc-800/70 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold text-slate-700 dark:text-zinc-200">
              {t("chat.examplesTitle")}
            </p>
            <p className="mt-0.5 max-w-xl text-[10px] leading-relaxed text-slate-400 dark:text-zinc-500">
              {t("chat.examplesSubtitle")}
            </p>
          </div>
          <div className="inline-flex items-center rounded-full border border-slate-200/80 bg-white/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:border-zinc-700/60 dark:bg-zinc-900/70 dark:text-zinc-400">
            {visibleTemplates.length} ready
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {availableSections.map((section) => {
            const count =
              section.id === "all"
                ? TEMPLATE_DEFINITIONS.length
                : TEMPLATE_DEFINITIONS.filter((template) => template.lane === section.id).length;
            const active = section.id === activeLane;

            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveLane(section.id)}
                className={[
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] transition-colors",
                  active
                    ? "border-violet-300/70 bg-violet-500/10 text-violet-700 dark:border-violet-400/35 dark:bg-violet-400/12 dark:text-violet-300"
                    : "border-slate-200/80 bg-white/75 text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:border-zinc-700/60 dark:bg-zinc-900/70 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-200",
                ].join(" ")}
              >
                <span>{section.label}</span>
                <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[9px] dark:bg-white/5">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 px-3 pb-4 pt-4 sm:px-4">
        <div className="flex h-full flex-col rounded-[26px] border border-slate-200/75 bg-white/76 shadow-[0_14px_35px_rgba(15,23,42,0.06)] backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-950/45 dark:shadow-[0_14px_35px_rgba(0,0,0,0.18)]">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200/75 px-4 py-3 dark:border-zinc-800/75">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-zinc-500">
                {activeSection.label}
              </p>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">
                {activeSection.description}
              </p>
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <button
                type="button"
                aria-label="Previous templates"
                onClick={() => shiftCarousel("prev")}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200/80 bg-white/80 text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700 dark:border-zinc-700/60 dark:bg-zinc-900/70 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-200"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Next templates"
                onClick={() => shiftCarousel("next")}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200/80 bg-white/80 text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700 dark:border-zinc-700/60 dark:bg-zinc-900/70 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-200"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div
            ref={carouselRef}
            data-testid="chat-templates-carousel"
            onScroll={handleCarouselScroll}
            className="flex min-h-0 flex-1 snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden px-4 py-4 pb-3 touch-pan-x sm:gap-4 sm:pb-5"
            style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch", scrollPaddingInline: "1rem" }}
          >
            {visibleTemplates.map((template) => {
              const section = TEMPLATE_SECTIONS.find((item) => item.id === template.lane);
              return (
                <TemplateCard
                  key={template.id}
                  template={template}
                  laneLabel={section?.label ?? template.lane}
                  triggerLabel={triggerLabel}
                  actionLabel={actionLabel}
                  onUseTemplate={onUseTemplate}
                />
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-2 px-4 pb-4 pt-1 sm:hidden">
            {visibleTemplates.map((template, index) => {
              const active = index === activeTemplateIndex;

              return (
                <button
                  key={template.id}
                  type="button"
                  aria-label={`Go to template ${index + 1} of ${visibleTemplates.length}`}
                  aria-current={active ? "true" : undefined}
                  onClick={() => goToTemplate(index)}
                  className={[
                    "h-2.5 rounded-full transition-all duration-200",
                    active
                      ? "w-6 bg-violet-500/80 shadow-[0_0_0_4px_rgba(108,61,232,0.10)]"
                      : "w-2.5 bg-slate-300/90 dark:bg-zinc-600/80",
                  ].join(" ")}
                >
                  <span className="sr-only">{template.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
