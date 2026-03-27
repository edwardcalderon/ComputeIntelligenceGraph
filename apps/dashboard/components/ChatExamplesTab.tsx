"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Info,
  SendHorizonal,
  LayoutTemplate,
} from "lucide-react";
import {
  AlertCard,
  AlertStrip,
  BarChartCard,
  GaugeCard,
  SparklineCard,
  TimelineCard,
} from "@cig/ui";
import { useTranslation } from "@cig-technology/i18n/react";
import {
  CHAT_TEMPLATES,
  LANE_META,
  getActiveLanes,
  getTemplatesByLane,
  type ChatTemplate,
  type TemplateLane,
} from "../lib/chatTemplates";

// ─── Preview registry ─────────────────────────────────────────────────────────
// Maps template IDs to their preview React node. Keep in sync with CHAT_TEMPLATES.

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

const TEMPLATE_PREVIEWS: Record<string, React.ReactNode> = {
  "alerts-today": (
    <AlertCard title="Panel de alertas" timestamp="Ahora" items={ALERT_ITEMS} showFeedback={false} />
  ),
  "sales-last-7-days": (
    <SparklineCard
      title="ERP · Ventas · Tendencia"
      period="7 días"
      kpis={SALES_KPIS}
      mainPoints={[40, 35, 28, 32, 18, 10, 14, 7]}
      showDayLabels
      channels={SALES_CHANNELS}
      showFeedback={false}
    />
  ),
  "monthly-goal": (
    <GaugeCard
      title="ERP · Meta mensual"
      period="Dic 2024"
      percent={76}
      sublabel="de la meta"
      detail={GAUGE_DETAIL}
      showFeedback={false}
    />
  ),
  "blocked-order": (
    <TimelineCard
      title="ERP · Trazabilidad · PED-8821"
      rightLabel="Bloqueado"
      events={TIMELINE_EVENTS}
      causeBox="Saldo disponible $3.2M · Límite requerido $5.0M · Política CAR-04 §2.3"
      kmsQuote="Requiere aprobación del gerente de zona antes de aplicar."
      showFeedback={false}
    />
  ),
  "sales-by-channel": (
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
};

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function Tooltip({ content, children }: { content: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  function handleMouseEnter(e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPos({ x: rect.left + rect.width / 2, y: rect.top });
    setVisible(true);
  }

  return (
    <>
      <div onMouseEnter={handleMouseEnter} onMouseLeave={() => setVisible(false)} className="inline-flex">
        {children}
      </div>
      {visible && (
        <div
          className="pointer-events-none fixed z-[9999] -translate-x-1/2 -translate-y-full pb-2"
          style={{ left: pos.x, top: pos.y }}
        >
          <div className="max-w-[14rem] rounded-xl border border-zinc-200/80 bg-white/95 px-3 py-2 text-center text-[11px] leading-relaxed text-zinc-700 shadow-[0_8px_24px_rgba(0,0,0,0.12)] backdrop-blur-sm dark:border-zinc-700/80 dark:bg-zinc-900/95 dark:text-zinc-200 dark:shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
            {content}
            <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-white/95 dark:border-t-zinc-900/95" />
          </div>
        </div>
      )}
    </>
  );
}

// ─── Quick-select dropdown ─────────────────────────────────────────────────────

function TemplateDropdown({
  onUseTemplate,
  triggerLabel,
  activeLane,
  onLaneChange,
}: {
  onUseTemplate: (prompt: string) => void;
  triggerLabel: string;
  activeLane: TemplateLane | null;
  onLaneChange: (lane: TemplateLane | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState<{ top: number; right: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const activeLanes = getActiveLanes();
  const filtered = activeLane ? getTemplatesByLane(activeLane) : CHAT_TEMPLATES;

  function openDropdown() {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setDropPos({
      top: rect.bottom + 6,
      right: Math.max(8, window.innerWidth - rect.right),
    });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <div ref={wrapperRef}>
      <Tooltip content="Browse all templates">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => (open ? setOpen(false) : openDropdown())}
          className={[
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] transition-all duration-200",
            open
              ? "border-violet-300/70 bg-violet-500/10 text-violet-700 dark:border-violet-400/35 dark:bg-violet-400/12 dark:text-violet-300"
              : "border-slate-200/80 bg-white/75 text-slate-500 hover:scale-105 hover:border-slate-300 hover:text-slate-700 dark:border-zinc-700/60 dark:bg-zinc-900/70 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-200",
          ].join(" ")}
        >
          <LayoutTemplate className="h-3 w-3" />
          <span className="hidden sm:inline">{CHAT_TEMPLATES.length} templates</span>
          <span className="sm:hidden">{CHAT_TEMPLATES.length}</span>
          <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </button>
      </Tooltip>

      {open && dropPos && (
        <div
          className="fixed z-[9999] w-[min(18rem,calc(100vw-16px))] overflow-hidden rounded-2xl border border-slate-200/80 bg-white/98 shadow-[0_16px_40px_rgba(15,23,42,0.14)] backdrop-blur-xl dark:border-zinc-700/70 dark:bg-zinc-950/98 dark:shadow-[0_16px_40px_rgba(0,0,0,0.5)]"
          style={{ top: dropPos.top, right: dropPos.right }}
        >
          {/* Lane filter row */}
          <div className="flex flex-wrap gap-1.5 border-b border-slate-200/70 px-3 py-2 dark:border-zinc-800/70">
            <button
              type="button"
              onClick={() => onLaneChange(null)}
              className={`rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] transition-colors ${
                activeLane === null
                  ? "bg-violet-500/10 text-violet-700 dark:bg-violet-400/12 dark:text-violet-300"
                  : "text-slate-400 hover:text-slate-600 dark:text-zinc-600 dark:hover:text-zinc-400"
              }`}
            >
              All
            </button>
            {activeLanes.map((lane) => (
              <button
                key={lane}
                type="button"
                onClick={() => onLaneChange(lane === activeLane ? null : lane)}
                className={`rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] transition-colors ${
                  activeLane === lane
                    ? "bg-violet-500/10 text-violet-700 dark:bg-violet-400/12 dark:text-violet-300"
                    : "text-slate-400 hover:text-slate-600 dark:text-zinc-600 dark:hover:text-zinc-400"
                }`}
              >
                {LANE_META[lane].label}
              </button>
            ))}
          </div>

          {/* Template list */}
          <ul className="max-h-64 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
            {filtered.map((template) => (
              <li key={template.id}>
                <button
                  type="button"
                  onClick={() => { onUseTemplate(template.prompt); setOpen(false); }}
                  className="group flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-slate-50/80 dark:hover:bg-zinc-900/60"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-violet-200/70 bg-violet-500/8 text-violet-600 transition-colors group-hover:border-violet-300/70 group-hover:bg-violet-500/12 dark:border-violet-400/25 dark:bg-violet-400/10 dark:text-violet-300">
                    <SendHorizonal className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold leading-snug text-slate-800 dark:text-zinc-100">
                      {template.title}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-[10px] text-slate-400 dark:text-zinc-500">
                      {template.summary}
                    </p>
                  </div>
                  <span className="ml-auto shrink-0 rounded-full border border-slate-200/70 px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-slate-400 dark:border-zinc-700/60 dark:text-zinc-600">
                    {LANE_META[template.lane].label}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="border-t border-slate-200/70 px-3 py-2 dark:border-zinc-800/70">
            <p className="text-[9px] text-slate-400 dark:text-zinc-600">
              {triggerLabel} • {filtered.length} of {CHAT_TEMPLATES.length} shown
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Template Card ─────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  laneLabel,
  triggerLabel,
  actionLabel,
  onUseTemplate,
}: {
  template: ChatTemplate;
  laneLabel: string;
  triggerLabel: string;
  actionLabel: string;
  onUseTemplate: (prompt: string) => void;
}) {
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const preview = TEMPLATE_PREVIEWS[template.id];
  const previewHeight = previewExpanded ? "max-h-[28rem]" : "max-h-[13rem] sm:max-h-[15rem]";

  return (
    <article className="group flex min-w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] snap-center flex-col overflow-hidden rounded-[24px] border border-slate-200/85 bg-white/92 shadow-[0_18px_42px_rgba(15,23,42,0.08)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-violet-300/40 hover:shadow-[0_24px_56px_rgba(15,23,42,0.12)] dark:border-zinc-700/55 dark:bg-zinc-950/72 dark:shadow-[0_18px_42px_rgba(0,0,0,0.22)] dark:hover:border-violet-400/25 dark:hover:shadow-[0_24px_56px_rgba(0,0,0,0.38)] sm:min-w-[21rem] sm:max-w-[21rem] sm:snap-start">
      {/* Header */}
      <div className="border-b border-slate-200/70 bg-[radial-gradient(circle_at_top_left,rgba(108,61,232,0.12),transparent_45%),radial-gradient(circle_at_top_right,rgba(29,158,117,0.10),transparent_42%)] px-3 py-3 transition-colors group-hover:bg-[radial-gradient(circle_at_top_left,rgba(108,61,232,0.16),transparent_45%),radial-gradient(circle_at_top_right,rgba(29,158,117,0.14),transparent_42%)] dark:border-zinc-800/70 sm:px-4 sm:py-4">
        <div className="flex flex-wrap items-start gap-2">
          <Tooltip content={`Category: ${laneLabel}`}>
            <span className="inline-flex cursor-default items-center rounded-full border border-slate-200/80 bg-white/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 transition-colors hover:bg-white dark:border-zinc-700/60 dark:bg-zinc-900/70 dark:text-zinc-400">
              {laneLabel}
            </span>
          </Tooltip>
          <Tooltip content={`Type: ${template.badge}`}>
            <span className="inline-flex cursor-default items-center rounded-full border border-violet-200/80 bg-violet-500/8 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-700 transition-colors hover:bg-violet-500/12 dark:border-violet-400/30 dark:bg-violet-400/10 dark:text-violet-300">
              {template.badge}
            </span>
          </Tooltip>
        </div>
        <h3 className="mt-2 text-sm font-semibold text-slate-900 dark:text-zinc-100">
          {template.title}
        </h3>
        <Tooltip content={template.summary}>
          <p className="mt-1 line-clamp-2 max-w-xl cursor-default text-[11px] leading-relaxed text-slate-500 dark:text-zinc-400">
            {template.summary}
            <Info className="ml-1 inline h-3 w-3 opacity-40" />
          </p>
        </Tooltip>

        {/* Prompt trigger row */}
        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/78 px-3 py-2.5 transition-colors hover:border-slate-300/80 hover:bg-white/90 dark:border-zinc-700/60 dark:bg-zinc-900/70 dark:hover:border-zinc-600/60">
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
            className="group/btn inline-flex shrink-0 items-center gap-1.5 rounded-full border border-violet-300/60 bg-violet-500/8 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-700 transition-all duration-200 hover:scale-105 hover:border-violet-400/80 hover:bg-violet-500/14 hover:shadow-[0_0_14px_rgba(109,40,217,0.22)] active:scale-95 dark:border-violet-400/30 dark:bg-violet-400/10 dark:text-violet-300 dark:hover:bg-violet-400/16"
          >
            <SendHorizonal className="h-3.5 w-3.5 transition-transform duration-200 group-hover/btn:translate-x-0.5" />
            {actionLabel}
          </button>
        </div>
      </div>

      {/* Preview */}
      {preview != null && (
        <div className="flex min-h-0 flex-col px-3 py-3 sm:px-4">
          <div
            className={`relative overflow-y-auto overscroll-contain rounded-[20px] transition-all duration-300 ${previewHeight}`}
            style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(139,92,246,0.2) transparent" }}
          >
            {preview}
            {!previewExpanded && (
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-10 rounded-b-[20px] bg-gradient-to-t from-white/90 to-transparent dark:from-zinc-950/90"
                aria-hidden="true"
              />
            )}
          </div>

          <button
            type="button"
            onClick={() => setPreviewExpanded((v) => !v)}
            className="mx-auto mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium text-slate-400 transition-all hover:bg-slate-100/80 hover:text-slate-600 dark:text-zinc-600 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-400"
          >
            {previewExpanded ? (
              <><ChevronUp className="h-3 w-3" />Collapse</>
            ) : (
              <><ChevronDown className="h-3 w-3" />Expand preview</>
            )}
          </button>
        </div>
      )}
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
  const [activeLane, setActiveLane] = useState<TemplateLane | null>(null);
  const [activeTemplateIndex, setActiveTemplateIndex] = useState(0);
  const triggerLabel = t("chat.exampleTrigger");
  const actionLabel = t("chat.useTemplate");

  const visibleTemplates = getTemplatesByLane(activeLane);
  const activeSection = activeLane ? LANE_META[activeLane] : { label: "All templates", description: "Reusable prompts for the main chat workflows." };

  function scrollCarouselTo(left: number) {
    const node = carouselRef.current;
    if (!node) return;
    if (typeof node.scrollTo === "function") { node.scrollTo({ left, behavior: "smooth" }); return; }
    node.scrollLeft = left;
  }

  function updateActiveTemplateIndex() {
    const node = carouselRef.current;
    if (!node || visibleTemplates.length === 0) return;
    const children = Array.from(node.children) as HTMLElement[];
    if (children.length === 0) return;
    const viewportCenter = node.scrollLeft + node.clientWidth / 2;
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    children.forEach((child, index) => {
      const childCenter = child.offsetLeft + child.offsetWidth / 2;
      const distance = Math.abs(childCenter - viewportCenter);
      if (distance < nearestDistance) { nearestDistance = distance; nearestIndex = index; }
    });
    setActiveTemplateIndex((current) => (current === nearestIndex ? current : nearestIndex));
  }

  function shiftCarousel(direction: "prev" | "next") {
    const node = carouselRef.current;
    if (!node) return;
    const delta = Math.max(node.clientWidth * 0.8, 280) * (direction === "next" ? 1 : -1);
    if (typeof node.scrollBy === "function") { node.scrollBy({ left: delta, behavior: "smooth" }); return; }
    node.scrollLeft += delta;
  }

  function goToTemplate(index: number) {
    const node = carouselRef.current;
    if (!node) return;
    const child = node.children.item(index) as HTMLElement | null;
    if (!child) return;
    scrollCarouselTo(Math.max(0, child.offsetLeft - (node.clientWidth - child.offsetWidth) / 2));
  }

  function handleCarouselScroll() {
    if (typeof window === "undefined") return;
    if (scrollFrameRef.current !== null) window.cancelAnimationFrame(scrollFrameRef.current);
    scrollFrameRef.current = window.requestAnimationFrame(() => {
      updateActiveTemplateIndex();
      scrollFrameRef.current = null;
    });
  }

  useEffect(() => { scrollCarouselTo(0); setActiveTemplateIndex(0); }, [activeLane]);

  useEffect(() => {
    return () => {
      if (scrollFrameRef.current !== null && typeof window !== "undefined") {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
    };
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ── Scrollable content ───────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain" style={{ scrollbarWidth: "thin" }}>
      <div className="flex-shrink-0">
        <AlertStrip critical={2} attention={2} />
      </div>

      {/* Header */}
      <div className="flex-shrink-0 border-b border-slate-200/80 px-4 pb-4 pt-4 dark:border-zinc-800/70 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold text-slate-700 dark:text-zinc-200">
              {t("chat.examplesTitle")}
            </p>
            <p className="mt-0.5 max-w-xl text-[10px] leading-relaxed text-slate-400 dark:text-zinc-500">
              {t("chat.examplesSubtitle")}
            </p>
          </div>
          {/* Template dropdown — handles lane filtering + quick-select */}
          <TemplateDropdown
            onUseTemplate={onUseTemplate}
            triggerLabel={triggerLabel}
            activeLane={activeLane}
            onLaneChange={setActiveLane}
          />
        </div>
      </div>

      {/* Carousel */}
      <div className="min-h-0 flex-1 px-3 pb-4 pt-4 sm:px-4">
        <div className="flex min-h-0 flex-1 flex-col rounded-[26px] border border-slate-200/75 bg-white/76 shadow-[0_14px_35px_rgba(15,23,42,0.06)] backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-950/45 dark:shadow-[0_14px_35px_rgba(0,0,0,0.18)]">
          <div className="flex flex-shrink-0 flex-wrap items-start justify-between gap-3 border-b border-slate-200/75 px-4 py-3 dark:border-zinc-800/75">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-zinc-500">
                {activeSection.label}
              </p>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">
                {activeSection.description}
              </p>
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <Tooltip content="Previous template">
                <button
                  type="button"
                  aria-label="Previous templates"
                  onClick={() => shiftCarousel("prev")}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200/80 bg-white/80 text-slate-500 transition-all duration-200 hover:scale-110 hover:border-slate-300 hover:text-slate-700 hover:shadow-sm dark:border-zinc-700/60 dark:bg-zinc-900/70 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-200"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </Tooltip>
              <Tooltip content="Next template">
                <button
                  type="button"
                  aria-label="Next templates"
                  onClick={() => shiftCarousel("next")}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200/80 bg-white/80 text-slate-500 transition-all duration-200 hover:scale-110 hover:border-slate-300 hover:text-slate-700 hover:shadow-sm dark:border-zinc-700/60 dark:bg-zinc-900/70 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-200"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </Tooltip>
            </div>
          </div>

          <div
            ref={carouselRef}
            data-testid="chat-templates-carousel"
            onScroll={handleCarouselScroll}
            className="flex min-h-0 flex-1 snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden px-4 py-4 pb-3 touch-pan-x sm:gap-4 sm:pb-5"
            style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch", scrollPaddingInline: "1rem" }}
          >
            {visibleTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                laneLabel={LANE_META[template.lane].label}
                triggerLabel={triggerLabel}
                actionLabel={actionLabel}
                onUseTemplate={onUseTemplate}
              />
            ))}
          </div>

        </div>
      </div>
      </div>{/* end scrollable area */}

      {/* ── Pagination footer — always visible ───────────────────────────────── */}
      <div className="flex flex-shrink-0 items-center justify-center gap-2 border-t border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur-sm dark:border-zinc-800/70 dark:bg-zinc-950/85">
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
                "h-2.5 rounded-full transition-all duration-300",
                active
                  ? "w-6 bg-violet-500/80 shadow-[0_0_0_4px_rgba(108,61,232,0.10)]"
                  : "w-2.5 bg-slate-300/90 hover:bg-slate-400/80 dark:bg-zinc-600/80 dark:hover:bg-zinc-500/80",
              ].join(" ")}
            >
              <span className="sr-only">{template.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
