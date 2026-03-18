"use client";

import { getSupabaseClient } from "./client";

/**
 * Send a magic-link / OTP code to the user's email via Supabase Auth.
 * The user will receive an email with a 6-digit code they can enter to sign in.
 */
export async function sendEmailOtp(email: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase client not configured");

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });

  if (error) throw new Error(error.message);
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
