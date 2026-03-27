"use client";

import { useEffect, useMemo, useState } from "react";
import { Database, ExternalLink, Link2, Search } from "lucide-react";
import { ModalCard } from "@cig/ui";
import type { GraphSource } from "@cig/sdk";
import { getResourcesPaged, searchResources, type Resource } from "../lib/api";

function looksDatabaseLike(resource: Resource): boolean {
  const haystack = `${resource.type} ${resource.name} ${resource.id}`.toLowerCase();
  return /(db|database|postgres|mysql|redis|mongo|rds|sql|warehouse|bigquery)/.test(haystack);
}

function uniqueResources(resources: Resource[]): Resource[] {
  const next = new Map<string, Resource>();
  for (const resource of resources) {
    next.set(resource.id, resource);
  }
  return [...next.values()];
}

function ResourceRow({
  resource,
  onSelect,
}: {
  resource: Resource;
  onSelect: (resource: Resource) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(resource)}
      className="flex w-full items-start justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/80 px-3 py-3 text-left transition-colors hover:border-violet-200 hover:bg-violet-50/60 dark:border-zinc-700/70 dark:bg-zinc-950/70 dark:hover:border-violet-400/30 dark:hover:bg-violet-400/8"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-800 dark:text-zinc-100">
          {resource.name || resource.id}
        </p>
        <p className="mt-1 truncate text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-zinc-500">
          {[resource.type, resource.provider, resource.region].filter(Boolean).join(" • ")}
        </p>
      </div>
      <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 dark:text-zinc-600" />
    </button>
  );
}

export function ChatLinkPickerDialog({
  open,
  docsUrl,
  source,
  currentResource,
  recentResources,
  linkedResourceIds,
  onClose,
  onSelectResource,
}: {
  open: boolean;
  docsUrl: string;
  source: GraphSource;
  currentResource: Resource | null;
  recentResources: Resource[];
  linkedResourceIds: string[];
  onClose: () => void;
  onSelectResource: (resource: Resource) => void;
}) {
  const [searchValue, setSearchValue] = useState("");
  const [suggestedResources, setSuggestedResources] = useState<Resource[]>([]);
  const [searchResults, setSearchResults] = useState<Resource[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    const loadSuggestions = async () => {
      setIsLoadingSuggestions(true);
      try {
        const response = await getResourcesPaged("limit=48", source);
        if (cancelled) {
          return;
        }
        const resources = response.items.filter(looksDatabaseLike).slice(0, 8);
        setSuggestedResources(resources);
      } catch {
        if (!cancelled) {
          setSuggestedResources([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSuggestions(false);
        }
      }
    };

    void loadSuggestions();

    return () => {
      cancelled = true;
    };
  }, [open, source]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const query = searchValue.trim();
    if (!query) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    setIsSearching(true);

    const timer = window.setTimeout(async () => {
      try {
        const response = await searchResources(query, undefined, source);
        if (!cancelled) {
          setSearchResults(response.items.slice(0, 10));
        }
      } catch {
        if (!cancelled) {
          setSearchResults([]);
        }
      } finally {
        if (!cancelled) {
          setIsSearching(false);
        }
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, searchValue, source]);

  const currentSelection = useMemo(
    () =>
      currentResource && !linkedResourceIds.includes(currentResource.id)
        ? [currentResource]
        : [],
    [currentResource, linkedResourceIds],
  );

  const recentSelection = useMemo(
    () => recentResources.filter((resource) => !linkedResourceIds.includes(resource.id)).slice(0, 4),
    [linkedResourceIds, recentResources],
  );

  const hasSearch = searchValue.trim().length > 0;
  const visibleSearchResults = useMemo(
    () => searchResults.filter((resource) => !linkedResourceIds.includes(resource.id)),
    [linkedResourceIds, searchResults],
  );

  return (
    <ModalCard
      open={open}
      tone="info"
      title="Link infrastructure resources"
      description="Attach resources from the selected graph source instead of pasting generic URLs."
      icon={<Link2 className="h-5 w-5" />}
      dismissLabel="Close resource picker"
      onDismiss={onClose}
    >
      <div className="space-y-4">
        <label className="flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2.5 dark:border-zinc-700/70 dark:bg-zinc-950/80">
          <Search className="h-4 w-4 text-slate-400 dark:text-zinc-500" />
          <input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Search resources, services, or databases"
            className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
        </label>

        {hasSearch ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-zinc-500">
                Search results
              </p>
              {isSearching ? (
                <span className="text-[11px] text-slate-400 dark:text-zinc-500">Searching...</span>
              ) : null}
            </div>
            {visibleSearchResults.length > 0 ? (
              <div className="space-y-2">
                {visibleSearchResults.map((resource) => (
                  <ResourceRow key={resource.id} resource={resource} onSelect={onSelectResource} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200/80 px-4 py-4 text-sm text-slate-500 dark:border-zinc-700/70 dark:text-zinc-400">
                No matching resources found. Run discovery or review the setup guide.
                <a
                  href={docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-2 font-medium text-violet-600 hover:text-violet-500 dark:text-violet-300"
                >
                  Open docs
                </a>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {currentSelection.length > 0 ? (
              <section className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-zinc-500">
                  Current page resource
                </p>
                {currentSelection.map((resource) => (
                  <ResourceRow key={resource.id} resource={resource} onSelect={onSelectResource} />
                ))}
              </section>
            ) : null}

            {recentSelection.length > 0 ? (
              <section className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-zinc-500">
                  Recent linked resources
                </p>
                {recentSelection.map((resource) => (
                  <ResourceRow key={resource.id} resource={resource} onSelect={onSelectResource} />
                ))}
              </section>
            ) : null}

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-zinc-500">
                  <Database className="h-3.5 w-3.5" />
                  Suggested databases
                </p>
                {isLoadingSuggestions ? (
                  <span className="text-[11px] text-slate-400 dark:text-zinc-500">Loading...</span>
                ) : null}
              </div>
              {suggestedResources.length > 0 ? (
                <div className="space-y-2">
                  {uniqueResources(suggestedResources).map((resource) => (
                    <ResourceRow key={resource.id} resource={resource} onSelect={onSelectResource} />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200/80 px-4 py-4 text-sm text-slate-500 dark:border-zinc-700/70 dark:text-zinc-400">
                  No indexed database-like resources yet. Run discovery locally or connect the managed discovery service first.
                  <a
                    href={docsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-2 font-medium text-violet-600 hover:text-violet-500 dark:text-violet-300"
                  >
                    Open docs
                  </a>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </ModalCard>
  );
}
