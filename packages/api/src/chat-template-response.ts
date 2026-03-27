import type { ChatMessagePresentation, ChatTemplateSelection, GraphSnapshot } from '@cig/sdk';
import type { Resource_Model } from '@cig/graph';
import type { ChatResponse } from './chat';
import { getDemoWorkspaceSeedResources } from './demo-workspace';

type TemplateRenderResult = {
  answer: string;
  html: string;
};

type ProviderStat = {
  provider: string;
  totalCost: number;
  count: number;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return char;
    }
  });
}

function formatCurrency(value: number): string {
  return `$${value.toFixed(1)}M`;
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

function getResourceLabel(resource: Resource_Model): string {
  const parts = [
    resource.name || resource.id,
    resource.provider,
    resource.region ? resource.region : null,
    resource.state ? resource.state.toLowerCase() : null,
  ].filter((part): part is string => Boolean(part));

  return parts.join(' · ');
}

function totalCost(resources: Resource_Model[]): number {
  return resources.reduce((sum, resource) => sum + (typeof resource.cost === 'number' ? resource.cost : 0), 0);
}

function buildResourceLookup(snapshot: GraphSnapshot): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const resource of snapshot.resources) {
    lookup.set(resource.id, resource.name || resource.id);
  }
  return lookup;
}

function groupProviders(resources: Resource_Model[]): ProviderStat[] {
  const totals = new Map<string, ProviderStat>();

  for (const resource of resources) {
    const provider = String(resource.provider || 'unknown');
    const current = totals.get(provider) ?? { provider, totalCost: 0, count: 0 };
    current.totalCost += typeof resource.cost === 'number' ? resource.cost : 0;
    current.count += 1;
    totals.set(provider, current);
  }

  return [...totals.values()].sort((left, right) => right.totalCost - left.totalCost);
}

function groupTypes(snapshot: GraphSnapshot): Array<{ type: string; count: number }> {
  return Object.entries(snapshot.resourceCounts)
    .map(([type, count]) => ({ type, count: Number(count) || 0 }))
    .filter((entry) => entry.count > 0)
    .sort((left, right) => right.count - left.count);
}

function renderHeader(template: ChatTemplateSelection, answer: string, subtitle: string): string {
  return `
    <section style="border:1px solid rgba(129,140,248,.28);border-radius:20px;padding:16px;background:linear-gradient(135deg,rgba(108,61,232,.11),rgba(29,158,117,.08));">
      <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#64748b;font-weight:700;">Demo template matched</div>
      <h3 style="margin:8px 0 0;font-size:20px;line-height:1.25;font-weight:800;color:#0f172a;">${escapeHtml(template.title)}</h3>
      <p style="margin:6px 0 0;font-size:13px;line-height:1.5;color:#475569;">${escapeHtml(answer)}</p>
      <p style="margin:8px 0 0;font-size:12px;color:#64748b;">${escapeHtml(subtitle)}</p>
    </section>
  `;
}

function renderMetricGrid(metrics: Array<{ label: string; value: string; tone?: string }>): string {
  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;">
      ${metrics
        .map(
          (metric) => `
            <div style="border:1px solid rgba(148,163,184,.22);border-radius:18px;padding:12px;background:rgba(255,255,255,.75);">
              <div style="font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#64748b;">${escapeHtml(metric.label)}</div>
              <div style="margin-top:8px;font-size:18px;line-height:1.2;font-weight:800;color:${metric.tone ?? '#0f172a'};">${escapeHtml(metric.value)}</div>
            </div>
          `
        )
        .join('')}
    </div>
  `;
}

function renderListCard(title: string, items: string[]): string {
  return `
    <section style="border:1px solid rgba(148,163,184,.22);border-radius:18px;padding:14px;background:rgba(255,255,255,.82);">
      <div style="font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#64748b;">${escapeHtml(title)}</div>
      <div style="margin-top:10px;display:grid;gap:8px;">
        ${items
          .map(
            (item, index) => `
              <div style="display:flex;gap:10px;align-items:flex-start;">
                <span style="width:18px;height:18px;border-radius:999px;flex:none;background:${index === 0 ? 'rgba(220,38,38,.15)' : index === 1 ? 'rgba(245,158,11,.16)' : 'rgba(34,197,94,.14)'};color:${index === 0 ? '#b91c1c' : index === 1 ? '#b45309' : '#15803d'};font-size:11px;font-weight:800;text-align:center;line-height:18px;">${index + 1}</span>
                <div style="min-width:0;flex:1;font-size:13px;line-height:1.45;color:#334155;">${escapeHtml(item)}</div>
              </div>
            `
          )
          .join('')}
      </div>
    </section>
  `;
}

function renderProviderBars(stats: ProviderStat[]): string {
  const max = Math.max(...stats.map((entry) => entry.totalCost), 1);

  return `
    <section style="border:1px solid rgba(148,163,184,.22);border-radius:18px;padding:14px;background:rgba(255,255,255,.82);">
      <div style="font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#64748b;">Provider mix</div>
      <div style="margin-top:12px;display:grid;gap:10px;">
        ${stats
          .map((entry, index) => {
            const width = Math.max(12, Math.round((entry.totalCost / max) * 100));
            const accent = index === 0 ? 'linear-gradient(90deg,rgba(108,61,232,.92),rgba(108,61,232,.55))' : index === 1 ? 'linear-gradient(90deg,rgba(29,158,117,.92),rgba(29,158,117,.55))' : 'linear-gradient(90deg,rgba(245,158,11,.92),rgba(245,158,11,.55))';
            return `
              <div>
                <div style="display:flex;justify-content:space-between;gap:10px;font-size:12px;color:#334155;">
                  <span style="font-weight:700;">${escapeHtml(entry.provider)}</span>
                  <span>${formatCurrency(entry.totalCost)} · ${entry.count} nodes</span>
                </div>
                <div style="margin-top:6px;height:10px;border-radius:999px;background:rgba(148,163,184,.16);overflow:hidden;">
                  <div style="height:100%;width:${width}%;border-radius:999px;background:${accent};"></div>
                </div>
              </div>
            `;
          })
          .join('')}
      </div>
    </section>
  `;
}

function renderGoalGauge(total: number): string {
  const target = 375;
  const percent = Math.min(100, Math.round((total / target) * 100));
  const remaining = Math.max(0, target - total);

  return `
    <section style="border:1px solid rgba(148,163,184,.22);border-radius:18px;padding:14px;background:rgba(255,255,255,.82);">
      <div style="font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#64748b;">Goal pacing</div>
      <div style="margin-top:12px;display:grid;gap:12px;">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-end;">
          <div>
            <div style="font-size:30px;line-height:1;font-weight:900;color:#0f172a;">${percent}%</div>
            <div style="margin-top:4px;font-size:12px;color:#64748b;">of the demo target reached</div>
          </div>
          <div style="text-align:right;font-size:12px;color:#475569;">
            <div style="font-weight:700;">${formatCurrency(total)} / ${formatCurrency(target)}</div>
            <div>${formatCurrency(remaining)} remaining</div>
          </div>
        </div>
        <div style="height:14px;border-radius:999px;background:rgba(148,163,184,.16);overflow:hidden;">
          <div style="height:100%;width:${percent}%;border-radius:999px;background:linear-gradient(90deg,rgba(59,130,246,.92),rgba(139,92,246,.92));"></div>
        </div>
      </div>
    </section>
  `;
}

function renderPillStrip(items: string[]): string {
  return `
    <div style="display:flex;flex-wrap:wrap;gap:8px;">
      ${items
        .map(
          (item) => `
            <span style="display:inline-flex;align-items:center;border-radius:999px;border:1px solid rgba(129,140,248,.22);background:rgba(129,140,248,.08);padding:7px 10px;font-size:12px;font-weight:700;color:#4338ca;">
              ${escapeHtml(item)}
            </span>
          `
        )
        .join('')}
    </div>
  `;
}

function renderTimeline(events: Array<{ time: string; title: string; description: string; tone: 'critical' | 'attention' | 'ok' }>): string {
  return `
    <section style="border:1px solid rgba(148,163,184,.22);border-radius:18px;padding:14px;background:rgba(255,255,255,.82);">
      <div style="font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#64748b;">Trace timeline</div>
      <div style="margin-top:12px;display:grid;gap:12px;">
        ${events
          .map((event, index) => `
            <div style="display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:start;">
              <div style="width:54px;font-size:12px;font-weight:800;color:${event.tone === 'critical' ? '#b91c1c' : event.tone === 'attention' ? '#b45309' : '#15803d'};">${escapeHtml(event.time)}</div>
              <div style="position:relative;padding-left:14px;">
                <div style="position:absolute;left:0;top:2px;width:10px;height:10px;border-radius:999px;background:${event.tone === 'critical' ? 'rgba(220,38,38,.9)' : event.tone === 'attention' ? 'rgba(245,158,11,.9)' : 'rgba(34,197,94,.9)'};"></div>
                <div style="font-size:13px;font-weight:800;color:#0f172a;">${escapeHtml(event.title)}</div>
                <div style="margin-top:2px;font-size:12px;line-height:1.45;color:#475569;">${escapeHtml(event.description)}</div>
              </div>
            </div>
          `)
          .join('')}
      </div>
    </section>
  `;
}

function buildAlertsToday(template: ChatTemplateSelection, snapshot: GraphSnapshot, seedResources: Resource_Model[]): TemplateRenderResult {
  const activeCount = snapshot.resources.filter((resource) => /active|running/i.test(String(resource.state ?? ''))).length;
  const serviceCount = snapshot.resources.filter((resource) => /service/i.test(String(resource.type ?? ''))).length;
  const dbCount = snapshot.resources.filter((resource) => /database/i.test(String(resource.type ?? ''))).length;
  const routeCount = snapshot.relationships.length;
  const lookup = buildResourceLookup(snapshot);
  const platformGateway = lookup.get('demo-platform-gateway') ?? 'Demo Platform Gateway';
  const ventasApi = lookup.get('demo-ventas-api') ?? 'Demo Ventas API';
  const clientesDb = lookup.get('demo-clientes-db') ?? 'Demo Clientes DB';
  const reportingApp = lookup.get('demo-reporting-app') ?? 'Demo Reporting App';
  const vpc = lookup.get('demo-shared-vpc') ?? 'Demo Shared VPC';
  const topResources = [...seedResources].sort((left, right) => (right.cost ?? 0) - (left.cost ?? 0)).slice(0, 3);
  const html = `
    ${renderHeader(
      template,
      'The demo workspace is healthy enough to render the alert strip directly from graph data.',
      'This template follows the seeded demo infra graph and highlights the most relevant operational surfaces.'
    )}
    ${renderMetricGrid([
      { label: 'Indexed resources', value: String(snapshot.resources.length) },
      { label: 'Active nodes', value: String(activeCount) },
      { label: 'Services', value: String(serviceCount) },
      { label: 'Relationships', value: String(routeCount) },
    ])}
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">
      ${renderListCard('Priority signals', [
        `${platformGateway} routes into ${ventasApi} through ${routeCount} demo relationships.`,
        `${clientesDb} is the highest-signal database node for the sales workflow.`,
        `${reportingApp} and ${vpc} anchor the analytics and networking edge of the demo graph.`,
      ])}
      ${renderListCard('Top demo nodes', topResources.map((resource) => getResourceLabel(resource)))}
    </div>
    ${renderPillStrip([
      `Gateway → API: ${platformGateway} → ${ventasApi}`,
      `Sales data → DB: ${ventasApi} → ${clientesDb}`,
      `Analytics edge: ${reportingApp} → ${vpc}`,
    ])}
  `;

  return {
    answer: `Demo alert strip rendered from ${snapshot.resources.length} resources and ${routeCount} relationships.`,
    html: `<div style="display:grid;gap:14px;">${html}</div>`,
  };
}

function buildSalesLast7Days(template: ChatTemplateSelection, snapshot: GraphSnapshot, seedResources: Resource_Model[]): TemplateRenderResult {
  const ranked = [...seedResources]
    .sort((left, right) => (right.cost ?? 0) - (left.cost ?? 0))
    .slice(0, 7);
  const max = Math.max(...ranked.map((resource) => resource.cost ?? 0), 1);

  const bars = ranked
    .map((resource, index) => {
      const width = Math.max(10, Math.round(((resource.cost ?? 0) / max) * 100));
      const color = index % 3 === 0 ? 'rgba(108,61,232,.92)' : index % 3 === 1 ? 'rgba(29,158,117,.92)' : 'rgba(59,130,246,.92)';
      return `
        <div style="display:grid;gap:6px;">
          <div style="display:flex;justify-content:space-between;gap:10px;font-size:12px;color:#334155;">
            <span style="font-weight:700;">${escapeHtml(resource.name)}</span>
            <span>${formatCurrency(resource.cost ?? 0)}</span>
          </div>
          <div style="height:11px;border-radius:999px;background:rgba(148,163,184,.16);overflow:hidden;">
            <div style="height:100%;width:${width}%;border-radius:999px;background:${color};"></div>
          </div>
        </div>
      `;
    })
    .join('');

  const total = totalCost(seedResources);
  const providerStats = groupProviders(seedResources);

  const html = `
    ${renderHeader(
      template,
      'The demo sales pulse is mapped from the seeded graph nodes so the chart stays grounded in real demo assets.',
      'The weekly view reuses the demo resource costs and the provider split from the shared workspace.'
    )}
    ${renderMetricGrid([
      { label: 'Demo resource spend', value: formatCurrency(total) },
      { label: 'Current nodes', value: String(snapshot.resources.length) },
      { label: 'Dependency edges', value: String(snapshot.relationships.length) },
      { label: 'Top node', value: ranked[0] ? ranked[0].name : 'n/a' },
    ])}
    <section style="display:grid;gap:12px;border:1px solid rgba(148,163,184,.22);border-radius:18px;padding:14px;background:rgba(255,255,255,.82);">
      <div style="font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#64748b;">Seven-day pulse</div>
      <div style="display:grid;gap:10px;">${bars}</div>
    </section>
    ${renderProviderBars(providerStats)}
  `;

  return {
    answer: `Demo weekly sales pulse rendered from ${snapshot.resources.length} resources across ${providerStats.length} providers.`,
    html: `<div style="display:grid;gap:14px;">${html}</div>`,
  };
}

function buildMonthlyGoal(template: ChatTemplateSelection, snapshot: GraphSnapshot, seedResources: Resource_Model[]): TemplateRenderResult {
  const total = totalCost(seedResources);
  const gauge = renderGoalGauge(total);
  const topResource = [...seedResources].sort((left, right) => (right.cost ?? 0) - (left.cost ?? 0))[0];
  const activeNodes = snapshot.resources.filter((resource) => /active|running/i.test(String(resource.state ?? ''))).length;

  const html = `
    ${renderHeader(
      template,
      'The monthly goal card is built from the demo graph footprint and the seeded resource budget.',
      'The gauge uses the shared demo workspace, so it stays aligned with the exact assets the graph shows.'
    )}
    ${renderMetricGrid([
      { label: 'Reached value', value: formatCurrency(total) },
      { label: 'Active nodes', value: String(activeNodes) },
      { label: 'Relationships', value: String(snapshot.relationships.length) },
      { label: 'Largest node', value: topResource ? topResource.name : 'n/a' },
    ])}
    ${gauge}
  `;

  return {
    answer: `Demo monthly goal gauge rendered at ${formatPercent(Math.min(100, (total / 375) * 100))} of the seeded target.`,
    html: `<div style="display:grid;gap:14px;">${html}</div>`,
  };
}

function buildSalesByChannel(template: ChatTemplateSelection, snapshot: GraphSnapshot, seedResources: Resource_Model[]): TemplateRenderResult {
  const providerStats = groupProviders(seedResources);
  const max = Math.max(...providerStats.map((entry) => entry.totalCost), 1);
  const bars = providerStats
    .map((entry, index) => {
      const width = Math.max(14, Math.round((entry.totalCost / max) * 100));
      const color =
        index === 0 ? 'linear-gradient(90deg,rgba(108,61,232,.92),rgba(108,61,232,.52))' :
        index === 1 ? 'linear-gradient(90deg,rgba(29,158,117,.92),rgba(29,158,117,.52))' :
        'linear-gradient(90deg,rgba(245,158,11,.92),rgba(245,158,11,.52))';

      return `
        <div>
          <div style="display:flex;justify-content:space-between;gap:10px;font-size:12px;color:#334155;">
            <span style="font-weight:700;">${escapeHtml(entry.provider)}</span>
            <span>${formatCurrency(entry.totalCost)} · ${entry.count} nodes</span>
          </div>
          <div style="margin-top:6px;height:11px;border-radius:999px;background:rgba(148,163,184,.16);overflow:hidden;">
            <div style="height:100%;width:${width}%;border-radius:999px;background:${color};"></div>
          </div>
        </div>
      `;
    })
    .join('');

  const typeStats = groupTypes(snapshot)
    .slice(0, 4)
    .map((entry) => `${entry.type}: ${entry.count}`);

  const html = `
    ${renderHeader(
      template,
      'The channel mix is derived from the demo provider spread so the response stays tied to the seeded graph.',
      'The chart groups the shared demo workspace by provider, then layers the top resource types underneath.'
    )}
    ${renderMetricGrid([
      { label: 'Providers', value: String(providerStats.length) },
      { label: 'Resources', value: String(snapshot.resources.length) },
      { label: 'Edges', value: String(snapshot.relationships.length) },
      { label: 'Dominant channel', value: providerStats[0]?.provider ?? 'n/a' },
    ])}
    <section style="display:grid;gap:12px;border:1px solid rgba(148,163,184,.22);border-radius:18px;padding:14px;background:rgba(255,255,255,.82);">
      <div style="font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#64748b;">Provider channels</div>
      <div style="display:grid;gap:10px;">${bars}</div>
    </section>
    ${typeStats.length > 0 ? renderPillStrip(typeStats) : ''}
  `;

  return {
    answer: `Demo channel mix rendered across ${providerStats.length} providers and ${snapshot.resources.length} resources.`,
    html: `<div style="display:grid;gap:14px;">${html}</div>`,
  };
}

function buildBlockedOrder(template: ChatTemplateSelection, snapshot: GraphSnapshot, seedResources: Resource_Model[]): TemplateRenderResult {
  const lookup = buildResourceLookup(snapshot);
  const gateway = lookup.get('demo-platform-gateway') ?? 'Demo Platform Gateway';
  const ventasApi = lookup.get('demo-ventas-api') ?? 'Demo Ventas API';
  const clientesDb = lookup.get('demo-clientes-db') ?? 'Demo Clientes DB';
  const cache = lookup.get('demo-cache') ?? 'Demo Cache Cluster';
  const productStore = lookup.get('demo-productos-store') ?? 'Demo Productos Store';
  const reportingApp = lookup.get('demo-reporting-app') ?? 'Demo Reporting App';

  const dbSeed = seedResources.find((resource) => resource.id === 'demo-clientes-db');
  const apiSeed = seedResources.find((resource) => resource.id === 'demo-ventas-api');
  const riskText = [
    dbSeed?.metadata?.['pii'] ? `${clientesDb} is tagged with PII handling.` : null,
    apiSeed?.metadata?.['tier'] ? `${ventasApi} runs as ${String(apiSeed.metadata['tier'])} tier.` : null,
    `${reportingApp} depends on the same demo sales API as the operational path.`,
  ]
    .filter((item): item is string => Boolean(item));

  const relationshipList = snapshot.relationships
    .slice(0, 4)
    .map((relationship) => {
      const source = lookup.get(relationship.sourceId) ?? relationship.sourceId;
      const target = lookup.get(relationship.targetId) ?? relationship.targetId;
      return `${source} → ${target} (${relationship.type})`;
    });

  const events = [
    { time: '08:41', title: `${gateway} opened the demo flow`, description: `${gateway} routes directly into ${ventasApi}.`, tone: 'ok' as const },
    { time: '08:41', title: `${ventasApi} evaluated the order`, description: `${ventasApi} depends on ${clientesDb} and ${cache}.`, tone: 'attention' as const },
    { time: '08:42', title: `Policy check blocked PED-8821`, description: `${clientesDb} and ${productStore} feed the sales path, so the order stays paused until the dependency chain is clear.`, tone: 'critical' as const },
    { time: '08:43', title: `Manual review pending`, description: `${reportingApp} reflects the same demo state and will update after the graph is refreshed.`, tone: 'attention' as const },
  ];

  const html = `
    ${renderHeader(
      template,
      'The trace layout follows the seeded demo relationship chain so the blocked-order story stays grounded in graph data.',
      'This response uses the exact demo template and surfaces the dependency chain behind the synthetic order block.'
    )}
    ${renderMetricGrid([
      { label: 'Order ref', value: 'PED-8821' },
      { label: 'Relevant nodes', value: String(snapshot.resources.length) },
      { label: 'Dependency edges', value: String(snapshot.relationships.length) },
      { label: 'Risk signals', value: String(riskText.length) },
    ])}
    ${renderTimeline(events)}
    ${renderListCard('Relationship chain', relationshipList.length > 0 ? relationshipList : [`${gateway} → ${ventasApi}`, `${ventasApi} → ${clientesDb}`])}
    ${riskText.length > 0 ? renderPillStrip(riskText) : ''}
  `;

  return {
    answer: `Demo trace timeline for PED-8821 rendered from ${snapshot.relationships.length} relationships.`,
    html: `<div style="display:grid;gap:14px;">${html}</div>`,
  };
}

export function buildDemoTemplateChatResponse(
  template: ChatTemplateSelection,
  snapshot: GraphSnapshot
): ChatResponse | null {
  const seedResources = getDemoWorkspaceSeedResources();

  const renderer: Record<string, (template: ChatTemplateSelection, snapshot: GraphSnapshot, seedResources: Resource_Model[]) => TemplateRenderResult> = {
    'alerts-today': buildAlertsToday,
    'sales-last-7-days': buildSalesLast7Days,
    'monthly-goal': buildMonthlyGoal,
    'sales-by-channel': buildSalesByChannel,
    'blocked-order': buildBlockedOrder,
  };

  const render = renderer[template.id];
  if (!render) {
    return null;
  }

  const result = render(template, snapshot, seedResources);
  const presentation: ChatMessagePresentation = {
    format: 'html',
    html: result.html,
    templateId: template.id,
  };

  return {
    answer: result.answer,
    needsClarification: false,
    presentation,
  };
}
