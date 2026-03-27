// ─── System notification definitions + localStorage-backed preferences ────────
// This module manages "sticky" system notifications (e.g. welcome message) that
// re-appear on every session unless the user explicitly chooses "don't show again".

export interface SystemNotificationFeature {
  color: string;
  label: string;
  desc: string;
}

export interface SystemNotificationAction {
  id: string;
  label: string;
  variant: "primary" | "ghost";
}

export interface SystemNotificationMeta {
  version?: string;
  features?: SystemNotificationFeature[];
  actions?: SystemNotificationAction[];
}

export interface SystemNotificationDefinition {
  id: string;
  type: "system";
  title: string;
  message: string;
  meta?: SystemNotificationMeta;
}

// ─── Preference persistence (localStorage, keyed by userId) ──────────────────

const PREFS_KEY = (userId: string) => `cig:notif-prefs:${userId}`;

interface NotifPref {
  dontShowAgain?: boolean;
}

export function getNotifPrefs(userId: string): Record<string, NotifPref> {
  try {
    const raw = localStorage.getItem(PREFS_KEY(userId));
    return raw ? (JSON.parse(raw) as Record<string, NotifPref>) : {};
  } catch {
    return {};
  }
}

export function setNotifPref(
  userId: string,
  notifId: string,
  pref: NotifPref
): void {
  try {
    const prefs = getNotifPrefs(userId);
    prefs[notifId] = { ...prefs[notifId], ...pref };
    localStorage.setItem(PREFS_KEY(userId), JSON.stringify(prefs));
  } catch {
    // localStorage may be unavailable in certain environments
  }
}

export function shouldShow(userId: string, notifId: string): boolean {
  const prefs = getNotifPrefs(userId);
  return !prefs[notifId]?.dontShowAgain;
}

// ─── System notification factory functions ────────────────────────────────────

export interface WelcomeNotificationCopy {
  title: string;
  message: string;
  features: SystemNotificationFeature[];
  actions: SystemNotificationAction[];
}

export function buildWelcomeNotification(
  copy: WelcomeNotificationCopy,
  version: string
): SystemNotificationDefinition {
  return {
    id: "cig-welcome",
    type: "system",
    title: copy.title,
    message: copy.message,
    meta: {
      version: version ? `v${version}` : undefined,
      features: copy.features,
      actions: copy.actions,
    },
  };
}
