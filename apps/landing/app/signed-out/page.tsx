import type { Metadata } from "next";
import SignedOutClient from "./SignedOutClient";

export const metadata: Metadata = {
  title: "Signed out · CIG",
  description: "You have been signed out of Compute Intelligence Graph.",
};

export default function SignedOutPage() {
  return <SignedOutClient />;
}
