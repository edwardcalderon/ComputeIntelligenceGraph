"use client";

import { SignedOut } from "@cig/ui/components";

const SIGN_IN_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function SignedOutClient() {
  return <SignedOut signInUrl={SIGN_IN_URL} appName="CIG" />;
}
