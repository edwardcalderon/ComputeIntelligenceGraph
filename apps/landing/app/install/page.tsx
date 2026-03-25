import type { Metadata } from "next";
import { LandingLayout } from "../../components/LandingLayout";
import InstallContent from "./InstallContent";

export const metadata: Metadata = {
  title: "Install CIG",
  description:
    "Install CIG from the public cig.lat installer, then use the guided setup wizard to bootstrap the first graph.",
  alternates: {
    canonical: "/install",
  },
};

export default function InstallPage() {
  return (
    <LandingLayout>
      <InstallContent />
    </LandingLayout>
  );
}
