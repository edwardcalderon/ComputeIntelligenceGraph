"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import {
  Bot,
  ChevronDown,
  Code,
  Info,
  Link,
  Maximize2,
  Mic,
  Minimize2,
  MessageSquarePlus,
  Paperclip,
  Send,
  X,
} from "lucide-react";
import { useTranslation } from "@cig-technology/i18n/react";
import {
  deleteChatSession,
  getChatSessionMessages,
  getChatSessions,
  getHealth,
  sendChatMessage,
  type ChatMessage,
  type ChatSessionSummary,
  type HealthResponse,
} from "../lib/api";
import { ChatTemplatesTab } from "./ChatExamplesTab";
import { ChatSessionPanel } from "./ChatSessionPanel";

const ACTIVE_SESSION_STORAGE_KEY = "cig-chat-active-session";
const MAX_CHARS = 2000;

function isMissingChatSessionsRouteError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\b404\b/.test(message) && /chat\/sessions|not found/i.test(message);
}

function readStoredActiveSessionId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return sessionStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
}

function writeStoredActiveSessionId(sessionId: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!sessionId) {
    sessionStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
    return;
  }

  sessionStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, sessionId);
}

export function ChatWidget() {
  const t = useTranslation();

  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "templates">("chat");
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [sessionHistoryAvailable, setSessionHistoryAvailable] = useState(true);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasHydratedSessions, setHasHydratedSessions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthReady, setHealthReady] = useState(false);
  const [isStatusTooltipOpen, setIsStatusTooltipOpen] = useState(false);
  const [statusTooltipPosition, setStatusTooltipPosition] = useState<{ left: number; top: number } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const statusPillRef = useRef<HTMLButtonElement>(null);
  const statusTooltipCloseTimerRef = useRef<number | null>(null);
  const sessionMessagesRequestRef = useRef(0);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let intervalId: number | undefined;

    const refreshHealth = async () => {
      try {
        const next = await getHealth();
        if (cancelled) {
          return;
        }
        setHealth(next);
        setHealthReady(true);
      } catch {
        if (!cancelled) {
          setHealth(null);
          setHealthReady(true);
        }
      }
    };

    void refreshHealth();
    intervalId = window.setInterval(() => {
      void refreshHealth();
    }, 20_000);

    return () => {
      cancelled = true;
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
      }
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen) setTimeout(() => textareaRef.current?.focus(), 50);
  }, [isOpen]);

  async function refreshSessions(preferredSessionId?: string | null): Promise<string | null> {
    try {
      const next = await getChatSessions();
      setSessionHistoryAvailable(true);
      setSessions(next.items);

      const resolvedSessionId =
        preferredSessionId && next.items.some((session) => session.id === preferredSessionId)
          ? preferredSessionId
          : next.items[0]?.id ?? null;

      setActiveSessionId(resolvedSessionId);
      writeStoredActiveSessionId(resolvedSessionId);
      return resolvedSessionId;
    } catch (err) {
      if (isMissingChatSessionsRouteError(err)) {
        setSessionHistoryAvailable(false);
        setSessions([]);
        setActiveSessionId(null);
        writeStoredActiveSessionId(null);
        return null;
      }

      throw err;
    }
  }

  async function loadSessionMessages(sessionId: string | null) {
    const requestId = sessionMessagesRequestRef.current + 1;
    sessionMessagesRequestRef.current = requestId;

    if (!sessionId) {
      setIsLoadingMessages(false);
      setMessages([]);
      return;
    }

    setIsLoadingMessages(true);
    try {
      const next = await getChatSessionMessages(sessionId);
      if (sessionMessagesRequestRef.current !== requestId) {
        return;
      }
      setMessages(next.items);
    } catch (err) {
      if (sessionMessagesRequestRef.current !== requestId) {
        return;
      }
      setError(err instanceof Error ? err.message : t("chat.errorFallback"));
      setMessages([]);
    } finally {
      if (sessionMessagesRequestRef.current === requestId) {
        setIsLoadingMessages(false);
      }
    }
  }

  useEffect(() => {
    if (!isOpen || hasHydratedSessions) {
      return;
    }

    let cancelled = false;

    const bootstrapSessions = async () => {
      setIsLoadingSessions(true);
      setError(null);

      try {
        const nextSessions = await getChatSessions();
        if (cancelled) {
          return;
        }

        setSessionHistoryAvailable(true);
        setSessions(nextSessions.items);
        const storedSessionId = readStoredActiveSessionId();
        const nextActiveSessionId =
          storedSessionId && nextSessions.items.some((session) => session.id === storedSessionId)
            ? storedSessionId
            : nextSessions.items[0]?.id ?? null;

        setActiveSessionId(nextActiveSessionId);
        writeStoredActiveSessionId(nextActiveSessionId);

        if (nextActiveSessionId) {
          await loadSessionMessages(nextActiveSessionId);
        } else {
          setMessages([]);
        }
      } catch (err) {
        if (!cancelled) {
          if (isMissingChatSessionsRouteError(err)) {
            setSessionHistoryAvailable(false);
            setSessions([]);
            setActiveSessionId(null);
            writeStoredActiveSessionId(null);
            setMessages([]);
          } else {
            setError(err instanceof Error ? err.message : t("chat.errorFallback"));
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSessions(false);
          setHasHydratedSessions(true);
        }
      }
    };

    void bootstrapSessions();

    return () => {
      cancelled = true;
    };
  }, [hasHydratedSessions, isOpen, t]);

  function handleClose() {
    setIsOpen(false);
    setIsExpanded(false);
  }

  function clearStatusTooltipCloseTimer() {
    if (statusTooltipCloseTimerRef.current !== null) {
      window.clearTimeout(statusTooltipCloseTimerRef.current);
      statusTooltipCloseTimerRef.current = null;
    }
  }

  function updateStatusTooltipPosition() {
    const anchor = statusPillRef.current;
    if (!anchor) {
      return;
    }

    const rect = anchor.getBoundingClientRect();
    const width = Math.min(240, window.innerWidth - 24);
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
    const top = Math.min(window.innerHeight - 12, rect.bottom + 10);

    setStatusTooltipPosition({ left, top });
  }

  function openStatusTooltip() {
    clearStatusTooltipCloseTimer();
    setIsStatusTooltipOpen(true);
    updateStatusTooltipPosition();
  }

  function closeStatusTooltipSoon() {
    clearStatusTooltipCloseTimer();
    statusTooltipCloseTimerRef.current = window.setTimeout(() => {
      setIsStatusTooltipOpen(false);
    }, 80);
  }

  function handleUseTemplate(prompt: string) {
    setActiveTab("chat");
    setInput(prompt);
    setError(null);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(prompt.length, prompt.length);
    });
  }

  function handleStartDraft() {
    setActiveTab("chat");
    setError(null);
    setInput("");
    setActiveSessionId(null);
    setMessages([]);
    writeStoredActiveSessionId(null);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  async function handleSelectSession(sessionId: string | null) {
    setActiveTab("chat");
    setError(null);
    setInput("");
    setActiveSessionId(sessionId);
    writeStoredActiveSessionId(sessionId);
    await loadSessionMessages(sessionId);
  }

  async function handleDeleteSession(sessionId: string) {
    if (!window.confirm(t("chat.deleteSessionConfirm"))) {
      return;
    }

    setIsLoadingSessions(true);
    setError(null);

    try {
      await deleteChatSession(sessionId);
      const nextActiveSessionId =
        activeSessionId === sessionId ? undefined : activeSessionId;
      const resolvedSessionId = await refreshSessions(nextActiveSessionId);

      if (resolvedSessionId) {
        await loadSessionMessages(resolvedSessionId);
      } else {
        setMessages([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("chat.errorFallback"));
    } finally {
      setIsLoadingSessions(false);
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setError(null);
    setIsLoading(true);

    try {
      const res = await sendChatMessage(text, activeSessionId ?? undefined);
      const content =
        res.needsClarification && res.clarifyingQuestion
          ? res.clarifyingQuestion
          : res.answer;
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content,
        timestamp: new Date().toISOString(),
      };
      const updated = [...next, assistantMsg];
      setMessages(updated);
      const resolvedSessionId = res.sessionId ?? activeSessionId ?? null;
      if (resolvedSessionId) {
        setActiveSessionId(resolvedSessionId);
        writeStoredActiveSessionId(resolvedSessionId);
        try {
          await refreshSessions(resolvedSessionId);
        } catch {
          // The exchange already succeeded; keep the live thread visible even if
          // the sidebar refresh fails.
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("chat.errorFallback"));
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const chatModel = health?.chat?.model?.trim() || "gpt-4o-mini";
  const chatProvider = health?.chat?.provider ?? (healthReady ? "fallback" : "openai");
  const chatIsConnected = health?.chat?.reachable ?? false;
  const chatProviderReachable = health?.chat?.providerReachable ?? false;
  const chatIndicatorHealthy =
    chatIsConnected && (!health?.chat?.configured || chatProviderReachable);
  const chatLastChecked = health?.chat?.checkedAt
    ? new Date(health.chat.checkedAt).toLocaleString()
    : null;
  const chatStatus = !healthReady
    ? "CHECKING"
    : chatIsConnected
    ? "CONNECTED"
    : health?.chat?.configured
    ? "OFFLINE"
    : "FALLBACK";
  const chatStatusDescription = !healthReady
    ? "Checking chat backend health..."
    : !chatIsConnected
    ? "Chat endpoint is not registered on this API instance."
    : !health?.chat?.configured
    ? "Chat endpoint is live in fallback mode."
    : chatProviderReachable
    ? "Chat backend is reachable and ready."
    : "Chat endpoint is live, but OpenAI is not reachable right now.";

  useEffect(() => {
    if (!isStatusTooltipOpen) {
      return;
    }

    updateStatusTooltipPosition();
    const handleViewportChange = () => updateStatusTooltipPosition();
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [isStatusTooltipOpen, chatModel, chatStatus, chatProvider, chatIndicatorHealthy, chatProviderReachable, chatLastChecked]);

  return (
    <>
      {/* Mobile backdrop — only when sheet is not full-screen */}
      {isOpen && !(isExpanded && isMobile) && (
        <button
          type="button"
          aria-label={t("chat.closeChat")}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm sm:hidden"
          onClick={handleClose}
        />
      )}

      {/* Desktop expanded backdrop */}
      {isOpen && isExpanded && (
        <button
          type="button"
          aria-label={t("chat.minimize")}
          className="fixed inset-0 z-40 hidden bg-black/50 backdrop-blur-sm sm:block"
          onClick={() => setIsExpanded(false)}
        />
      )}

      {/* FAB — hidden on mobile while panel is open */}
      <div
        className={`fixed bottom-20 right-4 z-[60] sm:right-6 ${
          isOpen ? "hidden sm:block" : ""
        }`}
      >
        <button
          aria-label={isOpen ? t("chat.closeChat") : t("chat.openChat")}
          onClick={() => setIsOpen((v) => !v)}
          className="floating-ai-button relative flex h-11 w-11 items-center justify-center rounded-full transition-all duration-500"
          style={{
            background:
              "linear-gradient(135deg, rgba(99,102,241,0.85) 0%, rgba(168,85,247,0.85) 100%)",
            boxShadow:
              "0 0 20px rgba(139,92,246,0.7), 0 0 40px rgba(124,58,237,0.5), 0 0 60px rgba(109,40,217,0.3)",
            border: "2px solid rgba(255,255,255,0.2)",
            transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
          }}
        >
          <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/20 to-transparent opacity-30" />
          <div className="absolute inset-0 rounded-full border-2 border-white/10" />
          <div className="relative z-10">
            {isOpen ? (
              <X className="h-6 w-6 text-white" />
            ) : (
              <Bot className="h-6 w-6 text-white" />
            )}
          </div>
          <div className="absolute inset-0 animate-ping rounded-full bg-indigo-500 opacity-20" />
        </button>
      </div>

      {/* Chat panel */}
      {isOpen && (
        <div
          className={
            isExpanded && isMobile
              ? // Mobile fullscreen
                "fixed inset-0 z-50"
              : isExpanded
              ? // Desktop expanded modal
                "fixed z-50 hidden sm:block rounded-3xl"
              : // Compact: mobile sheet or desktop floating
                "fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl sm:bottom-32 sm:left-auto sm:right-6 sm:w-[480px] sm:rounded-3xl"
          }
          style={
            isExpanded && isMobile
              ? { animation: "slideUp 0.35s cubic-bezier(0.175,0.885,0.32,1.275) forwards" }
              : isExpanded
              ? {
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: "min(720px, 95vw)",
                  height: "min(85vh, 800px)",
                  animation: "fadeIn 0.2s ease-out forwards",
                }
              : {
                  animation: "popIn 0.3s cubic-bezier(0.175,0.885,0.32,1.275) forwards",
                }
          }
        >
          {/* ── Inner panel ─────────────────────────────────────────── */}
          <div
            className={[
              "relative flex flex-col overflow-hidden",
              isExpanded && isMobile
                ? "rounded-none h-full"
                : isExpanded
                ? "rounded-3xl h-full"
                : "rounded-t-3xl sm:rounded-3xl max-h-[88vh] sm:max-h-none",
              // Light — solid white, no blur
              "border border-slate-200 bg-white shadow-xl shadow-slate-200/60",
              // Dark — solid, no blur
              "dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-2xl dark:shadow-black/60",
            ].join(" ")}
            style={{
              // Dark gradient applied via inline so we don't fight Tailwind bg utilities
              // It's overridden to transparent in light via the class above;
              // JS reads the .dark class to decide whether to paint the gradient.
            }}
          >
            {/* Dark-mode solid fill (hidden in light via CSS) — no transparency */}
            <div
              className={`pointer-events-none absolute inset-0 opacity-0 dark:opacity-100 transition-opacity ${
                isExpanded && isMobile ? "rounded-none" : "rounded-t-3xl sm:rounded-3xl"
              }`}
              style={{ background: "rgb(24 24 27)" }}
            />

            {/* Colour accent overlay — subtle in both modes */}
            <div
              className="pointer-events-none absolute inset-0 rounded-3xl"
              style={{
                background:
                  "linear-gradient(135deg, rgba(99,102,241,0.04), transparent 50%, rgba(168,85,247,0.04))",
              }}
            />

            {/* Mobile drag handle — tap to expand / collapse */}
            <button
              className="relative z-10 flex w-full cursor-pointer items-center justify-center pb-1 pt-3 sm:hidden"
              onClick={() => setIsExpanded((v) => !v)}
              aria-label={isExpanded ? t("chat.collapseMobile") : t("chat.expandMobile")}
            >
              {isExpanded ? (
                <ChevronDown className="h-5 w-5 text-slate-400 dark:text-zinc-500" />
              ) : (
                <div className="h-1 w-10 rounded-full bg-slate-300 dark:bg-zinc-600" />
              )}
            </button>

            {/* ── Header ──────────────────────────────────────────── */}
            <div className="relative z-10 grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-slate-100 px-4 pb-3 pt-3 dark:border-zinc-700/40 sm:px-6 sm:pt-4">
              <span className="sr-only">{t("chat.title")}</span>
              <div
                className="relative z-[80] min-w-0 max-w-full sm:max-w-[68%]"
                onPointerEnter={openStatusTooltip}
                onPointerLeave={closeStatusTooltipSoon}
              >
                <button
                  ref={statusPillRef}
                  type="button"
                  aria-describedby="chat-status-tooltip"
                  aria-expanded={isStatusTooltipOpen}
                  aria-controls="chat-status-tooltip"
                  aria-label={`Chat backend status: ${chatModel}, ${chatStatus}`}
                  data-testid="chat-status-pill"
                  className={[
                    "inline-flex max-w-full items-center gap-2 rounded-full border px-1.5 py-1 sm:px-3 sm:py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] transition-all duration-200 backdrop-blur-xl focus:outline-none focus:ring-2 focus:ring-emerald-300/70 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-emerald-400/40 dark:focus:ring-offset-zinc-900",
                    chatIndicatorHealthy
                      ? "border-emerald-300/30 bg-white/36 text-slate-700 shadow-[0_6px_20px_rgba(16,185,129,0.06)] dark:border-emerald-400/15 dark:bg-zinc-950/18 dark:text-zinc-100"
                      : "border-slate-200/70 bg-white/28 text-slate-600 shadow-[0_6px_20px_rgba(15,23,42,0.04)] dark:border-zinc-700/55 dark:bg-zinc-950/20 dark:text-zinc-300",
                    ].join(" ")}
                  onFocus={openStatusTooltip}
                  onBlur={closeStatusTooltipSoon}
                  onClick={() => {
                    if (isStatusTooltipOpen) {
                      closeStatusTooltipSoon();
                      return;
                    }
                    openStatusTooltip();
                  }}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5 items-center justify-center">
                      <span
                        className={[
                          "absolute h-2.5 w-2.5 rounded-full",
                          chatIndicatorHealthy
                            ? "animate-ping bg-emerald-400/22"
                            : "bg-slate-400/20",
                        ].join(" ")}
                      />
                      <span
                        className={[
                          "relative h-2 w-2 rounded-full",
                          chatIndicatorHealthy
                            ? "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.1)]"
                            : "bg-slate-400 dark:bg-zinc-500",
                        ].join(" ")}
                      />
                    </span>
                    <span className="hidden max-w-[6.5rem] truncate normal-case tracking-normal sm:inline sm:max-w-[7.5rem] sm:tracking-[0.1em]">
                      {chatModel}
                    </span>
                    <span
                      className={[
                        "hidden rounded-full border px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.15em] backdrop-blur-md sm:inline",
                        chatIndicatorHealthy
                          ? "border-emerald-200/55 bg-emerald-500/8 text-emerald-700 dark:border-emerald-400/15 dark:bg-emerald-400/10 dark:text-emerald-300"
                          : "border-slate-300/70 bg-white/30 text-slate-500 dark:border-zinc-600/70 dark:bg-zinc-950/28 dark:text-zinc-400",
                      ].join(" ")}
                    >
                      {chatStatus}
                    </span>
                  </span>
                </button>

              </div>
              {/* Tab switcher */}
              <div className="flex items-center self-center rounded-lg border border-slate-200/80 bg-slate-50 p-0.5 dark:border-zinc-700/50 dark:bg-zinc-800/40">
                {(["chat", "templates"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={[
                      "rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition-all",
                      activeTab === tab
                        ? "bg-white text-slate-700 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                        : "text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300",
                      ].join(" ")}
                  >
                    {t(tab === "chat" ? "chat.tabChat" : "chat.tabExamples")}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 self-center">
                {/* Expand / collapse — desktop only */}
                <button
                  onClick={() => setIsExpanded((v) => !v)}
                  aria-label={isExpanded ? t("chat.collapse") : t("chat.expand")}
                  title={isExpanded ? t("chat.collapse") : t("chat.expand")}
                  className="hidden items-center justify-center rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-700/50 sm:flex"
                >
                  {isExpanded ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={handleClose}
                  aria-label={t("chat.closeChat")}
                  className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-700/50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* ── Examples tab ────────────────────────────────────── */}
            {activeTab === "templates" && (
              <div
                className={[
                  "relative z-10 flex min-h-0 flex-col",
                  isExpanded ? "flex-1" : "h-[62vh] sm:h-[34rem]",
                ].join(" ")}
              >
                <ChatTemplatesTab onUseTemplate={handleUseTemplate} />
              </div>
            )}

            {activeTab !== "templates" && (
              <div
                className={[
                  "relative z-10 flex min-h-0 flex-col sm:flex-row",
                  isExpanded ? "flex-1" : "",
                ].join(" ")}
              >
                {sessionHistoryAvailable ? (
                  <ChatSessionPanel
                    sessions={sessions}
                    activeSessionId={activeSessionId}
                    isLoading={isLoadingSessions}
                    onSelectSession={handleSelectSession}
                    onDeleteSession={handleDeleteSession}
                    onStartDraft={handleStartDraft}
                  />
                ) : null}

                <div className="flex min-h-0 flex-1 flex-col">
                  <div
                    className={[
                      "relative z-10 space-y-3 overflow-y-auto px-4 py-4 sm:px-6",
                      isExpanded ? "min-h-0 flex-1" : "max-h-[38vh] sm:max-h-80",
                    ].join(" ")}
                  >
                    {isLoadingMessages && messages.length === 0 ? (
                      <div className="mt-4 flex justify-center">
                        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-500">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
                          {t("chat.loadingSessions")}
                        </div>
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="mx-auto mt-4 max-w-sm rounded-3xl border border-dashed border-slate-200 bg-slate-50/70 px-5 py-5 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
                        <p className="text-sm font-semibold text-slate-700 dark:text-zinc-200">
                          {activeSessionId ? t("chat.emptySession") : t("chat.emptyState")}
                        </p>
                        <p className="mt-2 text-xs leading-relaxed text-slate-400 dark:text-zinc-500">
                          {activeSessionId
                            ? t("chat.emptySessionHint")
                            : t("chat.emptyStateHint")}
                        </p>
                        {!activeSessionId ? (
                          <button
                            type="button"
                            onClick={handleStartDraft}
                            className="mt-4 inline-flex items-center gap-2 rounded-full border border-violet-300/60 bg-violet-500/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-700 dark:border-violet-400/30 dark:bg-violet-400/12 dark:text-violet-300"
                          >
                            <MessageSquarePlus className="h-3.5 w-3.5" />
                            {t("chat.newSession")}
                          </button>
                        ) : null}
                      </div>
                    ) : null}

                    {messages.map((msg, index) => (
                      <div
                        key={msg.id ?? `${msg.role}-${msg.timestamp}-${index}`}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={[
                            "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm",
                            msg.role === "user"
                              ? [
                                  "rounded-br-sm border",
                                  "border-indigo-200/60 bg-gradient-to-br from-indigo-50 to-purple-50 text-slate-800",
                                  "dark:border-indigo-500/20 dark:from-indigo-500/20 dark:to-purple-600/20 dark:text-white/90",
                                ].join(" ")
                              : [
                                  "rounded-bl-sm border",
                                  "border-slate-200/70 bg-slate-50 text-slate-700",
                                  "dark:border-white/[0.06] dark:bg-white/[0.04] dark:text-white/70",
                                ].join(" "),
                          ].join(" ")}
                        >
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex justify-start">
                        <div className="rounded-2xl rounded-bl-sm border border-slate-200/70 bg-slate-50 px-3.5 py-2.5 dark:border-white/[0.06] dark:bg-white/[0.04]">
                          <span className="flex items-center gap-1">
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400/70 [animation-delay:-0.3s] dark:bg-indigo-400/60" />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400/70 [animation-delay:-0.15s] dark:bg-indigo-400/60" />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400/70 dark:bg-indigo-400/60" />
                          </span>
                        </div>
                      </div>
                    )}
                    {error && (
                      <p className="text-center text-xs text-red-500 dark:text-red-400/80">
                        {error}
                      </p>
                    )}
                    <div ref={bottomRef} />
                  </div>

                  <div className="relative z-10 border-t border-slate-100 dark:border-zinc-700/40">
                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value.slice(0, MAX_CHARS))}
                      onKeyDown={handleKeyDown}
                      rows={isExpanded ? 5 : 3}
                      disabled={isLoading || isLoadingMessages}
                      placeholder={t("chat.placeholder")}
                      className="w-full resize-none bg-transparent px-4 py-4 text-sm leading-relaxed text-slate-800 placeholder-slate-400 outline-none disabled:opacity-50 dark:text-zinc-100 dark:placeholder-zinc-500 sm:px-6"
                      style={{ scrollbarWidth: "none" }}
                    />
                  </div>

                  <div className="relative z-10 px-3 pb-3 sm:px-4 sm:pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-0.5 rounded-xl border border-slate-200/70 bg-slate-50 p-1 dark:border-zinc-700/50 dark:bg-zinc-800/40">
                          {[
                            { icon: Paperclip, label: t("chat.uploadFiles") },
                            { icon: Link, label: t("chat.webLink") },
                            { icon: Code, label: t("chat.codeRepo") },
                          ].map(({ icon: Icon, label }) => (
                            <button
                              key={label}
                              title={label}
                              className="rounded-lg p-2 text-slate-400 transition-all duration-200 hover:bg-slate-100 hover:text-slate-600 dark:text-zinc-500 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-200 sm:p-2.5"
                            >
                              <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </button>
                          ))}
                        </div>
                        <button
                          title={t("chat.voiceInput")}
                          className="rounded-lg border border-slate-200/70 p-2 text-slate-400 transition-all duration-200 hover:border-red-200 hover:bg-red-50 hover:text-red-500 dark:border-zinc-700/30 dark:text-zinc-500 dark:hover:border-red-500/30 dark:hover:bg-zinc-800/80 dark:hover:text-red-400 sm:p-2.5"
                        >
                          <Mic className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </button>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs font-medium text-slate-400 dark:text-zinc-500">
                          {input.length}
                          <span className="text-slate-300 dark:text-zinc-600">
                            /{MAX_CHARS}
                          </span>
                        </span>
                        <button
                          onClick={handleSend}
                          disabled={isLoading || isLoadingMessages || !input.trim()}
                          aria-label={t("chat.sendMessage")}
                          className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-red-600 to-red-500 p-2.5 text-white shadow-lg transition-all duration-300 hover:from-red-500 hover:to-red-400 hover:scale-110 hover:shadow-red-500/30 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 sm:p-3"
                        >
                          <Send className="h-4 w-4 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:rotate-12 sm:h-5 sm:w-5" />
                          <div className="absolute inset-0 scale-0 rounded-xl bg-white/20 transition-transform duration-200 group-active:scale-100" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-xs text-slate-400 dark:border-zinc-800/50 dark:text-zinc-500 sm:mt-3 sm:pt-3">
                      <div className="hidden items-center gap-2 sm:flex">
                        <Info className="h-3 w-3" />
                        <span>
                          Press{" "}
                          <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-500 shadow-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                            Shift + Enter
                          </kbd>{" "}
                          {t("chat.shiftEnterHint")}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        <span>
                          {activeSessionId
                            ? t("chat.sessionSaved")
                            : t("chat.sessionDraftLabel")}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isStatusTooltipOpen &&
        statusTooltipPosition &&
        createPortal(
          <div
            id="chat-status-tooltip"
            data-testid="chat-status-tooltip"
            role="tooltip"
            onPointerEnter={openStatusTooltip}
            onPointerLeave={closeStatusTooltipSoon}
            className="fixed z-[120] w-[min(13.5rem,calc(100vw-2rem))] origin-top-left transition-all duration-200 ease-out sm:w-[15rem]"
            style={{
              left: `${statusTooltipPosition.left}px`,
              top: `${statusTooltipPosition.top}px`,
            }}
          >
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-[0_22px_48px_rgba(15,23,42,0.16)] backdrop-blur-xl dark:border-white/10 dark:bg-zinc-950/94 dark:shadow-[0_22px_48px_rgba(0,0,0,0.42)]">
              <div className="bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_42%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.1),transparent_38%)] px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold text-slate-900 dark:text-white">{chatModel}</p>
                    <p className="text-[9px] uppercase tracking-[0.16em] text-slate-500 dark:text-zinc-500">
                      {chatProvider === "openai" ? "OpenAI" : "Fallback"}
                    </p>
                  </div>
                  <span
                    className={[
                      "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em]",
                      chatIndicatorHealthy
                        ? "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/12 dark:text-emerald-300"
                        : "bg-slate-500/10 text-slate-600 dark:bg-zinc-800/70 dark:text-zinc-300",
                    ].join(" ")}
                  >
                    {chatStatus}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-1">
                  <span
                    className={[
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-medium",
                      chatProviderReachable
                        ? "bg-cyan-500/10 text-cyan-700 dark:bg-cyan-400/12 dark:text-cyan-300"
                        : "bg-amber-500/10 text-amber-700 dark:bg-amber-400/12 dark:text-amber-300",
                    ].join(" ")}
                  >
                    {chatProviderReachable ? "OpenAI ready" : "OpenAI down"}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-slate-900/5 px-2 py-0.5 text-[9px] font-medium text-slate-600 dark:bg-white/5 dark:text-zinc-300">
                    {chatLastChecked ?? "pending"}
                  </span>
                </div>
              </div>
              <div className="border-t border-slate-200/65 px-3 py-2 dark:border-white/8">
                <p className="text-[9px] leading-relaxed text-slate-500 dark:text-zinc-500">
                  {chatStatusDescription}
                </p>
              </div>
            </div>
          </div>,
          document.body,
        )}

      <style>{`
        @keyframes popIn {
          0% {
            opacity: 0;
            transform: scale(0.9) translateY(20px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        @keyframes fadeIn {
          0% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }
        @keyframes slideUp {
          0% {
            opacity: 0.6;
            transform: translateY(100%);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .floating-ai-button:hover {
          transform: scale(1.1) rotate(5deg) !important;
          box-shadow:
            0 0 30px rgba(139, 92, 246, 0.9),
            0 0 50px rgba(124, 58, 237, 0.7),
            0 0 70px rgba(109, 40, 217, 0.5) !important;
        }
      `}</style>
    </>
  );
}
