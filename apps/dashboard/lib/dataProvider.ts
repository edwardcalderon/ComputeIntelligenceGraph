import type { DataProvider } from "@refinedev/core";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try { return sessionStorage.getItem("cig_access_token"); } catch { return null; }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...init,
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json() as Promise<T>;
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

  getApiUrl: () => API_URL,

  custom: async ({ url, method = "get", payload }) => {
    const data = await apiFetch<unknown>(url.replace(API_URL, ""), {
      method: method.toUpperCase(),
      body: payload ? JSON.stringify(payload) : undefined,
    });
    return { data: data as never };
  },
};
