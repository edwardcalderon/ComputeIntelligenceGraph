"use client";

const BOOTSTRAP_PROMPT_PREFIX = "cig:bootstrap-prompt-seen";

function getBootstrapPromptStorageKey(): string {
  const scope =
    typeof window === "undefined" ? "server" : window.location.origin;
  return `${BOOTSTRAP_PROMPT_PREFIX}:${scope}`;
}

export function hasSeenBootstrapPrompt(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(getBootstrapPromptStorageKey()) === "1";
  } catch {
    return false;
  }
}

export function markBootstrapPromptSeen(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getBootstrapPromptStorageKey(), "1");
  } catch {
    // Ignore storage failures and keep the bootstrap flow usable.
  }
}

export function clearBootstrapPromptSeen(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(getBootstrapPromptStorageKey());
  } catch {
    // Ignore storage failures and keep the bootstrap flow usable.
  }
}

export function getBootstrapPromptKey(): string {
  return getBootstrapPromptStorageKey();
}
