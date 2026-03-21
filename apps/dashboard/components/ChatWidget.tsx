"use client";

import { useEffect, useRef, useState } from "react";
import { sendChatMessage, ChatMessage } from "../lib/api";

const STORAGE_KEY = "cig-chat-history";

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
  } catch { /* ignore */ }
}

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setMessages(loadHistory()); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isLoading]);
  useEffect(() => { if (isOpen) setTimeout(() => inputRef.current?.focus(), 50); }, [isOpen]);

  async function handleSend() {
    const text = input.trim();
    if (!text || isLoading) return;
    const userMsg: ChatMessage = { role: "user", content: text, timestamp: new Date().toISOString() };
    const next = [...messages, userMsg];
    setMessages(next);
    saveHistory(next);
    setInput("");
    setError(null);
    setIsLoading(true);
    try {
      const res = await sendChatMessage(text, getSessionId());
      const content = res.needsClarification && res.clarifyingQuestion ? res.clarifyingQuestion : res.answer;
      const assistantMsg: ChatMessage = { role: "assistant", content, timestamp: new Date().toISOString() };
      const updated = [...next, assistantMsg];
      setMessages(updated);
      saveHistory(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  return (
    <>
      {!isOpen && (
        <button onClick={() => setIsOpen(true)} aria-label="Open chat"
          className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg hover:shadow-xl transition-all bg-gradient-to-br from-cyan-500 to-blue-600 hover:scale-105">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
            <path d="M4.913 2.658c2.075-.27 4.19-.408 6.337-.408 2.147 0 4.262.139 6.337.408 1.922.25 3.291 1.861 3.405 3.727a4.403 4.403 0 0 0-1.032-.211 50.89 50.89 0 0 0-8.42 0c-2.358.196-4.04 2.19-4.04 4.434v4.286a4.47 4.47 0 0 0 2.433 3.984L7.28 21.53A.75.75 0 0 1 6 21v-4.03a48.527 48.527 0 0 1-1.087-.128C2.905 16.58 1.5 14.833 1.5 12.862V6.638c0-1.97 1.405-3.718 3.413-3.979Z" />
            <path d="M15.75 7.5c-1.376 0-2.739.057-4.086.169C10.124 7.797 9 9.103 9 10.609v4.285c0 1.507 1.128 2.814 2.67 2.94 1.243.102 2.5.157 3.768.165l2.782 2.781a.75.75 0 0 0 1.28-.53v-2.39l.33-.026c1.542-.125 2.67-1.433 2.67-2.94v-4.286c0-1.505-1.125-2.811-2.664-2.94A49.392 49.392 0 0 0 15.75 7.5Z" />
          </svg>
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex w-[380px] flex-col rounded-2xl border border-cig bg-cig-card shadow-xl dark:shadow-[0_20px_60px_rgba(0,0,0,0.7)]"
          style={{ height: "500px" }}>
          {/* Header */}
          <div className="flex items-center justify-between rounded-t-2xl px-4 py-3 border-b border-cig bg-gradient-to-r from-cyan-500/10 to-blue-600/10">
            <div className="flex items-center gap-2.5">
              <div className="size-2 rounded-full bg-cyan-500 dark:bg-cyan-400 dark:shadow-[0_0_6px_rgba(6,182,212,0.6)]" />
              <span className="font-semibold text-sm text-cig-primary">Ask OpenClaw</span>
            </div>
            <button onClick={() => setIsOpen(false)} aria-label="Close chat"
              className="text-cig-muted hover:text-cig-secondary transition-colors rounded-lg p-1 hover:bg-cig-hover">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <p className="text-center text-sm text-cig-muted mt-8">Ask anything about your infrastructure.</p>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={[
                  "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm",
                  msg.role === "user"
                    ? "bg-cyan-600 dark:bg-gradient-to-br dark:from-cyan-500/20 dark:to-blue-600/20 text-white dark:text-white/90 border border-cyan-500/30 rounded-br-sm"
                    : "bg-slate-100 dark:bg-white/[0.04] text-cig-primary border border-cig rounded-bl-sm",
                ].join(" ")}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-100 dark:bg-white/[0.04] border border-cig rounded-2xl rounded-bl-sm px-3.5 py-2.5">
                  <span className="flex gap-1 items-center">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 dark:bg-cyan-400/60 animate-bounce [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 dark:bg-cyan-400/60 animate-bounce [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 dark:bg-cyan-400/60 animate-bounce" />
                  </span>
                </div>
              </div>
            )}
            {error && <p className="text-center text-xs text-red-500 dark:text-red-400">{error}</p>}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-cig p-3 flex gap-2">
            <input ref={inputRef} type="text" value={input}
              onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="Type a message..."  disabled={isLoading}
              className="flex-1 rounded-xl border border-cig bg-cig-base px-3.5 py-2 text-sm text-cig-primary placeholder-cig-muted focus:outline-none focus:ring-1 focus:ring-cyan-500/40 focus:border-cyan-500/30 disabled:opacity-50 transition-colors" />
            <button onClick={handleSend} disabled={isLoading || !input.trim()} aria-label="Send message"
              className="flex items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 px-3 py-2 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:shadow-md">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.155.75.75 0 0 0 0-1.114A28.897 28.897 0 0 0 3.105 2.288Z" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
