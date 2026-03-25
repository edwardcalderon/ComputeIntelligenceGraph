"use client";

import { z } from 'zod';

const emailSchema = z.string().trim().email();

interface VerifyOtpResponse {
  accessToken: string;
  expiresIn: number;
  socialProvider?: string;
}

function getApiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_URL?.trim() || "https://api.cig.technology").replace(/\/$/, "");
}

function persistEmailSession(accessToken: string, expiresIn: number, socialProvider = "email"): void {
  if (typeof window === "undefined") {
    return;
  }

  const expiresAt = Date.now() + expiresIn * 1000;
  const expiresAtDate = new Date(expiresAt).toUTCString();
  const secure = window.location.protocol === "https:" ? "; Secure" : "";

  sessionStorage.setItem("cig_access_token", accessToken);
  sessionStorage.setItem("cig_id_token", accessToken);
  sessionStorage.setItem("cig_expires_in", String(expiresIn));
  sessionStorage.setItem("cig_expires_at", String(expiresAt));
  sessionStorage.setItem("cig_auth_source", "supabase");
  sessionStorage.setItem("cig_social_provider", socialProvider);
  document.cookie = `cig_has_session=1; path=/; expires=${expiresAtDate}; SameSite=Lax${secure}`;

  try {
    window.dispatchEvent(new Event("cig-session-changed"));
  } catch {
    /* ignore */
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Request failed");
  }

  return res.json() as Promise<T>;
}

/**
 * Send OTP-only email via custom backend endpoint.
 */
function normalizeEmail(email: string): string {
  const result = emailSchema.safeParse(email);
  if (!result.success) {
    throw new Error('Invalid email');
  }

  return result.data;
}

export async function sendEmailOtp(email: string): Promise<void> {
  const normalizedEmail = normalizeEmail(email);
  await postJson<{ success: true }>("/api/v1/auth/send-otp", { email: normalizedEmail });
}

/**
 * Send magic-link-only email via custom backend endpoint.
 */
export async function sendMagicLinkEmail(email: string): Promise<void> {
  const normalizedEmail = normalizeEmail(email);
  await postJson<{ success: true }>("/api/v1/auth/send-magic-link", { email: normalizedEmail });
}


/**
 * Verify the OTP code the user received via email.
 */
export async function verifyEmailOtp(
  email: string,
  token: string
): Promise<void> {
  const response = await postJson<VerifyOtpResponse>("/api/v1/auth/verify-otp", {
    email,
    token,
  });

  persistEmailSession(response.accessToken, response.expiresIn, response.socialProvider ?? "email");
}
