"use client";

import { useTranslation } from "@cig-technology/i18n/react";
import { LegalDrawer } from "@cig/ui/components";

export default function PrivacyPage() {
  const t = useTranslation();

  return (
    <main className="min-h-screen bg-gradient-to-br from-zinc-50 via-white to-zinc-100 px-4 py-8 text-zinc-900 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 dark:text-zinc-50 sm:px-6 sm:py-12">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center">
        <LegalDrawer
          eyebrow={t("legal.privacy.eyebrow")}
          title={t("legal.privacy.title")}
          description={t("legal.privacy.description")}
          backHref="/"
          backLabel={t("common.back")}
          note={t("legal.privacy.note")}
          sections={[
            {
              title: t("legal.privacy.sections.collect.title"),
              body: t("legal.privacy.sections.collect.body"),
            },
            {
              title: t("legal.privacy.sections.use.title"),
              body: t("legal.privacy.sections.use.body"),
            },
            {
              title: t("legal.privacy.sections.share.title"),
              body: t("legal.privacy.sections.share.body"),
            },
          ]}
        />
      </div>
    </main>
  );
}