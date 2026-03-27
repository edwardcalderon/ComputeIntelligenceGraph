"use client";

import Link from "next/link";
import {
  Code2,
  Image as ImageIcon,
  Link2,
  Mic,
  Paperclip,
  X,
} from "lucide-react";
import type { ChatContextItem } from "../lib/api";

function previewText(value: string | undefined, maxLength = 120): string | null {
  if (!value?.trim()) {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

function resourceSubtitle(item: Extract<ChatContextItem, { type: "resource_link" }>): string | null {
  const bits = [item.resourceType, item.provider].filter(Boolean);
  return bits.length > 0 ? bits.join(" • ") : null;
}

function renderIcon(item: ChatContextItem) {
  switch (item.type) {
    case "resource_link":
      return <Link2 className="h-3.5 w-3.5" />;
    case "attachment":
      return item.kind === "image" ? <ImageIcon className="h-3.5 w-3.5" /> : <Paperclip className="h-3.5 w-3.5" />;
    case "code_snippet":
      return <Code2 className="h-3.5 w-3.5" />;
    case "transcript":
      return <Mic className="h-3.5 w-3.5" />;
    default:
      return null;
  }
}

function renderTitle(item: ChatContextItem): string {
  switch (item.type) {
    case "resource_link":
      return item.title;
    case "attachment":
      return item.name;
    case "code_snippet":
      return item.title;
    case "transcript":
      return "Voice transcript";
    default:
      return "Context item";
  }
}

function renderSubtitle(item: ChatContextItem): string | null {
  switch (item.type) {
    case "resource_link":
      return resourceSubtitle(item);
    case "attachment":
      return item.summary ?? previewText(item.extractedText, 80);
    case "code_snippet":
      return `${item.language.toUpperCase()} • ${previewText(item.content, 72) ?? "Snippet ready"}`;
    case "transcript":
      return previewText(item.text, 80);
    default:
      return null;
  }
}

function renderBadge(item: ChatContextItem): string {
  switch (item.type) {
    case "resource_link":
      return "LINK";
    case "attachment":
      return item.kind === "image" ? "IMAGE" : "FILE";
    case "code_snippet":
      return item.language.toUpperCase();
    case "transcript":
      return item.mode === "auto-send" ? "VOICE SEND" : "VOICE NOTE";
    default:
      return "CONTEXT";
  }
}

export function ChatContextItems({
  items,
  variant = "message",
  onRemove,
}: {
  items: ChatContextItem[];
  variant?: "message" | "draft";
  onRemove?: (index: number) => void;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, index) => {
        const title = renderTitle(item);
        const subtitle = renderSubtitle(item);
        const content = (
          <div
            className={[
              "group relative min-w-0 rounded-2xl border px-3 py-2 text-left transition-colors",
              variant === "draft"
                ? "max-w-full border-violet-200/70 bg-violet-500/8 text-slate-700 dark:border-violet-400/25 dark:bg-violet-400/10 dark:text-zinc-100"
                : "max-w-[16rem] border-slate-200/80 bg-white/90 text-slate-700 dark:border-zinc-700/70 dark:bg-zinc-950/80 dark:text-zinc-100",
            ].join(" ")}
          >
            <div className="flex items-start gap-2.5 pr-7">
              <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white/80 text-violet-600 shadow-sm dark:bg-zinc-900 dark:text-violet-300">
                {renderIcon(item)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-xs font-semibold text-slate-800 dark:text-zinc-100">
                    {title}
                  </span>
                  <span className="shrink-0 rounded-full border border-slate-200/80 bg-slate-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-500">
                    {renderBadge(item)}
                  </span>
                </div>
                {subtitle ? (
                  <p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-zinc-400">
                    {subtitle}
                  </p>
                ) : null}
              </div>
            </div>

            {variant === "draft" && onRemove ? (
              <button
                type="button"
                aria-label={`Remove ${title}`}
                onClick={() => onRemove(index)}
                className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-black/5 hover:text-slate-700 dark:text-zinc-500 dark:hover:bg-white/5 dark:hover:text-zinc-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        );

        if (item.type === "resource_link") {
          return (
            <Link key={`${item.type}:${item.resourceId}:${index}`} href={item.href} className="min-w-0">
              {content}
            </Link>
          );
        }

        return (
          <div key={`${item.type}:${title}:${index}`} className="min-w-0">
            {content}
          </div>
        );
      })}
    </div>
  );
}
