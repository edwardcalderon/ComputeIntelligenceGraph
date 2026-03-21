import type { Metadata } from "next";
import SignedOutClient from "./SignedOutClient";

export const metadata: Metadata = {
  title: "Signed out · CIG Dashboard",
  description: "You have been signed out of the CIG Dashboard.",
};

export default function SignedOutPage() {
  return <SignedOutClient />;
}
