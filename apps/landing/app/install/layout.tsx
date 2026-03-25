import type { ReactNode } from "react";

export const metadata = {
  title: "Install CIG",
  description:
    "Install CIG from the public cig.lat installer, then use the guided setup wizard to bootstrap the first graph.",
  alternates: {
    canonical: "/install",
  },
};

export default function InstallLayout({ children }: { children: ReactNode }) {
  return children;
}
