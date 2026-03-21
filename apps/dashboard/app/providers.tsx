"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Refine } from "@refinedev/core";
import routerProvider from "@refinedev/nextjs-router/app";
import { useState } from "react";
import { dataProvider } from "../lib/dataProvider";
import { authProvider } from "../lib/authProvider";

const resources = [
  { name: "overview",  list: "/" },
  { name: "resources", list: "/resources", show: "/resources/:id" },
  { name: "graph",     list: "/graph" },
  { name: "costs",     list: "/costs" },
  { name: "security",  list: "/security" },
  { name: "settings",  list: "/settings" },
  { name: "profile",   list: "/profile" },
];

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <Refine
        dataProvider={dataProvider}
        authProvider={authProvider}
        routerProvider={routerProvider}
        resources={resources}
        options={{ disableTelemetry: true, projectId: "cig-dashboard" }}
      >
        {children}
      </Refine>
    </QueryClientProvider>
  );
}
