"use client";

import {
  AlertCard,
  AlertStrip,
  BarChartCard,
  GaugeCard,
  SparklineCard,
  TimelineCard,
} from "@cig/ui";
import { useTranslation } from "@cig-technology/i18n/react";

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

// ─── Individual example block ─────────────────────────────────────────────────

function ExampleBlock({
  trigger,
  triggerLabel,
  children,
}: {
  trigger: string;
  triggerLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 px-0.5">
        <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-500">
          {triggerLabel}
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-medium italic"
          style={{ background: "rgba(108,61,232,0.10)", color: "#6C3DE8" }}
        >
          &ldquo;{trigger}&rdquo;
        </span>
      </div>
      {children}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ChatExamplesTab() {
  const t = useTranslation();
  const triggerLabel = t("chat.exampleTrigger");

  return (
    <div className="flex flex-col gap-0 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
      {/* Alert strip demo */}
      <div className="flex-shrink-0">
        <AlertStrip critical={2} attention={2} />
      </div>

      {/* Intro */}
      <div className="px-4 pb-3 pt-3 sm:px-5">
        <p className="text-[11px] font-semibold text-slate-700 dark:text-zinc-200">
          {t("chat.examplesTitle")}
        </p>
        <p className="mt-0.5 text-[10px] leading-relaxed text-slate-400 dark:text-zinc-500">
          {t("chat.examplesSubtitle")}
        </p>
      </div>

      {/* Examples */}
      <div className="flex flex-col gap-4 px-3 pb-5 sm:px-4">

        {/* 1 · Alert card */}
        <ExampleBlock trigger="resumen alertas hoy" triggerLabel={triggerLabel}>
          <AlertCard
            title="Panel de alertas"
            timestamp="Ahora"
            items={ALERT_ITEMS}
            showFeedback={false}
          />
        </ExampleBlock>

        {/* 2 · Sparkline / trend */}
        <ExampleBlock trigger="ventas últimos 7 días" triggerLabel={triggerLabel}>
          <SparklineCard
            title="ERP · Ventas · Tendencia"
            period="7 días"
            kpis={SALES_KPIS}
            mainPoints={SALES_POINTS}
            showDayLabels
            channels={SALES_CHANNELS}
            showFeedback={false}
          />
        </ExampleBlock>

        {/* 3 · Gauge / goal */}
        <ExampleBlock trigger="¿cómo vamos con la meta?" triggerLabel={triggerLabel}>
          <GaugeCard
            title="ERP · Meta mensual"
            period="Dic 2024"
            percent={76}
            sublabel="de la meta"
            detail={GAUGE_DETAIL}
            showFeedback={false}
          />
        </ExampleBlock>

        {/* 4 · Timeline / traceability */}
        <ExampleBlock trigger="¿por qué se bloqueó el pedido 8821?" triggerLabel={triggerLabel}>
          <TimelineCard
            title="ERP · Trazabilidad · PED-8821"
            rightLabel="Bloqueado"
            events={TIMELINE_EVENTS}
            causeBox="Saldo disponible $3.2M · Límite requerido $5.0M · Política CAR-04 §2.3"
            kmsQuote="Requiere aprobación del gerente de zona antes de aplicar."
            showFeedback={false}
          />
        </ExampleBlock>

        {/* 5 · Bar chart */}
        <ExampleBlock trigger="distribución de ventas por canal" triggerLabel={triggerLabel}>
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
        </ExampleBlock>

      </div>
    </div>
  );
}
