"use client";

import { SignedOut } from "@cig/ui/components";

/**
 * The sign-in URL is the landing page — environment-specific value comes from
 * next.config.js which falls back to localhost:3000 for local dev.
 */
const SIGN_IN_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function SignedOutPage() {
  return <SignedOut signInUrl={SIGN_IN_URL} appName="CIG" />;
}
