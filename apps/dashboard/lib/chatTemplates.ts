/**
 * CIG Chat Template Registry
 *
 * Add new templates here. The UI picks them up automatically — no other
 * files need changing.  Each template belongs to a `lane` (category) that
 * groups it in the filter pills and carousel.
 *
 * Fields:
 *   id       – stable, unique slug  (never reuse or rename)
 *   lane     – logical category key  (extend the union when adding new lanes)
 *   badge    – short display label for the type pill  (~10 chars)
 *   title    – user-facing card heading
 *   summary  – one-sentence description of what the AI will return
 *   prompt   – the exact text injected into the chat input
 */

export type TemplateLane =
  | "ops"
  | "sales"
  | "trace"
  | "finance"
  | "hr"
  | "supply";

export type ChatTemplate = {
  id: string;
  lane: TemplateLane;
  badge: string;
  title: string;
  summary: string;
  prompt: string;
};

export const LANE_META: Record<TemplateLane, { label: string; description: string }> = {
  ops: {
    label: "Operations",
    description: "Health checks, alerts, and daily execution.",
  },
  sales: {
    label: "Revenue",
    description: "Revenue pace, goals, and channel mix.",
  },
  trace: {
    label: "Traceability",
    description: "Root cause analysis and key event tracing.",
  },
  finance: {
    label: "Finance",
    description: "Cost, margins, and financial performance.",
  },
  hr: {
    label: "People",
    description: "Headcount, performance, and workforce.",
  },
  supply: {
    label: "Supply Chain",
    description: "Inventory, logistics, and supplier status.",
  },
};

/** All available templates. Add to this array to register a new template. */
export const CHAT_TEMPLATES: ChatTemplate[] = [
  // ── Operations ─────────────────────────────────────────────────────────────
  {
    id: "alerts-today",
    lane: "ops",
    badge: "Alertas",
    title: "Resumen de alertas de hoy",
    summary: "Trae un strip ejecutivo con el balance crítico, atención y estado normal.",
    prompt: "resumen alertas hoy",
  },

  // ── Revenue ─────────────────────────────────────────────────────────────────
  {
    id: "sales-last-7-days",
    lane: "sales",
    badge: "Tendencia",
    title: "Ventas de los últimos 7 días",
    summary: "Compara el pulso de ventas por canal y resalta la dirección semanal.",
    prompt: "ventas últimos 7 días",
  },
  {
    id: "monthly-goal",
    lane: "sales",
    badge: "Meta",
    title: "¿Cómo vamos con la meta?",
    summary: "Muestra avance, ritmo necesario y ritmo real de la meta comercial.",
    prompt: "¿cómo vamos con la meta?",
  },
  {
    id: "sales-by-channel",
    lane: "sales",
    badge: "Distribución",
    title: "Distribución de ventas por canal",
    summary: "Entrega el mix comercial y el peso de cada canal en el total acumulado.",
    prompt: "distribución de ventas por canal",
  },

  // ── Traceability ────────────────────────────────────────────────────────────
  {
    id: "blocked-order",
    lane: "trace",
    badge: "Trazabilidad",
    title: "¿Por qué se bloqueó el pedido 8821?",
    summary: "Explica el evento, la regla aplicada y el siguiente paso operativo.",
    prompt: "¿por qué se bloqueó el pedido 8821?",
  },
];

/** The set of lanes that actually have templates registered. */
export function getActiveLanes(): TemplateLane[] {
  const seen = new Set<TemplateLane>();
  for (const t of CHAT_TEMPLATES) seen.add(t.lane);
  return Array.from(seen);
}

/** Templates filtered by lane, or all if lane is null. */
export function getTemplatesByLane(lane: TemplateLane | null): ChatTemplate[] {
  if (!lane) return CHAT_TEMPLATES;
  return CHAT_TEMPLATES.filter((t) => t.lane === lane);
}
