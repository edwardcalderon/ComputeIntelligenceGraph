import { describe, it, expect, beforeEach } from "vitest";
import { I18n, isValidLocale } from "../src/core.js";

describe("I18n core", () => {
  let i18n: I18n;

  beforeEach(() => {
    i18n = new I18n();
  });

  it("defaults to 'en' locale", () => {
    expect(i18n.locale).toBe("en");
  });

  it("translates a simple key", () => {
    i18n.loadCatalog("test", "en", { greeting: "Hello" });
    expect(i18n.t("greeting")).toBe("Hello");
  });

  it("returns key when translation is missing", () => {
    expect(i18n.t("missing.key")).toBe("missing.key");
  });

  it("tracks missing keys", () => {
    i18n.t("one.missing");
    i18n.t("two.missing");
    i18n.t("one.missing"); // duplicate
    expect(i18n.missingKeys.size).toBe(2);
  });

  it("emits missing-key event", () => {
    const events: unknown[] = [];
    i18n.on("missing-key", (data) => events.push(data));
    i18n.t("unknown");
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ key: "unknown", locale: "en" });
  });

  it("interpolates simple values", () => {
    i18n.loadCatalog("test", "en", {
      greeting: "Hello {name}!",
    });
    expect(i18n.t("greeting", { name: "World" })).toBe("Hello World!");
  });

  it("switches locales", async () => {
    i18n.loadCatalog("test", "en", { greeting: "Hello" });
    i18n.loadCatalog("test", "es", { greeting: "Hola" });

    expect(i18n.t("greeting")).toBe("Hello");

    i18n.setLocale("es");
    expect(i18n.locale).toBe("es");
    expect(i18n.t("greeting")).toBe("Hola");
  });

  it("falls back to default locale on missing translation", () => {
    i18n.loadCatalog("test", "en", { greeting: "Hello" });
    i18n.setLocale("es");
    // No Spanish catalog loaded — should fall back to English
    expect(i18n.t("greeting")).toBe("Hello");
  });

  it("activates locale with registered loaders", async () => {
    i18n.registerLoader("app", (locale) => {
      if (locale === "es") return { greeting: "Hola" };
      return { greeting: "Hello" };
    });

    await i18n.activate("es", ["app"]);
    expect(i18n.locale).toBe("es");
    expect(i18n.t("greeting")).toBe("Hola");
  });

  it("emits locale-change event", () => {
    const events: unknown[] = [];
    i18n.on("locale-change", (data) => events.push(data));
    i18n.setLocale("zh");
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ locale: "zh" });
  });

  it("unsubscribes from events", () => {
    const events: unknown[] = [];
    const unsub = i18n.on("locale-change", (data) => events.push(data));
    i18n.setLocale("es");
    unsub();
    i18n.setLocale("zh");
    expect(events).toHaveLength(1);
  });

  it("has() checks key existence", () => {
    i18n.loadCatalog("test", "en", { exists: "yes" });
    expect(i18n.has("exists")).toBe(true);
    expect(i18n.has("missing")).toBe(false);
  });

  it("merges multiple namespaces", () => {
    i18n.loadCatalog("shared", "en", { common: "Shared" });
    i18n.loadCatalog("app", "en", { specific: "App" });
    expect(i18n.t("common")).toBe("Shared");
    expect(i18n.t("specific")).toBe("App");
  });
});

describe("isValidLocale", () => {
  it("recognizes supported locales", () => {
    expect(isValidLocale("en")).toBe(true);
    expect(isValidLocale("es")).toBe(true);
    expect(isValidLocale("zh")).toBe(true);
  });

  it("rejects unknown locales", () => {
    expect(isValidLocale("fr")).toBe(false);
    expect(isValidLocale("")).toBe(false);
    expect(isValidLocale("EN")).toBe(false);
  });
});
