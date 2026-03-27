"use client";

import { useEffect, useMemo, useState } from "react";
import { Braces, Code2, Search } from "lucide-react";
import { ModalCard } from "@cig/ui";
import type { ChatCodeSnippetContextItem } from "../lib/api";

type CodeLanguage = ChatCodeSnippetContextItem["language"];

const LANGUAGE_META: Record<
  CodeLanguage,
  { label: string; helper: string; icon: React.ReactNode }
> = {
  sql: {
    label: "SQL",
    helper: "Draft SQL or cost-analysis style questions you want the assistant to reason about.",
    icon: <Code2 className="h-4 w-4" />,
  },
  search: {
    label: "Search",
    helper: "Compose infrastructure search queries or advanced filters for discovery and resource lookup.",
    icon: <Search className="h-4 w-4" />,
  },
  cypher: {
    label: "Cypher",
    helper: "Describe graph-oriented dependency or relationship questions without executing them directly.",
    icon: <Braces className="h-4 w-4" />,
  },
};

function deriveTitle(language: CodeLanguage, content: string): string {
  const firstLine = content
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) {
    return LANGUAGE_META[language].label;
  }

  return firstLine.length <= 48 ? firstLine : `${firstLine.slice(0, 47).trimEnd()}...`;
}

export function ChatCodeComposerDialog({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (item: ChatCodeSnippetContextItem) => void;
}) {
  const [language, setLanguage] = useState<CodeLanguage>("sql");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    setLanguage("sql");
    setTitle("");
    setContent("");
  }, [open]);

  const placeholder = useMemo(() => {
    switch (language) {
      case "sql":
        return "SELECT region, SUM(amount) FROM cost_usage WHERE service = 'rds' GROUP BY region;";
      case "search":
        return "provider:aws type:database region:us-east-1 state:active";
      case "cypher":
        return "MATCH (db:Database)<-[:DEPENDS_ON]-(svc:Service) RETURN svc, db LIMIT 25";
    }
  }, [language]);

  function handleSave() {
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      return;
    }

    onSave({
      type: "code_snippet",
      language,
      title: title.trim() || deriveTitle(language, trimmedContent),
      content: trimmedContent,
    });
    onClose();
  }

  return (
    <ModalCard
      open={open}
      tone="info"
      title="Add query context"
      description="Attach a structured snippet so the assistant can reason about SQL, search filters, or Cypher without executing it directly."
      icon={<Code2 className="h-5 w-5" />}
      dismissLabel="Close query composer"
      onDismiss={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-2xl border border-slate-200/80 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-zinc-700/70 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!content.trim()}
            className="inline-flex items-center justify-center rounded-2xl bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add to chat
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(LANGUAGE_META) as CodeLanguage[]).map((nextLanguage) => (
            <button
              key={nextLanguage}
              type="button"
              onClick={() => setLanguage(nextLanguage)}
              className={[
                "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition-colors",
                language === nextLanguage
                  ? "border-violet-300/70 bg-violet-500/10 text-violet-700 dark:border-violet-400/30 dark:bg-violet-400/12 dark:text-violet-300"
                  : "border-slate-200/80 bg-white text-slate-500 hover:border-slate-300 dark:border-zinc-700/70 dark:bg-zinc-950 dark:text-zinc-400",
              ].join(" ")}
            >
              {LANGUAGE_META[nextLanguage].icon}
              {LANGUAGE_META[nextLanguage].label}
            </button>
          ))}
        </div>

        <p className="text-sm leading-6 text-slate-500 dark:text-zinc-400">
          {LANGUAGE_META[language].helper}
        </p>

        <label className="block space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-zinc-500">
            Title
          </span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={`Optional ${LANGUAGE_META[language].label} label`}
            className="w-full rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-violet-300 dark:border-zinc-700/70 dark:bg-zinc-950/80 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-zinc-500">
            Query or snippet
          </span>
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={8}
            placeholder={placeholder}
            className="w-full resize-none rounded-3xl border border-slate-200/80 bg-white/90 px-4 py-3 text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400 focus:border-violet-300 dark:border-zinc-700/70 dark:bg-zinc-950/80 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
        </label>
      </div>
    </ModalCard>
  );
}
