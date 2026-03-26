"use client";

import { MessageSquarePlus, Trash2 } from "lucide-react";
import { useTranslation } from "@cig-technology/i18n/react";
import type { ChatSessionSummary } from "../lib/api";

const DRAFT_SESSION_ID = "__draft__";

function formatSessionTime(value: string | null): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const deltaMs = Date.now() - date.getTime();
  const deltaMinutes = Math.max(0, Math.round(deltaMs / 60_000));

  if (deltaMinutes < 1) {
    return "now";
  }
  if (deltaMinutes < 60) {
    return `${deltaMinutes}m`;
  }

  const deltaHours = Math.round(deltaMinutes / 60);
  if (deltaHours < 24) {
    return `${deltaHours}h`;
  }

  const deltaDays = Math.round(deltaHours / 24);
  if (deltaDays < 7) {
    return `${deltaDays}d`;
  }

  return date.toLocaleDateString();
}

function SessionCard({
  title,
  preview,
  timestamp,
  active,
  draft = false,
  deleteLabel,
  draftLabel,
  onClick,
  onDelete,
  compact = false,
}: {
  title: string;
  preview: string | null;
  timestamp: string | null;
  active: boolean;
  draft?: boolean;
  deleteLabel: string;
  draftLabel: string;
  onClick: () => void;
  onDelete?: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "group relative overflow-hidden rounded-2xl border text-left transition-all duration-200",
        compact ? "min-w-[11.5rem] max-w-[11.5rem] px-3 py-3" : "w-full px-3.5 py-3.5",
        active
          ? "border-violet-300/70 bg-violet-500/10 shadow-[0_16px_30px_rgba(109,40,217,0.12)] dark:border-violet-400/35 dark:bg-violet-400/10"
          : "border-slate-200/80 bg-white/82 hover:border-slate-300 hover:bg-slate-50 dark:border-zinc-700/70 dark:bg-zinc-900/82 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/82",
      ].join(" ")}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(109,40,217,0.12),transparent_45%)] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-zinc-100">
              {title}
            </p>
            <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-zinc-500">
              {draft ? draftLabel : timestamp ?? ""}
            </p>
          </div>
          {onDelete ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  onDelete();
                }
              }}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:text-zinc-500 dark:hover:bg-red-500/10 dark:hover:text-red-300"
              aria-label={deleteLabel}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </span>
          ) : null}
        </div>
        <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
          {preview || "Start a fresh thread for a different task or question."}
        </p>
      </div>
    </button>
  );
}

export function ChatSessionPanel({
  sessions,
  activeSessionId,
  isLoading,
  onSelectSession,
  onDeleteSession,
  onStartDraft,
}: {
  sessions: ChatSessionSummary[];
  activeSessionId: string | null;
  isLoading: boolean;
  onSelectSession: (sessionId: string | null) => void;
  onDeleteSession: (sessionId: string) => void;
  onStartDraft: () => void;
}) {
  const t = useTranslation();
  const deleteLabel = t("chat.deleteSession");
  const draftLabel = t("chat.sessionDraftLabel");
  const displaySessions =
    activeSessionId === null
      ? [
          {
            id: DRAFT_SESSION_ID,
            title: t("chat.newSession"),
            lastMessagePreview: t("chat.sessionDraftDescription"),
            lastMessageAt: null,
            createdAt: "",
            updatedAt: "",
          },
          ...sessions,
        ]
      : sessions;

  return (
    <>
      <div className="border-b border-slate-100 px-4 py-3 dark:border-zinc-700/40 sm:hidden">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-zinc-500">
              {t("chat.sessionsTitle")}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
              {t("chat.sessionsSubtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={onStartDraft}
            className="inline-flex items-center gap-2 rounded-full border border-violet-300/60 bg-violet-500/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-700 dark:border-violet-400/30 dark:bg-violet-400/12 dark:text-violet-300"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
            {t("chat.newSession")}
          </button>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {isLoading ? (
            <div className="text-xs text-slate-400 dark:text-zinc-500">
              {t("chat.loadingSessions")}
            </div>
          ) : displaySessions.length === 0 ? (
            <div className="text-xs text-slate-400 dark:text-zinc-500">
              {t("chat.noSavedSessions")}
            </div>
          ) : (
            displaySessions.map((session) => (
              <SessionCard
                key={session.id}
                compact
                title={session.title}
                preview={session.lastMessagePreview}
                timestamp={formatSessionTime(session.lastMessageAt ?? session.updatedAt)}
                active={session.id === DRAFT_SESSION_ID ? activeSessionId === null : activeSessionId === session.id}
                draft={session.id === DRAFT_SESSION_ID}
                deleteLabel={deleteLabel}
                draftLabel={draftLabel}
                onClick={() => onSelectSession(session.id === DRAFT_SESSION_ID ? null : session.id)}
                onDelete={
                  session.id === DRAFT_SESSION_ID ? undefined : () => onDeleteSession(session.id)
                }
              />
            ))
          )}
        </div>
      </div>

      <aside className="hidden w-56 shrink-0 border-r border-slate-100 bg-slate-50/70 dark:border-zinc-700/40 dark:bg-zinc-950/30 sm:flex sm:flex-col">
        <div className="border-b border-slate-100 px-4 py-4 dark:border-zinc-700/40">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-zinc-500">
            {t("chat.sessionsTitle")}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            {t("chat.sessionsSubtitle")}
          </p>
          <button
            type="button"
            onClick={onStartDraft}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-violet-300/60 bg-violet-500/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-700 transition-colors hover:bg-violet-500/16 dark:border-violet-400/30 dark:bg-violet-400/12 dark:text-violet-300 dark:hover:bg-violet-400/16"
          >
            <MessageSquarePlus className="h-4 w-4" />
            {t("chat.newSession")}
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
          {isLoading ? (
            <div className="rounded-2xl border border-slate-200/80 bg-white/70 px-3 py-4 text-xs text-slate-400 dark:border-zinc-700/70 dark:bg-zinc-900/70 dark:text-zinc-500">
              {t("chat.loadingSessions")}
            </div>
          ) : displaySessions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-3 py-4 text-xs leading-relaxed text-slate-400 dark:border-zinc-700 dark:text-zinc-500">
              {t("chat.noSavedSessions")}
            </div>
          ) : (
            displaySessions.map((session) => (
              <SessionCard
                key={session.id}
                title={session.title}
                preview={session.lastMessagePreview}
                timestamp={formatSessionTime(session.lastMessageAt ?? session.updatedAt)}
                active={session.id === DRAFT_SESSION_ID ? activeSessionId === null : activeSessionId === session.id}
                draft={session.id === DRAFT_SESSION_ID}
                deleteLabel={deleteLabel}
                draftLabel={draftLabel}
                onClick={() => onSelectSession(session.id === DRAFT_SESSION_ID ? null : session.id)}
                onDelete={
                  session.id === DRAFT_SESSION_ID ? undefined : () => onDeleteSession(session.id)
                }
              />
            ))
          )}
        </div>
      </aside>
    </>
  );
}
