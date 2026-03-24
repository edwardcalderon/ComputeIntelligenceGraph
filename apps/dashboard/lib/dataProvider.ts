import type { DataProvider } from "@refinedev/core";
import { DASHBOARD_API_URL, getDashboardClient } from "./cigClient";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  return getDashboardClient().request<T>(path, init);
}

/**
 * Maps Refine resource names to API paths.
 * resource → /api/v1/{resource}
 */
const resourcePath: Record<string, string> = {
  resources:  "/api/v1/resources",
  costs:      "/api/v1/costs",
  security:   "/api/v1/security/findings",
  discovery:  "/api/v1/discovery",
};

function pathFor(resource: string): string {
  return resourcePath[resource] ?? `/api/v1/${resource}`;
}

export const dataProvider: DataProvider = {
  getList: async ({ resource, pagination, filters, sorters }) => {
    const page    = pagination?.currentPage ?? 1;
    const perPage = pagination?.pageSize ?? 20;
    const offset  = (page - 1) * perPage;

    const qs = new URLSearchParams();
    qs.set("limit",  String(perPage));
    qs.set("offset", String(offset));

    for (const f of filters ?? []) {
      if ("field" in f && f.value !== "" && f.value !== undefined) {
        qs.set(f.field, String(f.value));
      }
    }

    const data = await apiFetch<{ items?: unknown[]; total?: number } & unknown[]>(
      `${pathFor(resource)}?${qs}`
    );

    // Handle both array and paginated object responses
    const items  = Array.isArray(data) ? data : ((data as { items?: unknown[] }).items ?? []);
    const total  = Array.isArray(data) ? items.length : ((data as { total?: number }).total ?? items.length);

    return { data: items as never[], total };
  },

  getOne: async ({ resource, id }) => {
    const data = await apiFetch<unknown>(`${pathFor(resource)}/${encodeURIComponent(String(id))}`);
    return { data: data as never };
  },

  create: async ({ resource, variables }) => {
    const data = await apiFetch<unknown>(pathFor(resource), {
      method: "POST",
      body: JSON.stringify(variables),
    });
    return { data: data as never };
  },

  update: async ({ resource, id, variables }) => {
    const data = await apiFetch<unknown>(
      `${pathFor(resource)}/${encodeURIComponent(String(id))}`,
      { method: "PATCH", body: JSON.stringify(variables) }
    );
    return { data: data as never };
  },

  deleteOne: async ({ resource, id }) => {
    const data = await apiFetch<unknown>(
      `${pathFor(resource)}/${encodeURIComponent(String(id))}`,
      { method: "DELETE" }
    );
    return { data: data as never };
  },

  getApiUrl: () => DASHBOARD_API_URL,

  custom: async ({ url, method = "get", payload }) => {
    const data = await apiFetch<unknown>(url.replace(DASHBOARD_API_URL, ""), {
      method: method.toUpperCase(),
      body: payload ? JSON.stringify(payload) : undefined,
    });
    return { data: data as never };
  },
};
