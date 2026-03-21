"use client";

import { SignedOut } from "@cig/ui/components";

/**
 * Landing-side signed-out page.
 * Shown when the user is redirected here from the dashboard after logout,
 * or navigates to /signed-out manually.
 * The "Sign in" button points back to the landing root ("/").
 */
export default function SignedOutPage() {
  return <SignedOut signInUrl="/" appName="CIG" />;
}
