"use client";

import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { Bot, Code, Info, Link as LinkIcon, Mic, Paperclip, Send, X } from "lucide-react";
import { sendChatMessage, type ChatMessage } from "../lib/api";

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
      const [isChatOpen, setIsChatOpen] = useState(false);
    return [];
      const [message, setMessage] = useState("");
      const [charCount, setCharCount] = useState(0);
}

      const chatRef = useRef<HTMLDivElement>(null);
function saveHistory(messages: ChatMessage[]) {
      const textareaRef = useRef<HTMLTextAreaElement>(null);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
      useEffect(() => {
        setMessages(loadHistory());
      }, []);

      useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, [messages, isLoading]);

      useEffect(() => {
        if (!isChatOpen) return;

        const timeoutId = window.setTimeout(() => {
          textareaRef.current?.focus();
        }, 50);

        return () => window.clearTimeout(timeoutId);
      }, [isChatOpen]);

      useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
          const target = event.target;

          if (!(target instanceof HTMLElement)) return;

          if (chatRef.current && !chatRef.current.contains(target) && !target.closest(".floating-ai-button")) {
            setIsChatOpen(false);
          }
        };

        document.addEventListener("mousedown", handleClickOutside);

        return () => {
          document.removeEventListener("mousedown", handleClickOutside);
        };
      }, []);
export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
        const text = message.trim();
  const [input, setInput] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
        setMessage("");
        setCharCount(0);
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
      function handleInputChange(event: ChangeEvent<HTMLTextAreaElement>) {
        const value = event.target.value;
        setMessage(value);
        setCharCount(value.length);
      }

      function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          void handleSend();
        }
      const updated = [...next, assistantMsg];
      setMessages(updated);
      saveHistory(updated);
    } catch (err) {
          <div className="fixed bottom-6 right-6 z-50">
            <button
              className={`floating-ai-button relative flex h-16 w-16 items-center justify-center rounded-full transition-all duration-500 ${
                isChatOpen ? "rotate-90" : "rotate-0"
              }`}
              onClick={() => setIsChatOpen((value) => !value)}
              aria-label={isChatOpen ? "Close chat" : "Open chat"}
              style={{
                background: "linear-gradient(135deg, rgba(99,102,241,0.8) 0%, rgba(168,85,247,0.8) 100%)",
                boxShadow:
                  "0 0 20px rgba(139, 92, 246, 0.7), 0 0 40px rgba(124, 58, 237, 0.5), 0 0 60px rgba(109, 40, 217, 0.3)",
                border: "2px solid rgba(255, 255, 255, 0.2)",
                marginBottom: "env(safe-area-inset-bottom)",
              }}
            >
              <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/20 to-transparent opacity-30" />
              <div className="absolute inset-0 rounded-full border-2 border-white/10" />
              <div className="relative z-10">{isChatOpen ? <X className="h-8 w-8 text-white" /> : <Bot className="h-8 w-8 text-white" />}</div>
              <div className="absolute inset-0 rounded-full bg-indigo-500 opacity-20 animate-ping" />
  }
  return (
            {isChatOpen && (
              <div
                ref={chatRef}
                className="absolute bottom-20 right-0 w-[calc(100vw-2rem)] max-w-[500px] origin-bottom-right transition-all duration-300 sm:w-[500px]"
                style={{
                  animation: "popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards",
                }}
              >
                <div className="relative flex max-h-[min(80vh,720px)] flex-col overflow-hidden rounded-3xl border border-zinc-500/50 bg-gradient-to-br from-zinc-800/80 to-zinc-900/90 shadow-2xl backdrop-blur-3xl">
                  <div className="flex items-center justify-between px-6 pb-2 pt-4">
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                      <span className="text-xs font-medium text-zinc-400">AI Assistant</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="rounded-2xl bg-zinc-800/60 px-2 py-1 text-xs font-medium text-zinc-300">GPT-4</span>
                      <span className="rounded-2xl border border-red-500/20 bg-red-500/10 px-2 py-1 text-xs font-medium text-red-400">Pro</span>
                      <button onClick={() => setIsChatOpen(false)} aria-label="Close chat" className="rounded-full p-1.5 transition-colors hover:bg-zinc-700/50">
                        <X className="h-4 w-4 text-zinc-400" />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4">
                    {messages.length === 0 && (
                      <p className="mt-8 text-center text-sm text-zinc-400">Ask anything about your infrastructure.</p>
                    )}

                    <div className="space-y-3">
                      {messages.map((msg, index) => (
                        <div key={`${msg.timestamp}-${index}`} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                          <div
                            className={[
                              "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                              msg.role === "user"
                                ? "rounded-br-sm border border-cyan-500/30 bg-cyan-600 text-white dark:bg-gradient-to-br dark:from-cyan-500/20 dark:to-blue-600/20 dark:text-white/90"
                                : "rounded-bl-sm border border-zinc-700/60 bg-slate-100 text-zinc-100 dark:bg-white/[0.04] dark:text-zinc-100",
                            ].join(" ")}
                          >
                            {msg.content}
                          </div>
                        </div>
                      ))}

                      {isLoading && (
                        <div className="flex justify-start">
                          <div className="rounded-2xl rounded-bl-sm border border-zinc-700/60 bg-slate-100 px-3.5 py-2.5 dark:bg-white/[0.04]">
                            <span className="flex items-center gap-1">
                              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-500 [animation-delay:-0.3s] dark:bg-cyan-400/60" />
                              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-500 [animation-delay:-0.15s] dark:bg-cyan-400/60" />
                              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-500 dark:bg-cyan-400/60" />
                            </span>
                          </div>
                        </div>
                      )}

                      {error && <p className="text-center text-xs text-red-500 dark:text-red-400">{error}</p>}
                      <div ref={bottomRef} />
                    </div>
                  </div>

                  <div className="relative overflow-hidden border-t border-zinc-800/50 px-4 pb-4 pt-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
                    <div className="relative overflow-hidden">
                      <textarea
                        ref={textareaRef}
                        value={message}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        rows={4}
                        maxLength={MAX_CHARS}
                        className="min-h-[120px] w-full resize-none rounded-2xl border border-zinc-700/60 bg-transparent px-6 py-4 text-base leading-relaxed text-zinc-100 outline-none placeholder:text-zinc-500"
                        placeholder="What would you like to explore today? Ask anything, share ideas, or request assistance..."
                        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-zinc-800/5 to-transparent" />
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 rounded-xl border border-zinc-700/50 bg-zinc-800/40 p-1">
                          <button type="button" className="group relative rounded-lg border-none bg-transparent p-2.5 text-zinc-500 transition-all duration-300 hover:-rotate-3 hover:scale-105 hover:bg-zinc-800/80 hover:text-zinc-200">
                            <Paperclip className="h-4 w-4 transition-all duration-300 group-hover:-rotate-12 group-hover:scale-125" />
                            <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-zinc-700/50 bg-zinc-900/95 px-3 py-2 text-xs text-zinc-200 opacity-0 shadow-lg backdrop-blur-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:opacity-100">
                              Upload files
                              <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-l-4 border-r-4 border-t-4 border-transparent border-t-zinc-900/95" />
                            </div>
                          </button>

                          <button type="button" className="group relative rounded-lg border-none bg-transparent p-2.5 text-zinc-500 transition-all duration-300 hover:rotate-6 hover:scale-105 hover:bg-zinc-800/80 hover:text-red-400">
                            <LinkIcon className="h-4 w-4 transition-all duration-300 group-hover:rotate-12 group-hover:scale-125" />
                            <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-zinc-700/50 bg-zinc-900/95 px-3 py-2 text-xs text-zinc-200 opacity-0 shadow-lg backdrop-blur-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:opacity-100">
                              Web link
                              <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-l-4 border-r-4 border-t-4 border-transparent border-t-zinc-900/95" />
                            </div>
                          </button>

                          <button type="button" className="group relative rounded-lg border-none bg-transparent p-2.5 text-zinc-500 transition-all duration-300 hover:rotate-3 hover:scale-105 hover:bg-zinc-800/80 hover:text-green-400">
                            <Code className="h-4 w-4 transition-all duration-300 group-hover:-rotate-6 group-hover:scale-125" />
                            <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-zinc-700/50 bg-zinc-900/95 px-3 py-2 text-xs text-zinc-200 opacity-0 shadow-lg backdrop-blur-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:opacity-100">
                              Code repo
                              <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-l-4 border-r-4 border-t-4 border-transparent border-t-zinc-900/95" />
                            </div>
                          </button>

                          <button type="button" className="group relative rounded-lg border-none bg-transparent p-2.5 text-zinc-500 transition-all duration-300 hover:-rotate-6 hover:scale-105 hover:bg-zinc-800/80 hover:text-purple-400">
                            <svg className="h-4 w-4 transition-all duration-300 group-hover:rotate-12 group-hover:scale-125" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                              <path d="M15.852 8.981h-4.588V0h4.588c2.476 0 4.49 2.014 4.49 4.49s-2.014 4.491-4.49 4.491zM12.735 7.51h3.117c1.665 0 3.019-1.355 3.019-3.019s-1.354-3.019-3.019-3.019h-3.117V7.51zm0 1.471H8.148c-2.476 0-4.49-2.015-4.49-4.49S5.672 0 8.148 0h4.588v8.981zm-4.587-7.51c-1.665 0-3.019 1.355-3.019 3.019s1.354 3.02 3.019 3.02h3.117V1.471H8.148zm4.587 15.019H8.148c-2.476 0-4.49-2.014-4.49-4.49s2.014-4.49 4.49-4.49h4.588v8.98zM8.148 8.981c-1.665 0-3.019 1.355-3.019 3.019s1.355 3.019 3.019 3.019h3.117v-6.038H8.148zm7.704 0c-2.476 0-4.49 2.015-4.49 4.49s2.014 4.49 4.49 4.49 4.49-2.015 4.49-4.49-2.014-4.49-4.49-4.49zm0 7.509c-1.665 0-3.019-1.355-3.019-3.019s1.355-3.019 3.019-3.019 3.019 1.354 3.019 3.019-1.354 3.019-3.019 3.019zM8.148 24c-2.476 0-4.49-2.015-4.49-4.49s2.014-4.49 4.49-4.49h4.588V24H8.148zm3.117-1.471V16.49H8.148c-1.665 0-3.019 1.355-3.019 3.019s1.355 3.02 3.019 3.02h3.117z" />
                            </svg>
                            <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-zinc-700/50 bg-zinc-900/95 px-3 py-2 text-xs text-zinc-200 opacity-0 shadow-lg backdrop-blur-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:opacity-100">
                              Design file
                              <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-l-4 border-r-4 border-t-4 border-transparent border-t-zinc-900/95" />
                            </div>
                          </button>
                        </div>

                        <button type="button" className="group relative rounded-lg border border-zinc-700/30 bg-transparent p-2.5 text-zinc-500 transition-all duration-300 hover:rotate-2 hover:scale-110 hover:border-red-500/30 hover:bg-zinc-800/80 hover:text-red-400">
                          <Mic className="h-4 w-4 transition-all duration-300 group-hover:-rotate-3 group-hover:scale-125" />
                          <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-zinc-700/50 bg-zinc-900/95 px-3 py-2 text-xs text-zinc-200 opacity-0 shadow-lg backdrop-blur-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:opacity-100">
                            Voice input
                            <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-l-4 border-r-4 border-t-4 border-transparent border-t-zinc-900/95" />
                          </div>
                        </button>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-xs font-medium text-zinc-500">
                          <span>{charCount}</span>/<span className="text-zinc-400">{MAX_CHARS}</span>
                        </div>

                        <button
                          onClick={() => void handleSend()}
                          disabled={isLoading || !message.trim()}
                          aria-label="Send message"
                          className="group relative rounded-xl bg-gradient-to-r from-red-600 to-red-500 p-3 text-white shadow-lg transition-all duration-300 hover:-rotate-2 hover:scale-110 hover:shadow-xl hover:shadow-red-500/30 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
                          style={{ boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 0 0 0 rgba(239, 68, 68, 0.4)" }}
                        >
                          <Send className="h-5 w-5 transition-all duration-300 group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:rotate-12 group-hover:scale-110" />
                          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-red-600 to-red-500 opacity-0 blur-lg transition-opacity duration-300 group-hover:opacity-50" />
                          <div className="absolute inset-0 overflow-hidden rounded-xl">
                            <div className="absolute inset-0 scale-0 rounded-xl bg-white/20 transition-transform duration-200 group-active:scale-100" />
                          </div>
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-6 border-t border-zinc-800/50 pt-3 text-xs text-zinc-500">
                      <div className="flex items-center gap-2">
                        <Info className="h-3 w-3" />
                        <span>
                          Press <kbd className="rounded border border-zinc-600 bg-zinc-800 px-1.5 py-1 font-mono text-xs text-zinc-400 shadow-sm">Shift + Enter</kbd> for new line
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        <span>All systems operational</span>
                      </div>
                    </div>
                  </div>

                  <div
                    className="pointer-events-none absolute inset-0 rounded-3xl"
                    style={{
                      background: "linear-gradient(135deg, rgba(239, 68, 68, 0.05), transparent, rgba(147, 51, 234, 0.05))",
                    }}
                  />
                </div>
              </div>
            )}

            <style jsx>{`
              @keyframes popIn {
                0% {
                  opacity: 0;
                  transform: scale(0.8) translateY(20px);
                }

                100% {
                  opacity: 1;
                  transform: scale(1) translateY(0);
                }
              }

              .floating-ai-button:hover {
                transform: scale(1.1) rotate(5deg);
                box-shadow: 0 0 30px rgba(139, 92, 246, 0.9), 0 0 50px rgba(124, 58, 237, 0.7), 0 0 70px rgba(109, 40, 217, 0.5);
              }
            `}</style>
          </div>
              placeholder="Type a message..." disabled={isLoading}
              className="flex-1 rounded-xl border border-cig bg-cig-base px-3.5 py-2.5 text-sm text-cig-primary placeholder-cig-muted focus:outline-none focus:ring-1 focus:ring-cyan-500/40 focus:border-cyan-500/30 disabled:opacity-50 transition-colors" />
            <button onClick={handleSend} disabled={isLoading || !input.trim()} aria-label="Send message"
              className="flex items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 px-3.5 py-2.5 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:shadow-md active:scale-95">
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
