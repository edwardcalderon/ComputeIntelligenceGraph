"use client";

import { getSupabaseClient } from "./client";

function getApiBaseUrl(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (apiUrl) {
    return apiUrl.replace(/\/$/, "");
  }

  throw new Error("NEXT_PUBLIC_API_URL is not configured");
}

/**
 * Send OTP-only email via custom backend endpoint.
 */
export async function sendEmailOtp(email: string): Promise<void> {
  const res = await fetch(`${getApiBaseUrl()}/api/v1/auth/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to send OTP email");
  }
}

/**
 * Send magic-link-only email via custom backend endpoint.
 */
export async function sendMagicLinkEmail(email: string): Promise<void> {
  const res = await fetch(`${getApiBaseUrl()}/api/v1/auth/send-magic-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to send magic link email");
  }
}


/**
 * Verify the OTP code the user received via email.
 */
export async function verifyEmailOtp(
  email: string,
  token: string
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase client not configured");

  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  if (error) throw new Error(error.message);
}
