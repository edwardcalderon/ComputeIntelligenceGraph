"use client";

import { useState } from "react";
import { Check, MessageSquarePlus, Pencil, Trash2, X } from "lucide-react";
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

function SessionItem({
  title,
  preview,
  timestamp,
  active,
  draft = false,
  deleteLabel,
  draftLabel,
  renameLabel,
  pending = false,
  editing = false,
  onClick,
  onDelete,
  onStartEdit,
  onRename,
  onCancelEdit,
}: {
  title: string;
  preview: string | null;
  timestamp: string | null;
  active: boolean;
  draft?: boolean;
  deleteLabel: string;
  draftLabel: string;
  renameLabel: string;
  pending?: boolean;
  editing?: boolean;
  onClick: () => void;
  onDelete?: () => void;
  onStartEdit?: () => void;
  onRename?: (title: string) => void;
  onCancelEdit?: () => void;
}) {
  const [value, setValue] = useState(title);

  function submitRename() {
    const nextTitle = value.trim();
    if (!nextTitle || !onRename) {
      return;
    }

    onRename(nextTitle);
  }

  return (
    <div
      className={[
        "group flex items-start gap-2 rounded-xl border px-2.5 py-2 transition-all duration-200",
        active
          ? "border-violet-300/70 bg-violet-500/8 shadow-[0_10px_24px_rgba(109,40,217,0.08)] dark:border-violet-400/30 dark:bg-violet-400/10"
          : "border-transparent bg-transparent hover:border-slate-200 hover:bg-white/85 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/85",
      ].join(" ")}
    >
      <span
        className={[
          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
          active
            ? "bg-violet-500 shadow-[0_0_0_3px_rgba(109,40,217,0.12)] dark:bg-violet-300"
            : "bg-slate-300 dark:bg-zinc-600",
        ].join(" ")}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          {editing ? (
            <input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submitRename();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setValue(title);
                  onCancelEdit?.();
                }
              }}
              aria-label={renameLabel}
              className="min-w-0 flex-1 rounded-md border border-violet-200 bg-white px-2 py-1 text-sm font-medium text-slate-800 outline-none ring-0 placeholder:text-slate-400 focus:border-violet-300 dark:border-violet-400/30 dark:bg-zinc-900 dark:text-zinc-100"
            />
          ) : (
            <button
              type="button"
              onClick={onClick}
              className="min-w-0 flex-1 text-left"
            >
              <span className="block truncate text-sm font-medium text-slate-800 dark:text-zinc-100">
                {title}
              </span>
            </button>
          )}
          <span className="shrink-0 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400 dark:text-zinc-500">
            {draft ? draftLabel : timestamp ?? ""}
          </span>
        </div>
        <button
          type="button"
          onClick={onClick}
          className="mt-1 block min-w-0 text-left"
          disabled={editing}
        >
          <span className="block truncate text-[11px] leading-5 text-slate-500 dark:text-zinc-400">
            {preview || "Start a fresh thread."}
          </span>
        </button>
      </div>

      {!draft ? (
        <div className="mt-0.5 flex shrink-0 items-center gap-1">
          {editing ? (
            <>
              <button
                type="button"
                onClick={submitRename}
                aria-label={renameLabel}
                disabled={pending}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-emerald-600 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setValue(title);
                  onCancelEdit?.();
                }}
                aria-label="Cancel"
                disabled={pending}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onStartEdit}
                aria-label={renameLabel}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-violet-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-violet-300"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              {onDelete ? (
                <button
                  type="button"
                  onClick={onDelete}
                  aria-label={deleteLabel}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:text-zinc-500 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function SessionPill({
  title,
  timestamp,
  active,
  draft = false,
  draftLabel,
  onClick,
}: {
  title: string;
  timestamp: string | null;
  active: boolean;
  draft?: boolean;
  draftLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex min-w-0 items-center gap-2 rounded-full border px-3 py-2 text-left transition-colors",
        active
          ? "border-violet-300/70 bg-violet-500/10 text-violet-700 dark:border-violet-400/30 dark:bg-violet-400/12 dark:text-violet-300"
          : "border-slate-200/80 bg-white/80 text-slate-600 dark:border-zinc-700/80 dark:bg-zinc-900/80 dark:text-zinc-300",
      ].join(" ")}
    >
      <span
        className={[
          "h-2 w-2 shrink-0 rounded-full",
          active ? "bg-violet-500 dark:bg-violet-300" : "bg-slate-300 dark:bg-zinc-600",
        ].join(" ")}
      />
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium">{title}</span>
        <span className="block truncate text-[9px] uppercase tracking-[0.14em] text-slate-400 dark:text-zinc-500">
          {draft ? draftLabel : timestamp ?? ""}
        </span>
      </span>
    </button>
  );
}

export function ChatSessionPanel({
  sessions,
  activeSessionId,
  isLoading,
  pendingSessionId,
  onSelectSession,
  onDeleteSession,
  onRenameSession,
  onStartDraft,
  desktopOpen = true,
}: {
  sessions: ChatSessionSummary[];
  activeSessionId: string | null;
  isLoading: boolean;
  pendingSessionId?: string | null;
  onSelectSession: (sessionId: string | null) => void;
  onDeleteSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, title: string) => void | Promise<void>;
  onStartDraft: () => void;
  desktopOpen?: boolean;
}) {
  const t = useTranslation();
  const deleteLabel = t("chat.deleteSession");
  const renameLabel = t("chat.renameSession");
  const draftLabel = t("chat.sessionDraftLabel");
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
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
      <div className="border-b border-slate-100 px-3 py-2.5 dark:border-zinc-700/40 sm:hidden">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-zinc-500">
              {t("chat.sessionsTitle")}
            </p>
            {displaySessions.length > 0 ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-zinc-800 dark:text-zinc-400">
                {displaySessions.length}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onStartDraft}
            aria-label={t("chat.newSession")}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-violet-300/60 bg-violet-500/10 text-violet-700 dark:border-violet-400/30 dark:bg-violet-400/12 dark:text-violet-300"
          >
            <MessageSquarePlus className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
              <SessionPill
                key={session.id}
                title={session.title}
                timestamp={formatSessionTime(session.lastMessageAt ?? session.updatedAt)}
                active={
                  session.id === DRAFT_SESSION_ID
                    ? activeSessionId === null
                    : activeSessionId === session.id
                }
                draft={session.id === DRAFT_SESSION_ID}
                draftLabel={draftLabel}
                onClick={() =>
                  onSelectSession(session.id === DRAFT_SESSION_ID ? null : session.id)
                }
              />
            ))
          )}
        </div>
      </div>

      <aside className={[
        "w-48 shrink-0 border-r border-slate-100 bg-slate-50/55 dark:border-zinc-700/40 dark:bg-zinc-950/20 sm:flex-col",
        desktopOpen ? "hidden sm:flex" : "hidden",
      ].join(" ")}>
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-3 dark:border-zinc-700/40">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-zinc-500">
              {t("chat.sessionsTitle")}
            </p>
            {displaySessions.length > 0 ? (
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500 shadow-sm dark:bg-zinc-800 dark:text-zinc-400">
                {displaySessions.length}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onStartDraft}
            aria-label={t("chat.newSession")}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-violet-300/60 bg-violet-500/10 text-violet-700 transition-colors hover:bg-violet-500/16 dark:border-violet-400/30 dark:bg-violet-400/12 dark:text-violet-300 dark:hover:bg-violet-400/16"
          >
            <MessageSquarePlus className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto px-2 py-2">
          {isLoading ? (
            <div className="rounded-xl px-2 py-3 text-xs text-slate-400 dark:text-zinc-500">
              {t("chat.loadingSessions")}
            </div>
          ) : displaySessions.length === 0 ? (
            <div className="rounded-xl px-2 py-3 text-xs leading-relaxed text-slate-400 dark:text-zinc-500">
              {t("chat.noSavedSessions")}
            </div>
          ) : (
            displaySessions.map((session) => (
              <SessionItem
                key={`${session.id}:${session.title}`}
                title={session.title}
                preview={session.lastMessagePreview}
                timestamp={formatSessionTime(session.lastMessageAt ?? session.updatedAt)}
                active={
                  session.id === DRAFT_SESSION_ID
                    ? activeSessionId === null
                    : activeSessionId === session.id
                }
                draft={session.id === DRAFT_SESSION_ID}
                deleteLabel={deleteLabel}
                draftLabel={draftLabel}
                renameLabel={renameLabel}
                pending={pendingSessionId === session.id}
                editing={editingSessionId === session.id}
                onClick={() =>
                  onSelectSession(session.id === DRAFT_SESSION_ID ? null : session.id)
                }
                onStartEdit={
                  session.id === DRAFT_SESSION_ID
                    ? undefined
                    : () => setEditingSessionId(session.id)
                }
                onRename={
                  session.id === DRAFT_SESSION_ID
                    ? undefined
                    : async (title) => {
                        await onRenameSession(session.id, title);
                        setEditingSessionId(null);
                      }
                }
                onCancelEdit={() => setEditingSessionId(null)}
                onDelete={
                  session.id === DRAFT_SESSION_ID
                    ? undefined
                    : () => onDeleteSession(session.id)
                }
              />
            ))
          )}
        </div>
      </aside>
    </>
  );
}
