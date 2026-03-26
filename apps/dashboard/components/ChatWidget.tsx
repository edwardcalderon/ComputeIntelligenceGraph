"use client";

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
  Paperclip,
  Send,
  X,
} from "lucide-react";
import { useTranslation } from "@cig-technology/i18n/react";
import { sendChatMessage, ChatMessage } from "../lib/api";

const STORAGE_KEY = "cig-chat-history";
const MAX_CHARS = 2000;

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = sessionStorage.getItem("cig-chat-session");
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem("cig-chat-session", id);
  }
  return id;
}

function loadHistory(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(messages: ChatMessage[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // ignore
  }
}

export function ChatWidget() {
  const t = useTranslation();

  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    setMessages(loadHistory());
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen) setTimeout(() => textareaRef.current?.focus(), 50);
  }, [isOpen]);

  function handleClose() {
    setIsOpen(false);
    setIsExpanded(false);
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
    saveHistory(next);
    setInput("");
    setError(null);
    setIsLoading(true);

    try {
      const res = await sendChatMessage(text, getSessionId());
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
      saveHistory(updated);
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

  return (
    <>
      {/* Mobile backdrop — only when sheet is not full-screen */}
      {isOpen && !(isExpanded && isMobile) && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm sm:hidden"
          onClick={handleClose}
        />
      )}

      {/* Desktop expanded backdrop */}
      {isOpen && isExpanded && (
        <div
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
            <div className="relative z-10 flex items-center justify-between border-b border-slate-100 px-4 pb-3 pt-3 dark:border-zinc-700/40 sm:px-6 sm:pt-4">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
                  {t("chat.title")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-2xl bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 dark:bg-zinc-800/60 dark:text-zinc-300">
                  GPT-4
                </span>
                <span className="rounded-2xl border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-500 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
                  Pro
                </span>
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

            {/* ── Messages ────────────────────────────────────────── */}
            <div
              className={[
                "relative z-10 space-y-3 overflow-y-auto px-4 py-4 sm:px-6",
                isExpanded ? "flex-1" : "max-h-[38vh] sm:max-h-64",
              ].join(" ")}
            >
              {messages.length === 0 && (
                <p className="mt-4 text-center text-sm text-slate-400 dark:text-zinc-500">
                  {t("chat.emptyState")}
                </p>
              )}
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={[
                      "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm",
                      msg.role === "user"
                        ? [
                            "rounded-br-sm border",
                            // Light
                            "border-indigo-200/60 bg-gradient-to-br from-indigo-50 to-purple-50 text-slate-800",
                            // Dark
                            "dark:border-indigo-500/20 dark:from-indigo-500/20 dark:to-purple-600/20 dark:text-white/90",
                          ].join(" ")
                        : [
                            "rounded-bl-sm border",
                            // Light
                            "border-slate-200/70 bg-slate-50 text-slate-700",
                            // Dark
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

            {/* ── Textarea ────────────────────────────────────────── */}
            <div className="relative z-10 border-t border-slate-100 dark:border-zinc-700/40">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value.slice(0, MAX_CHARS))}
                onKeyDown={handleKeyDown}
                rows={isExpanded ? 5 : 3}
                disabled={isLoading}
                placeholder={t("chat.placeholder")}
                className="w-full resize-none bg-transparent px-4 py-4 text-sm leading-relaxed text-slate-800 placeholder-slate-400 outline-none disabled:opacity-50 dark:text-zinc-100 dark:placeholder-zinc-500 sm:px-6"
                style={{ scrollbarWidth: "none" }}
              />
            </div>

            {/* ── Toolbar ─────────────────────────────────────────── */}
            <div className="relative z-10 px-3 pb-3 sm:px-4 sm:pb-4">
              <div className="flex items-center justify-between">
                {/* Left: attachments + voice */}
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

                {/* Right: counter + send */}
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-slate-400 dark:text-zinc-500">
                    {input.length}
                    <span className="text-slate-300 dark:text-zinc-600">
                      /{MAX_CHARS}
                    </span>
                  </span>
                  <button
                    onClick={handleSend}
                    disabled={isLoading || !input.trim()}
                    aria-label={t("chat.sendMessage")}
                    className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-red-600 to-red-500 p-2.5 text-white shadow-lg transition-all duration-300 hover:from-red-500 hover:to-red-400 hover:scale-110 hover:shadow-red-500/30 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 sm:p-3"
                  >
                    <Send className="h-4 w-4 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:rotate-12 sm:h-5 sm:w-5" />
                    <div className="absolute inset-0 scale-0 rounded-xl bg-white/20 transition-transform duration-200 group-active:scale-100" />
                  </button>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-xs text-slate-400 dark:border-zinc-800/50 dark:text-zinc-500 sm:mt-3 sm:pt-3">
                {/* Keyboard hint — desktop only */}
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
                <div className="flex items-center gap-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  <span>{t("chat.allSystemsOperational")}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
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
